//! Cross-module integration tests for HW-21 (issue #22).

use pc_temp_lib::integration_test::{
    self, poller, settings, AlertComponent, AlertLevel, PollerMsg, SensorTick, Settings,
};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::mpsc;

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("crate root")
        .join("src/ipc/fixtures")
        .join(name)
}

#[test]
fn temp_settings_store_hydrates_interval_ms() {
    let (dir, hydrated) = settings::temp_dir_with_interval(5000);
    assert_eq!(hydrated.interval_ms, 5000);
    let on_disk = settings::hydrate_from_temp_store(&dir);
    assert_eq!(on_disk.interval_ms, 5000);
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
    let mut base = Settings::default_v1();
    base.interval_ms = 1000;
    settings::seed_memory(base);

    let state = poller::test_state();
    let state_loop = Arc::clone(&state);
    let (tx, rx) = mpsc::channel(8);

    let handle = tokio::spawn(async move {
        poller::run_default_poller_loop(state_loop, rx, |_| {}).await;
    });

    poller::advance_interval_ticks(60).await;
    tx.send(PollerMsg::SetInterval(5000)).await.unwrap();
    for _ in 0..5 {
        poller::advance_interval_ticks(5).await;
        if poller::last_tick(&state).map(|t| t.interval_ms) == Some(5000) {
            break;
        }
    }

    let tick = poller::last_tick(&state).expect("tick after interval change");
    assert_eq!(tick.interval_ms, 5000);
    assert!(tick.history.cpu_load.len() <= 12);
    assert!(tick.history.gpu_load.len() <= 12);

    handle.abort();
    let _ = handle.await;
}

#[tokio::test(start_paused = true)]
async fn poller_emits_gpu_hot_alert_from_mock_source() {
    let state = poller::test_state();
    let state_loop = Arc::clone(&state);
    let (tx, rx) = mpsc::channel(8);
    let gpu = poller::SteppedGpu::new(vec![Some(90.0)]);

    let handle = tokio::spawn(async move {
        poller::run_poller_with_gpu(state_loop, gpu, rx, |_| {}).await;
    });

    poller::wait_for_tick(&state, |t| t.gpu.core_temp_c == Some(90.0)).await;

    let tick = poller::last_tick(&state).expect("tick with gpu alerts");
    assert!(
        tick.alerts
            .iter()
            .any(|a| { a.component == AlertComponent::Gpu && a.level == AlertLevel::Hot }),
        "poller should surface a hot GPU alert at 90 °C"
    );

    drop(tx);
    handle.abort();
    let _ = handle.await;
}
