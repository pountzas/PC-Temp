pub mod thresholds;

pub const PRODUCT_NAME: &str = "PC-Temp";

#[cfg(test)]
mod tests {
    use super::PRODUCT_NAME;

    #[test]
    fn product_name_matches_spec() {
        assert_eq!(PRODUCT_NAME, "PC-Temp");
    }
}