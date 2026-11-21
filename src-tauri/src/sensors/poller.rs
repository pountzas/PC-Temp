use crate::ipc::events;
use crate::ipc::types::{CpuSnapshot, GpuSnapshot, IntervalMs, SensorTick};
use crate::sensors::alerts::AlertState;
use crate::sensors::history::{self, empty_for_interval};
use crate::sensors::source::{CpuReading, CpuSource, GpuReading, GpuSource};
use crate::state::{AppState, PollerMsg};
use std::sync::{Arc, Mutex, TryLockError};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time;
use tokio::time::MissedTickBehavior;

const VALID_INTERVALS: [IntervalMs; 3] = [1000, 2000, 5000];

pub(crate) struct SensorSources {
    cpu: Arc<Mutex<Box<dyn CpuSource>>>,
    gpu: Arc<Mutex<Box<dyn GpuSource>>>,
}

fn is_valid_interval(ms: IntervalMs) -> bool {
    VALID_INTERVALS.contains(&ms)
}

fn seed_interval_ms() -> IntervalMs {
    let from_settings = crate::settings::get().interval_ms;
    if is_valid_interval(from_settings) {
        from_settings
    } else {
        1000
    }
}

pub fn spawn(
    app: AppHandle,
    state: Arc<AppState>,
    cpu: Box<dyn CpuSource>,
    gpu: Box<dyn GpuSource>,
    rx: mpsc::Receiver<PollerMsg>,
) {
    let sources = SensorSources {
        cpu: Arc::new(Mutex::new(cpu)),
        gpu: Arc::new(Mutex::new(gpu)),
    };
    tauri::async_runtime::spawn(async move {
        run_loop(state, sources, rx, move |tick| {
            let _ = app.emit(events::SENSORS, tick);
        })
        .await;
    });
}

async fn run_loop<E>(
    state: Arc<AppState>,
    sources: SensorSources,
    mut rx: mpsc::Receiver<PollerMsg>,
    mut on_emit: E,
) where
    E: FnMut(&SensorTick),
{
    let mut interval_ms = seed_interval_ms();
    let mut sensor_history = empty_for_interval(interval_ms);
    let mut alert_state = AlertState::new();
    let mut tick = time::interval(Duration::from_millis(u64::from(interval_ms)));
    tick.set_missed_tick_behavior(MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(PollerMsg::SetInterval(next)) => {
                        if !is_valid_interval(next) {
                            continue;
                        }
                        interval_ms = next;
                        history::on_interval_change(&mut sensor_history, interval_ms);
                        tick = time::interval(Duration::from_millis(u64::from(interval_ms)));
                        tick.set_missed_tick_behavior(MissedTickBehavior::Skip);
                        tick.tick().await;
                    }
                    None => break,
                }
            }
            _ = tick.tick() => {
                let timeout =
                    Duration::from_millis(u64::from(interval_ms) * 3 / 4);
                let (cpu_reading, gpu_reading) =
                    read_with_timeout(&sources, timeout).await;

                history::push_cpu(
                    &mut sensor_history,
                    interval_ms,
                    cpu_reading.snapshot.load_pct,
                );
                history::push_gpu(
                    &mut sensor_history,
                    interval_ms,
                    gpu_reading.snapshot.load_pct,
                );

                let mut alert_list = Vec::new();
                if let Some(alert) =
                    alert_state.evaluate_cpu(cpu_reading.snapshot.package_temp_c)
                {
                    alert_list.push(alert);
                }
                if let Some(alert) = alert_state.evaluate_gpu(gpu_reading.snapshot.core_temp_c)
                {
                    alert_list.push(alert);
                }

                let sensor_tick = SensorTick {
                    ts: chrono_like_now_ms(),
                    interval_ms,
                    cpu: cpu_reading.snapshot,
                    gpu: gpu_reading.snapshot,
                    history: sensor_history.clone(),
                    alerts: alert_list,
                };

                if let Ok(mut guard) = state.last_tick.write() {
                    *guard = Some(sensor_tick.clone());
                }

                on_emit(&sensor_tick);
            }
        }
    }
}

async fn read_with_timeout(sources: &SensorSources, timeout: Duration) -> (CpuReading, GpuReading) {
    let cpu = Arc::clone(&sources.cpu);
    let cpu_fut = tokio::time::timeout(
        timeout,
        tokio::task::spawn_blocking(move || match cpu.try_lock() {
            Ok(mut s) => Some(s.read()),
            Err(TryLockError::Poisoned(p)) => Some(p.into_inner().read()),
            Err(TryLockError::WouldBlock) => None,
        }),
    );

    let gpu = Arc::clone(&sources.gpu);
    let gpu_fut = tokio::time::timeout(
        timeout,
        tokio::task::spawn_blocking(move || match gpu.try_lock() {
            Ok(mut s) => Some(s.read()),
            Err(TryLockError::Poisoned(p)) => Some(p.into_inner().read()),
            Err(TryLockError::WouldBlock) => None,
        }),
    );

    let (cpu_res, gpu_res) = tokio::join!(cpu_fut, gpu_fut);

    let cpu_reading = cpu_res
        .ok()
        .and_then(|join| join.ok())
        .flatten()
        .unwrap_or_else(failed_cpu_reading);
    let gpu_reading = gpu_res
        .ok()
        .and_then(|join| join.ok())
        .flatten()
        .unwrap_or_else(failed_gpu_reading);

    (cpu_reading, gpu_reading)
}

fn failed_cpu_reading() -> CpuReading {
    CpuReading {
        snapshot: CpuSnapshot {
            name: String::new(),
            load_pct: None,
            package_temp_c: None,
            package_power_w: None,
            clock_mhz: None,
            base_clock_mhz: 0,
            cores: Vec::new(),
            threads: None,
        },
    }
}

fn failed_gpu_reading() -> GpuReading {
    GpuReading {
        snapshot: GpuSnapshot {
            name: String::new(),
            load_pct: None,
            core_temp_c: None,
            core_clock_mhz: None,
            fan_pct: None,
            vram_used_mib: None,
            vram_total_mib: None,
        },
    }
}

fn chrono_like_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ipc::types::Pct;
    use crate::sensors::source::{MockCpu, MockGpu};
    use std::sync::atomic::{AtomicU32, Ordering};
    use tokio::time::{self as tokio_time, Duration as TokioDuration};

    fn test_state() -> Arc<AppState> {
        let (tx, _rx) = mpsc::channel(8);
        Arc::new(AppState {
            poller: crate::state::PollerHandle { tx },
            last_tick: std::sync::RwLock::new(None),
        })
    }

    fn test_sources() -> SensorSources {
        SensorSources {
            cpu: Arc::new(Mutex::new(Box::new(MockCpu::new()) as Box<dyn CpuSource>)),
            gpu: Arc::new(Mutex::new(Box::new(MockGpu::new()) as Box<dyn GpuSource>)),
        }
    }

    struct GatedCpu {
        calls: Arc<AtomicU32>,
        release: std::sync::Mutex<std::sync::mpsc::Receiver<()>>,
    }

    impl CpuSource for GatedCpu {
        fn read(&mut self) -> CpuReading {
            self.calls.fetch_add(1, Ordering::SeqCst);
            let guard = self
                .release
                .lock()
                .expect("gated cpu release mutex poisoned");
            let _ = guard.recv();
            failed_cpu_reading()
        }
    }

    struct FastGpu {
        load: Option<Pct>,
    }

    impl GpuSource for FastGpu {
        fn read(&mut self) -> GpuReading {
            let mut snap = failed_gpu_reading().snapshot;
            snap.load_pct = self.load;
            GpuReading { snapshot: snap }
        }
    }

    async fn advance_interval_ticks(n: u32) {
        for _ in 0..n {
            tokio_time::advance(TokioDuration::from_millis(1000)).await;
            for _ in 0..8 {
                tokio::task::yield_now().await;
            }
        }
    }

    async fn wait_until(mut predicate: impl FnMut() -> bool) {
        for _ in 0..80 {
            if predicate() {
                return;
            }
            tokio_time::advance(TokioDuration::from_millis(50)).await;
            for _ in 0..4 {
                tokio::task::yield_now().await;
            }
        }
        panic!("condition not met before poll budget exhausted");
    }

    #[test]
    fn valid_intervals_only() {
        assert!(is_valid_interval(1000));
        assert!(is_valid_interval(2000));
        assert!(is_valid_interval(5000));
        assert!(!is_valid_interval(3000));
    }

    #[tokio::test]
    async fn slow_read_times_out_gpu_load_preserved() {
        let calls = Arc::new(AtomicU32::new(0));
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let sources = SensorSources {
            cpu: Arc::new(Mutex::new(Box::new(GatedCpu {
                calls: Arc::clone(&calls),
                release: std::sync::Mutex::new(release_rx),
            }))),
            gpu: Arc::new(Mutex::new(Box::new(FastGpu { load: Some(58.0) }))),
        };
        let timeout = Duration::from_millis(200);
        let (cpu, gpu) = read_with_timeout(&sources, timeout).await;
        assert!(cpu.snapshot.load_pct.is_none());
        assert_eq!(gpu.snapshot.load_pct, Some(58.0));

        let (cpu2, gpu2) = read_with_timeout(&sources, timeout).await;
        assert!(cpu2.snapshot.load_pct.is_none());
        assert_eq!(gpu2.snapshot.load_pct, Some(58.0));
        assert_eq!(
            calls.load(Ordering::SeqCst),
            1,
            "in-flight CPU read should skip a second blocking call"
        );

        release_tx.send(()).expect("release gated cpu read");
        for _ in 0..8 {
            tokio::task::yield_now().await;
        }
    }

    #[tokio::test(start_paused = true)]
    async fn one_sensor_tick_per_second_over_three_seconds() {
        let state = test_state();
        let (_tx, rx) = mpsc::channel(8);
        let tick_count = Arc::new(AtomicU32::new(0));
        let count = Arc::clone(&tick_count);

        let handle = tokio::spawn(async move {
            run_loop(state, test_sources(), rx, move |_| {
                count.fetch_add(1, Ordering::SeqCst);
            })
            .await;
        });

        for _ in 0..8 {
            tokio::task::yield_now().await;
        }
        advance_interval_ticks(3).await;
        handle.abort();
        let _ = handle.await;

        let ticks = tick_count.load(Ordering::SeqCst);
        assert!(
            (3..=4).contains(&ticks),
            "expected one tick per interval, got {ticks}"
        );
    }

    #[tokio::test(start_paused = true)]
    async fn last_tick_accumulates_history_per_tick() {
        let state = test_state();
        let state_loop = Arc::clone(&state);
        let (_tx, rx) = mpsc::channel(8);

        let handle = tokio::spawn(async move {
            run_loop(state_loop, test_sources(), rx, |_| {}).await;
        });

        wait_until(|| {
            state
                .last_tick
                .read()
                .ok()
                .and_then(|g| g.clone())
                .map(|t| t.history.cpu_load.len())
                .unwrap_or(0)
                >= 3
        })
        .await;

        let tick = state.last_tick.read().unwrap().clone().expect("snapshot");
        assert_eq!(tick.history.cpu_load.len(), 3);
        assert_eq!(tick.history.gpu_load.len(), 3);

        handle.abort();
        let _ = handle.await;
    }

    #[tokio::test(start_paused = true)]
    async fn set_interval_five_seconds_on_next_tick() {
        let state = test_state();
        let state_loop = Arc::clone(&state);
        let (tx, rx) = mpsc::channel(8);

        let handle = tokio::spawn(async move {
            run_loop(state_loop, test_sources(), rx, |_| {}).await;
        });

        advance_interval_ticks(60).await;
        tx.send(PollerMsg::SetInterval(5000)).await.unwrap();
        for _ in 0..5 {
            tokio_time::advance(TokioDuration::from_millis(5000)).await;
            for _ in 0..8 {
                tokio::task::yield_now().await;
            }
            if state
                .last_tick
                .read()
                .ok()
                .and_then(|g| g.clone())
                .map(|t| t.interval_ms)
                == Some(5000)
            {
                break;
            }
        }

        let tick = state.last_tick.read().unwrap().clone().expect("snapshot");
        assert_eq!(tick.interval_ms, 5000);
        assert!(tick.history.cpu_load.len() <= 12);

        handle.abort();
        let _ = handle.await;
    }

    #[tokio::test(start_paused = true)]
    async fn invalid_set_interval_is_ignored() {
        let state = test_state();
        let state_loop = Arc::clone(&state);
        let (tx, rx) = mpsc::channel(8);

        let handle = tokio::spawn(async move {
            run_loop(state_loop, test_sources(), rx, |_| {}).await;
        });

        tokio_time::advance(TokioDuration::from_millis(1000)).await;
        tokio::task::yield_now().await;
        tx.send(PollerMsg::SetInterval(3000)).await.unwrap();
        tokio::task::yield_now().await;
        tokio_time::advance(TokioDuration::from_millis(1000)).await;
        tokio::task::yield_now().await;

        let tick = state.last_tick.read().unwrap().clone().expect("snapshot");
        assert_eq!(tick.interval_ms, 1000);

        handle.abort();
        let _ = handle.await;
    }
}

#[cfg(any(test, debug_assertions))]
pub(crate) mod test_support {
    use super::*;
    use crate::ipc::types::Pct;
    use crate::sensors::source::{MockCpu, MockGpu};
    use std::sync::{Arc, Mutex};
    use tokio::sync::mpsc;
    use tokio::time::{self as tokio_time, Duration as TokioDuration};

    pub fn test_state() -> Arc<AppState> {
        let (tx, _rx) = mpsc::channel(8);
        Arc::new(AppState {
            poller: crate::state::PollerHandle { tx },
            last_tick: std::sync::RwLock::new(None),
        })
    }

    pub(crate) fn test_sources() -> super::SensorSources {
        SensorSources {
            cpu: Arc::new(Mutex::new(Box::new(MockCpu::new()) as Box<dyn CpuSource>)),
            gpu: Arc::new(Mutex::new(Box::new(MockGpu::new()) as Box<dyn GpuSource>)),
        }
    }

    pub(crate) fn test_sources_with_gpu<G: GpuSource + 'static>(gpu: G) -> super::SensorSources {
        SensorSources {
            cpu: Arc::new(Mutex::new(Box::new(MockCpu::new()) as Box<dyn CpuSource>)),
            gpu: Arc::new(Mutex::new(Box::new(gpu) as Box<dyn GpuSource>)),
        }
    }

    pub async fn run_default_poller_loop<E>(
        state: Arc<AppState>,
        rx: mpsc::Receiver<PollerMsg>,
        on_emit: E,
    ) where
        E: FnMut(&SensorTick),
    {
        run_loop(state, test_sources(), rx, on_emit).await;
    }

    pub async fn run_poller_with_gpu<G, E>(
        state: Arc<AppState>,
        gpu: G,
        rx: mpsc::Receiver<PollerMsg>,
        on_emit: E,
    ) where
        G: GpuSource + 'static,
        E: FnMut(&SensorTick),
    {
        run_loop(state, test_sources_with_gpu(gpu), rx, on_emit).await;
    }

    pub async fn advance_interval_ticks(n: u32) {
        for _ in 0..n {
            tokio_time::advance(TokioDuration::from_millis(1000)).await;
            for _ in 0..8 {
                tokio::task::yield_now().await;
            }
        }
    }

    pub async fn wait_until(mut predicate: impl FnMut() -> bool) {
        for _ in 0..80 {
            if predicate() {
                return;
            }
            tokio_time::advance(TokioDuration::from_millis(50)).await;
            for _ in 0..4 {
                tokio::task::yield_now().await;
            }
        }
        panic!("condition not met before poll budget exhausted");
    }

    pub async fn wait_for_tick<F>(state: &Arc<AppState>, predicate: F)
    where
        F: Fn(&SensorTick) -> bool,
    {
        wait_until(|| {
            state
                .last_tick
                .read()
                .ok()
                .and_then(|g| g.clone())
                .map(|t| predicate(&t))
                .unwrap_or(false)
        })
        .await;
    }

    /// GPU mock whose core temperature changes per read (poller integration scenarios).
    pub struct SteppedGpu {
        temps_c: Vec<Option<Pct>>,
        index: usize,
    }

    impl SteppedGpu {
        pub fn new(temps_c: Vec<Option<f64>>) -> Self {
            Self {
                temps_c: temps_c.into_iter().map(|t| t.map(|v| v as Pct)).collect(),
                index: 0,
            }
        }
    }

    impl GpuSource for SteppedGpu {
        fn read(&mut self) -> GpuReading {
            let temp = self
                .temps_c
                .get(self.index)
                .copied()
                .flatten()
                .or_else(|| self.temps_c.last().copied().flatten());
            if self.index + 1 < self.temps_c.len() {
                self.index += 1;
            }
            let mut snap = failed_gpu_reading().snapshot;
            snap.core_temp_c = temp;
            snap.load_pct = Some(50.0);
            GpuReading { snapshot: snap }
        }
    }

    pub fn last_tick(state: &Arc<AppState>) -> Option<SensorTick> {
        state.last_tick.read().ok().and_then(|g| g.clone())
    }
}
