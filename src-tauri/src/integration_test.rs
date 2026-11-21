//! Cross-crate integration test surface (debug / test builds only).

pub use crate::ipc::types::{
    AlertComponent, AlertLevel, CpuSnapshot, GpuSnapshot, IntervalMs, SensorAlert, SensorTick,
    Settings,
};
pub use crate::sensors::alerts::AlertState;
pub use crate::sensors::history;
pub use crate::sensors::source::{CpuReading, CpuSource, GpuReading, GpuSource, MockCpu, MockGpu};
pub use crate::settings::test_support as settings;
pub use crate::state::{AppState, PollerHandle, PollerMsg};

pub mod poller {
    pub use crate::sensors::poller::test_support::{
        advance_interval_ticks, last_tick, run_default_poller_loop, run_poller_with_gpu,
        test_state, wait_for_tick, SteppedGpu,
    };
}
