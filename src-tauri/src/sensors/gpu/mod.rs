mod nvml;

use crate::sensors::source::GpuSource;
use nvml::NvmlGpuSource;

pub fn create() -> Box<dyn GpuSource> {
    log::info!("sensors::gpu::create (nvml)");
    Box::new(NvmlGpuSource::new())
}