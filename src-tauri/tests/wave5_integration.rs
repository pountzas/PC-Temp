//! Cross-module integration tests for HW-21 (issue #22).

use pc_temp_lib::integration_test::{
    self, poller, settings, AlertComponent, AlertLevel, PollerMsg, SensorTick,
};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

static POLLER_SETTINGS_TEST_LOCK: Mutex<()> = Mutex::new(());

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("crate root")
        .join("src/ipc/fixtures")
        .join(name)
}

fn gpu_alert_level(tick: &SensorTick) -> Option<AlertLevel> {
    tick.alerts
        .iter()
        .find(|a| a.component == AlertComponent::Gpu)
        .map(|a| a.level)
}

#[test]
fn temp_settings_store_hydrates_interval_ms() {
    let (dir, hydrated) = settings::temp_dir_with_interval(5000);
    assert_eq!(hydrated.interval_ms, 5000);
    let on_disk = settings::hydrate_from_temp_store(&dir);
    assert_eq!(on_disk.interval_ms, 5000);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn null_readings_survive_fixture_json_round_trip() {
    let raw = fs::read_to_string(fixture_path("no-pawnio.json")).expect("read no-pawnio");
    let tick: SensorTick = serde_json::from_str(&raw).expect("deserialize no-pawnio SensorTick");
    assert!(tick.cpu.package_temp_c.is_none());
    let json = serde_json::to_string(&tick).expect("serialize");
    assert!(json.contains(r#""packageTempC":null"#));
    let again: SensorTick = serde_json::from_str(&json).expect("re-deserialize");
    assert!(again.cpu.package_temp_c.is_none());
}

#[test]
fn gpu_alert_thresholds_warn_hot_and_hysteresis() {
    let mut engine = integration_test::AlertState::new();
    let warm = engine.evaluate_gpu(Some(85.0)).expect("85 °C should warn");
    assert_eq!(warm.component, AlertComponent::Gpu);
    assert_eq!(warm.level, AlertLevel::Warm);

    let hot = engine
        .evaluate_gpu(Some(90.0))
        .expect("90 °C should be hot");
    assert_eq!(hot.level, AlertLevel::Hot);

    let still_hot = engine
        .evaluate_gpu(Some(87.1))
        .expect("above 87 °C clear band stays hot");
    assert_eq!(still_hot.level, AlertLevel::Hot);

    let warm_again = engine
        .evaluate_gpu(Some(86.9))
        .expect("below 87 °C clears hot");
    assert_eq!(warm_again.level, AlertLevel::Warm);

    assert!(engine.evaluate_gpu(Some(81.9)).is_none());
}

#[tokio::test(start_paused = true)]
async fn poller_interval_change_1000_to_5000_shrinks_history_to_twelve() {
    let _guard = POLLER_SETTINGS_TEST_LOCK
        .lock()
        .expect("poller settings test lock");
    let (dir, hydrated) = settings::temp_dir_with_interval(1000);
    settings::seed_memory(hydrated);

    let state = poller::test_state();
    let state_loop = Arc::clone(&state);
    let (tx, rx) = mpsc::channel(8);

    let handle = tokio::spawn(async move {
        poller::run_default_poller_loop(state_loop, rx, |_| {}).await;
    });

    poller::advance_interval_ticks(60).await;
    let before = poller::last_tick(&state).expect("tick before interval change");
    assert_eq!(before.interval_ms, 1000);
    assert_eq!(before.history.cpu_load.len(), 60);
    assert_eq!(before.history.gpu_load.len(), 60);

    tx.send(PollerMsg::SetInterval(5000)).await.unwrap();
    for _ in 0..5 {
        poller::advance_interval_ticks(5).await;
        if poller::last_tick(&state).map(|t| t.interval_ms) == Some(5000) {
            break;
        }
    }

    let tick = poller::last_tick(&state).expect("tick after interval change");
    assert_eq!(tick.interval_ms, 5000);
    assert_eq!(tick.history.cpu_load.len(), 12);
    assert_eq!(tick.history.gpu_load.len(), 12);

    handle.abort();
    let _ = handle.await;
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test(start_paused = true)]
async fn poller_gpu_alert_hysteresis_through_mock_source() {
    let _guard = POLLER_SETTINGS_TEST_LOCK
        .lock()
        .expect("poller settings test lock");
    let state = poller::test_state();
    let state_loop = Arc::clone(&state);
    let (tx, rx) = mpsc::channel(8);
    let gpu = poller::SteppedGpu::new(vec![
        Some(85.0),
        Some(90.0),
        Some(87.1),
        Some(86.9),
    ]);

    let handle = tokio::spawn(async move {
        poller::run_poller_with_gpu(state_loop, gpu, rx, |_| {}).await;
    });

    poller::wait_for_tick(&state, |t| t.gpu.core_temp_c == Some(85.0)).await;
    assert_eq!(gpu_alert_level(&poller::last_tick(&state).unwrap()), Some(AlertLevel::Warm));

    poller::advance_interval_ticks(1).await;
    poller::wait_for_tick(&state, |t| t.gpu.core_temp_c == Some(90.0)).await;
    assert_eq!(gpu_alert_level(&poller::last_tick(&state).unwrap()), Some(AlertLevel::Hot));

    poller::advance_interval_ticks(1).await;
    poller::wait_for_tick(&state, |t| t.gpu.core_temp_c == Some(87.1)).await;
    assert_eq!(gpu_alert_level(&poller::last_tick(&state).unwrap()), Some(AlertLevel::Hot));

    poller::advance_interval_ticks(1).await;
    poller::wait_for_tick(&state, |t| t.gpu.core_temp_c == Some(86.9)).await;
    assert_eq!(gpu_alert_level(&poller::last_tick(&state).unwrap()), Some(AlertLevel::Warm));

    drop(tx);
    handle.abort();
    let _ = handle.await;
}