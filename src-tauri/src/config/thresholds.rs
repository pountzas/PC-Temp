pub const WARM_C: f64 = 85.0;
pub const HOT_C: f64 = 90.0;
pub const HYSTERESIS_C: f64 = 3.0;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn thresholds_match_spec() {
        assert_eq!(WARM_C, 85.0);
        assert_eq!(HOT_C, 90.0);
        assert_eq!(HYSTERESIS_C, 3.0);
    }
}
