use crate::sensors::source::{CpuSource, MockCpu};

pub fn create() -> Box<dyn CpuSource> {
    log::info!("sensors::cpu::create (mock)");
    Box::new(MockCpu::new())
}