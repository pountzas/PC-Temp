use crate::ipc::types::GpuSnapshot;
use crate::sensors::source::{GpuReading, GpuSource};
use nvml_wrapper::enum_wrappers::device::{Clock, TemperatureSensor};
use nvml_wrapper::error::NvmlError;
use nvml_wrapper::Nvml;
use std::path::PathBuf;

#[cfg(windows)]
use windows_sys::Win32::System::LibraryLoader::{
    SetDefaultDllDirectories, LOAD_LIBRARY_SEARCH_SYSTEM32,
};

pub const BYTES_PER_MIB: u64 = 1_048_576;
const MAX_TRANSIENT_FAILURES: u8 = 3;

pub fn bytes_to_mib(bytes: u64) -> u32 {
    (bytes / BYTES_PER_MIB) as u32
}

/// NVML device boundary for unit tests and the live adapter.
pub trait NvmlDeviceReadings {
    fn gpu_temperature_c(&self) -> Result<u32, NvmlError>;
    fn gpu_utilization_pct(&self) -> Result<u32, NvmlError>;
    fn graphics_clock_mhz(&self) -> Result<u32, NvmlError>;
    fn fan_speed_pct(&self) -> Result<u32, NvmlError>;
    fn memory_used_and_total_bytes(&self) -> Result<(u64, u64), NvmlError>;
}

struct LiveNvmlDevice<'a> {
    device: &'a nvml_wrapper::Device<'a>,
}

impl NvmlDeviceReadings for LiveNvmlDevice<'_> {
    fn gpu_temperature_c(&self) -> Result<u32, NvmlError> {
        self.device.temperature(TemperatureSensor::Gpu)
    }

    fn gpu_utilization_pct(&self) -> Result<u32, NvmlError> {
        Ok(self.device.utilization_rates()?.gpu)
    }

    fn graphics_clock_mhz(&self) -> Result<u32, NvmlError> {
        self.device.clock_info(Clock::Graphics)
    }

    fn fan_speed_pct(&self) -> Result<u32, NvmlError> {
        self.device.fan_speed(0)
    }

    fn memory_used_and_total_bytes(&self) -> Result<(u64, u64), NvmlError> {
        let info = self.device.memory_info()?;
        Ok((info.used, info.total))
    }
}

#[derive(Debug, Default)]
struct NumericField {
    value: Option<f64>,
    unsupported: bool,
    failure_count: u8,
}

impl NumericField {
    fn is_disabled(&self) -> bool {
        self.unsupported
    }

    fn apply_u32(&mut self, result: Result<u32, NvmlError>) -> Option<f64> {
        self.apply_numeric(result.map(|v| v as f64))
    }

    fn apply_numeric(&mut self, result: Result<f64, NvmlError>) -> Option<f64> {
        if self.unsupported {
            return None;
        }
        match result {
            Ok(v) => {
                self.failure_count = 0;
                self.value = Some(v);
                Some(v)
            }
            Err(NvmlError::NotSupported) => {
                self.unsupported = true;
                self.value = None;
                None
            }
            Err(_) => {
                self.failure_count = self.failure_count.saturating_add(1);
                if self.failure_count >= MAX_TRANSIENT_FAILURES {
                    self.value = None;
                }
                self.value
            }
        }
    }
}

#[derive(Debug, Default)]
struct MiBField {
    value: Option<u32>,
    unsupported: bool,
    failure_count: u8,
}

impl MiBField {
    fn is_disabled(&self) -> bool {
        self.unsupported
    }

    fn apply_bytes(&mut self, result: Result<u64, NvmlError>) -> Option<u32> {
        if self.unsupported {
            return None;
        }
        match result {
            Ok(bytes) => {
                self.failure_count = 0;
                let mib = bytes_to_mib(bytes);
                self.value = Some(mib);
                Some(mib)
            }
            Err(NvmlError::NotSupported) => {
                self.unsupported = true;
                self.value = None;
                None
            }
            Err(_) => {
                self.failure_count = self.failure_count.saturating_add(1);
                if self.failure_count >= MAX_TRANSIENT_FAILURES {
                    self.value = None;
                }
                self.value
            }
        }
    }
}

#[derive(Debug, Default)]
struct GpuFieldTracker {
    load_pct: NumericField,
    core_temp_c: NumericField,
    core_clock_mhz: NumericField,
    fan_pct: NumericField,
    vram_used_mib: MiBField,
    vram_total_mib: MiBField,
}

fn poll_gpu_snapshot<R: NvmlDeviceReadings>(
    reader: &R,
    name: &str,
    fields: &mut GpuFieldTracker,
) -> GpuSnapshot {
    if !fields.core_temp_c.is_disabled() {
        fields.core_temp_c.apply_u32(reader.gpu_temperature_c());
    }
    if !fields.load_pct.is_disabled() {
        fields.load_pct.apply_u32(reader.gpu_utilization_pct());
    }
    if !fields.core_clock_mhz.is_disabled() {
        fields.core_clock_mhz.apply_u32(reader.graphics_clock_mhz());
    }
    if !fields.fan_pct.is_disabled() {
        fields.fan_pct.apply_u32(reader.fan_speed_pct());
    }

    if !fields.vram_used_mib.is_disabled() || !fields.vram_total_mib.is_disabled() {
        match reader.memory_used_and_total_bytes() {
            Ok((used, total)) => {
                if !fields.vram_used_mib.is_disabled() {
                    fields.vram_used_mib.apply_bytes(Ok(used));
                }
                if !fields.vram_total_mib.is_disabled() {
                    fields.vram_total_mib.apply_bytes(Ok(total));
                }
            }
            Err(e) => {
                let not_supported = matches!(e, NvmlError::NotSupported);
                let err = || {
                    if not_supported {
                        NvmlError::NotSupported
                    } else {
                        NvmlError::Unknown
                    }
                };
                if !fields.vram_used_mib.is_disabled() {
                    fields.vram_used_mib.apply_bytes(Err(err()));
                }
                if !fields.vram_total_mib.is_disabled() {
                    fields.vram_total_mib.apply_bytes(Err(err()));
                }
            }
        }
    }

    GpuSnapshot {
        name: name.to_owned(),
        load_pct: fields.load_pct.value,
        core_temp_c: fields.core_temp_c.value,
        core_clock_mhz: fields.core_clock_mhz.value,
        fan_pct: fields.fan_pct.value,
        vram_used_mib: fields.vram_used_mib.value,
        vram_total_mib: fields.vram_total_mib.value,
    }
}

fn nvml_lib_path_for_load() -> PathBuf {
    nvml_lib_path_from(system32_dir())
}

/// Only trust an absolute System32 directory; otherwise use the fixed default.
fn nvml_lib_path_from(system_dir: Option<PathBuf>) -> PathBuf {
    match system_dir {
        Some(dir) if dir.is_absolute() => dir.join("nvml.dll"),
        _ => PathBuf::from(r"C:\Windows\System32\nvml.dll"),
    }
}

#[cfg(windows)]
fn system32_dir() -> Option<PathBuf> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::System::SystemInformation::GetSystemDirectoryW;

    let mut buf = [0u16; 260];
    // SAFETY: `buf` is valid for `buf.len()` u16 writes.
    let len = unsafe { GetSystemDirectoryW(buf.as_mut_ptr(), buf.len() as u32) } as usize;
    if len == 0 || len >= buf.len() {
        return None;
    }
    Some(PathBuf::from(OsString::from_wide(&buf[..len])))
}

#[cfg(not(windows))]
fn system32_dir() -> Option<PathBuf> {
    None
}

#[cfg(windows)]
pub(crate) fn restrict_dll_search_directories() {
    // SAFETY: plain Win32 call with a constant flag.
    let ok = unsafe { SetDefaultDllDirectories(LOAD_LIBRARY_SEARCH_SYSTEM32) };
    if ok == 0 {
        log::warn!(
            "SetDefaultDllDirectories(SYSTEM32) failed: {}",
            std::io::Error::last_os_error()
        );
    }
}

#[cfg(not(windows))]
pub(crate) fn restrict_dll_search_directories() {}

fn init_nvml() -> Result<Nvml, NvmlError> {
    let path = nvml_lib_path_for_load();
    Nvml::builder().lib_path(path.as_os_str()).init()
}

fn unavailable_snapshot() -> GpuSnapshot {
    GpuSnapshot {
        name: String::new(),
        load_pct: None,
        core_temp_c: None,
        core_clock_mhz: None,
        fan_pct: None,
        vram_used_mib: None,
        vram_total_mib: None,
    }
}

pub struct NvmlGpuSource {
    nvml: Option<Nvml>,
    name: String,
    fields: GpuFieldTracker,
}

impl NvmlGpuSource {
    pub fn new() -> Self {
        match init_nvml() {
            Ok(nvml) => {
                let name = match nvml.device_by_index(0) {
                    Ok(device) => device.name().unwrap_or_default(),
                    Err(e) => {
                        log::warn!("NVML device 0 unavailable: {e}");
                        String::new()
                    }
                };
                Self {
                    nvml: Some(nvml),
                    name,
                    fields: GpuFieldTracker::default(),
                }
            }
            Err(e) => {
                log::warn!("NVML init failed (no NVIDIA driver?): {e}");
                Self {
                    nvml: None,
                    name: String::new(),
                    fields: GpuFieldTracker::default(),
                }
            }
        }
    }
}

impl GpuSource for NvmlGpuSource {
    fn read(&mut self) -> GpuReading {
        let snapshot = match self.nvml.as_ref() {
            Some(nvml) => match nvml.device_by_index(0) {
                Ok(device) => {
                    let reader = LiveNvmlDevice { device: &device };
                    poll_gpu_snapshot(&reader, &self.name, &mut self.fields)
                }
                Err(_) => unavailable_snapshot(),
            },
            None => unavailable_snapshot(),
        };
        GpuReading { snapshot }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    #[test]
    fn nvml_loads_from_absolute_system32_path() {
        let path = nvml_lib_path_for_load();
        assert!(
            path.is_absolute(),
            "NVML must load from an absolute path, got {path:?}"
        );
        let text = path.to_string_lossy().replace('/', "\\");
        assert!(
            text.to_ascii_lowercase().ends_with("system32\\nvml.dll"),
            "expected absolute System32\\nvml.dll path, got {path:?}"
        );
    }

    #[cfg(windows)]
    #[test]
    fn nvml_path_rejects_empty_system_dir() {
        assert_eq!(
            nvml_lib_path_from(Some(PathBuf::new())),
            PathBuf::from(r"C:\Windows\System32\nvml.dll")
        );
    }

    #[cfg(windows)]
    #[test]
    fn nvml_path_rejects_relative_system_dir() {
        assert_eq!(
            nvml_lib_path_from(Some(PathBuf::from("System32"))),
            PathBuf::from(r"C:\Windows\System32\nvml.dll")
        );
    }

    #[cfg(windows)]
    #[test]
    fn nvml_path_uses_absolute_system_dir() {
        assert_eq!(
            nvml_lib_path_from(Some(PathBuf::from(r"D:\Win\System32"))),
            PathBuf::from(r"D:\Win\System32\nvml.dll")
        );
    }

    #[cfg(windows)]
    #[test]
    fn nvml_path_falls_back_when_unavailable() {
        assert_eq!(
            nvml_lib_path_from(None),
            PathBuf::from(r"C:\Windows\System32\nvml.dll")
        );
    }

    #[test]
    fn numeric_field_marks_not_supported_permanent() {
        let mut field = NumericField::default();
        field.apply_u32(Err(NvmlError::NotSupported));
        assert!(field.is_disabled());
    }

    #[test]
    fn bytes_to_mib_converts_six_gb_total() {
        let six_gib_bytes = 6_442_450_944_u64;
        assert_eq!(bytes_to_mib(six_gib_bytes), 6144);
    }

    #[test]
    fn bytes_to_mib_rounds_down_partial_mib() {
        let bytes = BYTES_PER_MIB + BYTES_PER_MIB / 2;
        assert_eq!(bytes_to_mib(bytes), 1);
    }

    struct FakeDevice {
        fan_supported: bool,
        reads: RefCell<u32>,
    }

    impl NvmlDeviceReadings for FakeDevice {
        fn gpu_temperature_c(&self) -> Result<u32, NvmlError> {
            Ok(64)
        }

        fn gpu_utilization_pct(&self) -> Result<u32, NvmlError> {
            Ok(58)
        }

        fn graphics_clock_mhz(&self) -> Result<u32, NvmlError> {
            Ok(1200)
        }

        fn fan_speed_pct(&self) -> Result<u32, NvmlError> {
            *self.reads.borrow_mut() += 1;
            if self.fan_supported {
                Ok(42)
            } else {
                Err(NvmlError::NotSupported)
            }
        }

        fn memory_used_and_total_bytes(&self) -> Result<(u64, u64), NvmlError> {
            Ok((512 * BYTES_PER_MIB, 6144 * BYTES_PER_MIB))
        }
    }

    #[test]
    fn not_supported_fan_yields_none_not_zero() {
        let device = FakeDevice {
            fan_supported: false,
            reads: RefCell::new(0),
        };
        let mut fields = GpuFieldTracker::default();
        let snap = poll_gpu_snapshot(&device, "GPU", &mut fields);
        assert_eq!(snap.fan_pct, None);
        let snap2 = poll_gpu_snapshot(&device, "GPU", &mut fields);
        assert_eq!(snap2.fan_pct, None);
        assert_eq!(
            *device.reads.borrow(),
            1,
            "unsupported field is not retried"
        );
    }

    #[test]
    fn init_failure_snapshot_is_all_none_without_panic() {
        let mut source = NvmlGpuSource {
            nvml: None,
            name: String::new(),
            fields: GpuFieldTracker::default(),
        };
        let reading = source.read();
        assert_eq!(reading.snapshot.load_pct, None);
        assert_eq!(reading.snapshot.core_temp_c, None);
        assert_eq!(reading.snapshot.fan_pct, None);
        assert_eq!(reading.snapshot.vram_used_mib, None);
        assert_eq!(reading.snapshot.vram_total_mib, None);
    }

    #[test]
    fn transient_errors_keep_last_value_then_clear_on_third_and_recover() {
        let mut f = NumericField::default();
        assert_eq!(f.apply_u32(Ok(64)), Some(64.0));
        assert_eq!(f.apply_u32(Err(NvmlError::Unknown)), Some(64.0));
        assert_eq!(f.apply_u32(Err(NvmlError::Unknown)), Some(64.0));
        assert_eq!(f.apply_u32(Err(NvmlError::Unknown)), None);
        assert!(!f.is_disabled());
        assert_eq!(f.apply_u32(Ok(65)), Some(65.0));
    }

    #[test]
    fn failure_count_saturates_without_panic() {
        let mut f = NumericField::default();
        for _ in 0..300 {
            f.apply_u32(Err(NvmlError::Unknown));
        }
        assert_eq!(f.value, None);
    }

    #[test]
    fn memory_not_supported_disables_both_vram_fields() {
        struct NoMem;

        impl NvmlDeviceReadings for NoMem {
            fn gpu_temperature_c(&self) -> Result<u32, NvmlError> {
                Ok(64)
            }

            fn gpu_utilization_pct(&self) -> Result<u32, NvmlError> {
                Ok(58)
            }

            fn graphics_clock_mhz(&self) -> Result<u32, NvmlError> {
                Ok(1200)
            }

            fn fan_speed_pct(&self) -> Result<u32, NvmlError> {
                Ok(42)
            }

            fn memory_used_and_total_bytes(&self) -> Result<(u64, u64), NvmlError> {
                Err(NvmlError::NotSupported)
            }
        }

        let mut fields = GpuFieldTracker::default();
        let snap = poll_gpu_snapshot(&NoMem, "GPU", &mut fields);
        assert_eq!(snap.vram_used_mib, None);
        assert_eq!(snap.vram_total_mib, None);
        assert!(fields.vram_used_mib.is_disabled());
        assert!(fields.vram_total_mib.is_disabled());
    }

    #[test]
    fn maps_live_readings_to_snapshot() {
        let device = FakeDevice {
            fan_supported: true,
            reads: RefCell::new(0),
        };
        let mut fields = GpuFieldTracker::default();
        let snap = poll_gpu_snapshot(&device, "NVIDIA GeForce GTX 980 Ti", &mut fields);
        assert_eq!(snap.name, "NVIDIA GeForce GTX 980 Ti");
        assert_eq!(snap.load_pct, Some(58.0));
        assert_eq!(snap.core_temp_c, Some(64.0));
        assert_eq!(snap.core_clock_mhz, Some(1200.0));
        assert_eq!(snap.fan_pct, Some(42.0));
        assert_eq!(snap.vram_used_mib, Some(512));
        assert_eq!(snap.vram_total_mib, Some(6144));
    }
}
