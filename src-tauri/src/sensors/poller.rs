use crate::ipc::events;
use crate::ipc::types::{CpuSnapshot, GpuSnapshot, IntervalMs, SensorTick};
use crate::sensors::alerts::AlertState;
use crate::sensors::history::{self, empty_for_interval};
use crate::sensors::source::{CpuReading, CpuSource, GpuReading, GpuSource};
use crate::state::{AppState, PollerMsg};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time;
use tokio::time::MissedTickBehavior;

const VALID_INTERVALS: [IntervalMs; 3] = [1000, 2000, 5000];

struct SensorSources {
    cpu: Box<dyn CpuSource>,
    gpu: Box<dyn GpuSource>,
}

fn is_valid_interval(ms: IntervalMs) -> bool {
    VALID_INTERVALS.contains(&ms)
}

pub fn spawn(
    app: AppHandle,
    state: Arc<AppState>,
    cpu: Box<dyn CpuSource>,
    gpu: Box<dyn GpuSource>,
    mut rx: mpsc::Receiver<PollerMsg>,
) {
    tauri::async_runtime::spawn(async move {
        let sources = Arc::new(Mutex::new(SensorSources { cpu, gpu }));
        let mut interval_ms: IntervalMs = 1000;
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
                    let timeout = Duration::from_millis(u64::from(interval_ms));
                    let (cpu_reading, gpu_reading) =
                        read_with_timeout(Arc::clone(&sources), timeout).await;

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

                    let _ = app.emit(events::SENSORS, &sensor_tick);
                }
            }
        }
    });
}

async fn read_with_timeout(
    sources: Arc<Mutex<SensorSources>>,
    timeout: Duration,
) -> (CpuReading, GpuReading) {
    let sources_cpu = Arc::clone(&sources);
    let cpu_fut = tokio::time::timeout(
        timeout,
        tokio::task::spawn_blocking(move || {
            let mut guard = sources_cpu
                .lock()
                .expect("sensor sources poisoned");
            guard.cpu.read()
        }),
    );

    let sources_gpu = Arc::clone(&sources);
    let gpu_fut = tokio::time::timeout(
        timeout,
        tokio::task::spawn_blocking(move || {
            let mut guard = sources_gpu
                .lock()
                .expect("sensor sources poisoned");
            guard.gpu.read()
        }),
    );

    let (cpu_res, gpu_res) = tokio::join!(cpu_fut, gpu_fut);

    let cpu_reading = cpu_res
        .ok()
        .and_then(|join| join.ok())
        .unwrap_or_else(failed_cpu_reading);
    let gpu_reading = gpu_res
        .ok()
        .and_then(|join| join.ok())
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
    use crate::sensors::history::{empty_for_interval, push_cpu};
    use std::thread;

    struct SlowCpu {
        delay: Duration,
    }

    impl CpuSource for SlowCpu {
        fn read(&mut self) -> CpuReading {
            thread::sleep(self.delay);
            failed_cpu_reading()
        }
    }

    struct FastGpu;

    impl GpuSource for FastGpu {
        fn read(&mut self) -> GpuReading {
            failed_gpu_reading()
        }
    }

    #[test]
    fn valid_intervals_only() {
        assert!(is_valid_interval(1000));
        assert!(is_valid_interval(2000));
        assert!(is_valid_interval(5000));
        assert!(!is_valid_interval(3000));
    }

    #[tokio::test]
    async fn slow_read_times_out_within_interval_budget() {
        let sources = Arc::new(Mutex::new(SensorSources {
            cpu: Box::new(SlowCpu {
                delay: Duration::from_secs(3),
            }),
            gpu: Box::new(FastGpu),
        }));
        let timeout = Duration::from_millis(200);
        let start = std::time::Instant::now();
        let (cpu, _gpu) = read_with_timeout(sources, timeout).await;
        assert!(start.elapsed() < Duration::from_millis(800));
        assert!(cpu.snapshot.load_pct.is_none());
    }

    #[test]
    fn last_tick_snapshot_includes_history_for_reload() {
        let (tx, _rx) = mpsc::channel(8);
        let state = Arc::new(AppState {
            poller: crate::state::PollerHandle { tx },
            last_tick: std::sync::RwLock::new(None),
        });
        let mut history = empty_for_interval(1000);
        push_cpu(&mut history, 1000, Some(42.0));
        let tick = SensorTick {
            ts: 0,
            interval_ms: 1000,
            cpu: failed_cpu_reading().snapshot,
            gpu: failed_gpu_reading().snapshot,
            history,
            alerts: vec![],
        };
        *state.last_tick.write().expect("lock") = Some(tick.clone());
        let stored = state
            .last_tick
            .read()
            .expect("lock")
            .clone()
            .expect("tick");
        assert_eq!(stored.history.cpu_load, vec![Some(42.0)]);
    }

    #[test]
    fn set_interval_message_trims_history_like_poller() {
        let mut history = empty_for_interval(1000);
        for i in 0..60 {
            push_cpu(&mut history, 1000, Some(f64::from(i)));
        }
        history::on_interval_change(&mut history, 5000);
        assert_eq!(history.cpu_load.len(), 12);
    }
}