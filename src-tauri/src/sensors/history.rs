use crate::ipc::types::{IntervalMs, Pct, SensorHistory};

pub fn capacity_for_interval(interval_ms: IntervalMs) -> usize {
    usize::try_from(60_000 / interval_ms).unwrap_or(0)
}

pub fn empty() -> SensorHistory {
    empty_for_interval(1000)
}

pub fn empty_for_interval(interval_ms: IntervalMs) -> SensorHistory {
    let cap = capacity_for_interval(interval_ms);
    SensorHistory {
        cpu_load: Vec::with_capacity(cap),
        gpu_load: Vec::with_capacity(cap),
    }
}

pub fn on_interval_change(history: &mut SensorHistory, new_interval_ms: IntervalMs) {
    let new_cap = capacity_for_interval(new_interval_ms);
    trim_newest_fit(&mut history.cpu_load, new_cap);
    trim_newest_fit(&mut history.gpu_load, new_cap);
}

fn trim_newest_fit(series: &mut Vec<Option<Pct>>, cap: usize) {
    if series.len() > cap {
        let start = series.len() - cap;
        series.drain(0..start);
    }
}

pub fn push_cpu(history: &mut SensorHistory, interval_ms: IntervalMs, value: Option<Pct>) {
    push_series(&mut history.cpu_load, interval_ms, value);
}

pub fn push_gpu(history: &mut SensorHistory, interval_ms: IntervalMs, value: Option<Pct>) {
    push_series(&mut history.gpu_load, interval_ms, value);
}

fn push_series(series: &mut Vec<Option<Pct>>, interval_ms: IntervalMs, value: Option<Pct>) {
    let cap = capacity_for_interval(interval_ms);
    if series.len() >= cap {
        series.remove(0);
    }
    series.push(value);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_matches_interval() {
        assert_eq!(capacity_for_interval(1000), 60);
        assert_eq!(capacity_for_interval(2000), 30);
        assert_eq!(capacity_for_interval(5000), 12);
    }

    #[test]
    fn ring_keeps_newest_at_capacity() {
        let mut history = empty_for_interval(1000);
        for i in 0..65 {
            push_cpu(&mut history, 1000, Some(f64::from(i)));
        }
        assert_eq!(history.cpu_load.len(), 60);
        assert_eq!(history.cpu_load[0], Some(5.0));
        assert_eq!(history.cpu_load[59], Some(64.0));
    }

    #[test]
    fn interval_change_keeps_newest_samples() {
        let mut history = empty_for_interval(1000);
        for i in 0..60 {
            push_cpu(&mut history, 1000, Some(f64::from(i)));
        }
        on_interval_change(&mut history, 5000);
        assert_eq!(history.cpu_load.len(), 12);
        assert_eq!(history.cpu_load[0], Some(48.0));
        assert_eq!(history.cpu_load[11], Some(59.0));
    }

    #[test]
    fn interval_change_noop_when_under_capacity() {
        let mut history = empty_for_interval(5000);
        push_cpu(&mut history, 5000, Some(7.0));
        on_interval_change(&mut history, 1000);
        assert_eq!(history.cpu_load, vec![Some(7.0)]);
    }

    #[test]
    fn failed_sample_pushes_null() {
        let mut history = empty_for_interval(1000);
        push_cpu(&mut history, 1000, None);
        assert_eq!(history.cpu_load, vec![None]);
    }
}