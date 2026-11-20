use crate::sensors::source::{GpuSource, MockGpu};

pub fn create() -> Box<dyn GpuSource> {
    log::info!("sensors::gpu::create (mock)");
    Box::new(MockGpu::new())
}