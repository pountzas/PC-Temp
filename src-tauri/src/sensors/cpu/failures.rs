//! Consecutive read-failure handling for individual CPU sensor fields.

pub const CONSECUTIVE_FAILURE_LIMIT: u8 = 3;

/// Tracks poll outcomes for one sensor field: holds the last good value across
/// brief gaps, then latches `None` after sustained failures until [`restart`].
#[derive(Debug, Clone)]
pub struct FailureTracker<T> {
    consecutive_failures: u8,
    latched: bool,
    last_good: Option<T>,
}

impl<T: Clone> Default for FailureTracker<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Clone> FailureTracker<T> {
    pub fn new() -> Self {
        Self {
            consecutive_failures: 0,
            latched: false,
            last_good: None,
        }
    }

    /// Clears latch and failure count (e.g. when the sensor source is recreated).
    pub fn restart(&mut self) {
        self.consecutive_failures = 0;
        self.latched = false;
        self.last_good = None;
    }

    /// Applies one poll result. `None` means the read failed for this field.
    pub fn apply_reading(&mut self, reading: Option<T>) -> Option<T> {
        if self.latched {
            return None;
        }

        match reading {
            Some(value) => {
                self.consecutive_failures = 0;
                self.last_good = Some(value.clone());
                Some(value)
            }
            None => {
                self.consecutive_failures = self.consecutive_failures.saturating_add(1);
                if self.consecutive_failures >= CONSECUTIVE_FAILURE_LIMIT {
                    self.latched = true;
                    None
                } else {
                    self.last_good.clone()
                }
            }
        }
    }

    pub fn is_latched(&self) -> bool {
        self.latched
    }

    /// Value that should appear on the snapshot after the last [`apply_reading`] in this poll.
    pub fn snapshot_value(&self) -> Option<T> {
        if self.latched {
            None
        } else {
            self.last_good.clone()
        }
    }
}

pub type OptionalReading<T> = FailureTracker<T>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn success_stores_value() {
        let mut tracker = FailureTracker::new();
        assert_eq!(tracker.apply_reading(Some(42.0)), Some(42.0));
    }

    #[test]
    fn success_resets_failure_counter() {
        let mut tracker = FailureTracker::new();
        assert_eq!(tracker.apply_reading(Some(10.0)), Some(10.0));
        assert_eq!(tracker.apply_reading(None), Some(10.0));
        assert_eq!(tracker.apply_reading(None), Some(10.0));
        assert_eq!(tracker.apply_reading(Some(20.0)), Some(20.0));
        assert_eq!(tracker.apply_reading(None), Some(20.0));
        assert!(!tracker.is_latched());
    }

    #[test]
    fn one_or_two_failures_keep_last_good() {
        let mut tracker = FailureTracker::new();
        tracker.apply_reading(Some(5));
        assert_eq!(tracker.apply_reading(None), Some(5));
        assert_eq!(tracker.apply_reading(None), Some(5));
        assert!(!tracker.is_latched());
    }

    #[test]
    fn failures_without_prior_success_stay_none_until_latch() {
        let mut tracker: FailureTracker<i32> = FailureTracker::new();
        assert_eq!(tracker.apply_reading(None), None);
        assert_eq!(tracker.apply_reading(None), None);
        assert!(!tracker.is_latched());
    }

    #[test]
    fn third_consecutive_failure_latches_none() {
        let mut tracker = FailureTracker::new();
        tracker.apply_reading(Some(1));
        assert_eq!(tracker.apply_reading(None), Some(1));
        assert_eq!(tracker.apply_reading(None), Some(1));
        assert_eq!(tracker.apply_reading(None), None);
        assert!(tracker.is_latched());
    }

    #[test]
    fn latched_tracker_ignores_later_successes() {
        let mut tracker = FailureTracker::new();
        tracker.apply_reading(Some(1));
        tracker.apply_reading(None);
        tracker.apply_reading(None);
        tracker.apply_reading(None);
        assert!(tracker.is_latched());
        assert_eq!(tracker.apply_reading(Some(99)), None);
        assert_eq!(tracker.apply_reading(Some(100)), None);
    }

    #[test]
    fn restart_clears_latch_and_allows_reads_again() {
        let mut tracker = FailureTracker::new();
        tracker.apply_reading(Some(1));
        tracker.apply_reading(None);
        tracker.apply_reading(None);
        tracker.apply_reading(None);
        assert!(tracker.is_latched());
        tracker.restart();
        assert!(!tracker.is_latched());
        assert_eq!(tracker.apply_reading(Some(2)), Some(2));
    }
}