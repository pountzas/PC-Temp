use crate::config::thresholds::{HOT_C, HYSTERESIS_C, WARM_C};
use crate::ipc::types::{AlertComponent, AlertLevel, Celsius, SensorAlert};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
enum ComponentLevel {
    #[default]
    Normal,
    Warm,
    Hot,
}

#[derive(Debug, Default)]
pub struct AlertState {
    cpu: ComponentLevel,
    gpu: ComponentLevel,
}

impl AlertState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn evaluate_cpu(&mut self, temp_c: Option<Celsius>) -> Option<SensorAlert> {
        evaluate_component(AlertComponent::Cpu, &mut self.cpu, temp_c)
    }

    pub fn evaluate_gpu(&mut self, temp_c: Option<Celsius>) -> Option<SensorAlert> {
        evaluate_component(AlertComponent::Gpu, &mut self.gpu, temp_c)
    }
}

fn evaluate_component(
    component: AlertComponent,
    level: &mut ComponentLevel,
    temp_c: Option<Celsius>,
) -> Option<SensorAlert> {
    let Some(temp) = temp_c else {
        *level = ComponentLevel::Normal;
        return None;
    };

    let next = transition(*level, temp);
    *level = next;
    alert_for_level(component, next, temp)
}

fn transition(level: ComponentLevel, temp: Celsius) -> ComponentLevel {
    match level {
        ComponentLevel::Normal => {
            if temp >= HOT_C {
                ComponentLevel::Hot
            } else if temp >= WARM_C {
                ComponentLevel::Warm
            } else {
                ComponentLevel::Normal
            }
        }
        ComponentLevel::Warm => {
            if temp >= HOT_C {
                ComponentLevel::Hot
            } else if temp < WARM_C - HYSTERESIS_C {
                ComponentLevel::Normal
            } else {
                ComponentLevel::Warm
            }
        }
        ComponentLevel::Hot => {
            if temp >= HOT_C {
                ComponentLevel::Hot
            } else if temp < HOT_C - HYSTERESIS_C {
                if temp < WARM_C - HYSTERESIS_C {
                    ComponentLevel::Normal
                } else {
                    ComponentLevel::Warm
                }
            } else {
                ComponentLevel::Hot
            }
        }
    }
}

fn alert_for_level(
    component: AlertComponent,
    level: ComponentLevel,
    temp: Celsius,
) -> Option<SensorAlert> {
    let alert_level = match level {
        ComponentLevel::Normal => return None,
        ComponentLevel::Warm => AlertLevel::Warm,
        ComponentLevel::Hot => AlertLevel::Hot,
    };
    Some(SensorAlert {
        component,
        level: alert_level,
        temp_c: temp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_level(engine: &mut AlertState, temp: f64, expected: Option<AlertLevel>) {
        let alert = engine.evaluate_cpu(Some(temp));
        match expected {
            None => assert!(alert.is_none(), "expected no alert at {temp}°C"),
            Some(level) => {
                let alert = alert.expect("expected alert");
                assert_eq!(alert.level, level);
                assert_eq!(alert.temp_c, temp);
            }
        }
    }

    #[test]
    fn thresholds_used_for_hysteresis_bounds() {
        assert_eq!(WARM_C - HYSTERESIS_C, 82.0);
        assert_eq!(HOT_C - HYSTERESIS_C, 87.0);
    }

    #[test]
    fn rising_thresholds_cpu() {
        let mut engine = AlertState::new();
        assert_level(&mut engine, 84.9, None);
        assert_level(&mut engine, 85.0, Some(AlertLevel::Warm));
        assert_level(&mut engine, 89.9, Some(AlertLevel::Warm));
        assert_level(&mut engine, 90.0, Some(AlertLevel::Hot));
    }

    #[test]
    fn rising_from_normal_direct_hot_cpu() {
        let mut engine = AlertState::new();
        assert_level(&mut engine, 90.0, Some(AlertLevel::Hot));
    }

    #[test]
    fn falling_hysteresis_cpu() {
        let mut engine = AlertState::new();
        assert_level(&mut engine, 90.0, Some(AlertLevel::Hot));
        assert_level(&mut engine, 87.1, Some(AlertLevel::Hot));
        assert_level(&mut engine, 86.9, Some(AlertLevel::Warm));
        assert_level(&mut engine, 82.1, Some(AlertLevel::Warm));
        assert_level(&mut engine, 81.9, None);
    }

    #[test]
    fn falling_hot_to_normal_in_one_step_when_below_warm_clear() {
        let mut engine = AlertState::new();
        assert_level(&mut engine, 90.0, Some(AlertLevel::Hot));
        assert_level(&mut engine, 81.9, None);
    }

    #[test]
    fn null_temp_resets_and_emits_nothing() {
        let mut engine = AlertState::new();
        assert_level(&mut engine, 90.0, Some(AlertLevel::Hot));
        assert!(engine.evaluate_cpu(None).is_none());
        assert_level(&mut engine, 84.0, None);
    }

    #[test]
    fn gpu_uses_separate_state() {
        let mut engine = AlertState::new();
        assert!(engine.evaluate_gpu(Some(90.0)).is_some());
        assert!(engine.evaluate_cpu(Some(50.0)).is_none());
    }

    #[test]
    fn falling_hysteresis_gpu() {
        let mut engine = AlertState::new();
        assert!(engine.evaluate_gpu(Some(90.0)).is_some());
        assert_eq!(
            engine.evaluate_gpu(Some(87.1)).unwrap().level,
            AlertLevel::Hot
        );
        assert_eq!(
            engine.evaluate_gpu(Some(86.9)).unwrap().level,
            AlertLevel::Warm
        );
        assert_eq!(
            engine.evaluate_gpu(Some(82.1)).unwrap().level,
            AlertLevel::Warm
        );
        assert!(engine.evaluate_gpu(Some(81.9)).is_none());
    }
}
