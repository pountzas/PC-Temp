use crate::config::thresholds::{HOT_C, WARM_C};
use crate::ipc::types::{AlertComponent, AlertLevel, Celsius, SensorAlert};

pub fn evaluate(component: AlertComponent, temp_c: Option<Celsius>) -> Option<SensorAlert> {
    let temp = temp_c?;
    let level = if temp >= HOT_C {
        AlertLevel::Hot
    } else if temp >= WARM_C {
        AlertLevel::Warm
    } else {
        return None;
    };
    Some(SensorAlert {
        component,
        level,
        temp_c: temp,
    })
}