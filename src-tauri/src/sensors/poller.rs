use crate::ipc::events;
use crate::ipc::types::{IntervalMs, SensorTick};
use crate::sensors::alerts;
use crate::sensors::history::{self, empty};
use crate::sensors::source::{CpuSource, GpuSource};
use crate::state::{AppState, PollerMsg};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;
use tokio::time;

pub fn spawn(
    app: AppHandle,
    state: Arc<AppState>,
    mut cpu: Box<dyn CpuSource>,
    mut gpu: Box<dyn GpuSource>,
    mut rx: mpsc::Receiver<PollerMsg>,
) {
    tauri::async_runtime::spawn(async move {
        let mut interval_ms: IntervalMs = crate::settings::get().interval_ms;
        let mut sensor_history = empty();
        let mut tick = time::interval(Duration::from_millis(u64::from(interval_ms)));
        tick.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Some(PollerMsg::SetInterval(next)) => {
                            interval_ms = next;
                            tick = time::interval(Duration::from_millis(u64::from(interval_ms)));
                            tick.set_missed_tick_behavior(time::MissedTickBehavior::Skip);
                        }
                        None => break,
                    }
                }
                _ = tick.tick() => {
                    let cpu_reading = cpu.read();
                    let gpu_reading = gpu.read();
                    history::push_cpu(&mut sensor_history, cpu_reading.snapshot.load_pct);
                    history::push_gpu(&mut sensor_history, gpu_reading.snapshot.load_pct);

                    let mut alert_list = Vec::new();
                    if let Some(alert) = alerts::evaluate(
                        crate::ipc::types::AlertComponent::Cpu,
                        cpu_reading.snapshot.package_temp_c,
                    ) {
                        alert_list.push(alert);
                    }
                    if let Some(alert) = alerts::evaluate(
                        crate::ipc::types::AlertComponent::Gpu,
                        gpu_reading.snapshot.core_temp_c,
                    ) {
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

fn chrono_like_now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}