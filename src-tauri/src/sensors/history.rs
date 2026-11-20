use crate::ipc::types::{Pct, SensorHistory};

const HISTORY_LEN: usize = 60;

pub fn empty() -> SensorHistory {
    SensorHistory {
        cpu_load: Vec::with_capacity(HISTORY_LEN),
        gpu_load: Vec::with_capacity(HISTORY_LEN),
    }
}

pub fn push_cpu(history: &mut SensorHistory, value: Option<Pct>) {
    if history.cpu_load.len() >= HISTORY_LEN {
        history.cpu_load.remove(0);
    }
    history.cpu_load.push(value);
}

pub fn push_gpu(history: &mut SensorHistory, value: Option<Pct>) {
    if history.gpu_load.len() >= HISTORY_LEN {
        history.gpu_load.remove(0);
    }
    history.gpu_load.push(value);
}