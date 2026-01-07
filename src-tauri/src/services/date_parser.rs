//! Date Parsing Service for CSV Imports
//!
//! Provides intelligent date parsing with:
//! - Time component stripping (e.g., "2024-01-15 14:30:00" → "2024-01-15")
//! - Multiple format support with fallback chain
//! - Smart format detection to distinguish DD-MM-YYYY from MM-DD-YYYY

use chrono::{Datelike, NaiveDate};

/// Detected date format family
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum DateFormatFamily {
    /// YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD (ISO standard)
    YearMonthDay,
    /// YYYY-DD-MM (non-standard year-first)
    YearDayMonth,
    /// DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY (European)
    DayMonthYear,
    /// MM-DD-YYYY, MM/DD/YYYY, MM.DD.YYYY (US)
    MonthDayYear,
}

/// Strip time component from a date-time string.
/// Handles formats like:
/// - "2024-01-15 14:30:00"
/// - "2024-01-15T14:30:00Z"
/// - "2024-01-15T14:30:00+01:00"
/// - "15.01.2024 10:00"
fn strip_time_component(date_str: &str) -> &str {
    let trimmed = date_str.trim();

    // Find the position where time component starts
    // Common separators: space, 'T' (ISO 8601)
    if let Some(space_pos) = trimmed.find(' ') {
        // Check if what follows looks like a time (starts with digit)
        let after_space = &trimmed[space_pos + 1..];
        if after_space
            .chars()
            .next()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false)
        {
            return &trimmed[..space_pos];
        }
    }

    if let Some(t_pos) = trimmed.find('T') {
        // ISO 8601 format with 'T' separator
        return &trimmed[..t_pos];
    }

    trimmed
}

/// Parse date components from a string, extracting numeric parts.
/// Returns (first, second, third) components or None if parsing fails.
fn parse_date_components(date_str: &str) -> Option<(u32, u32, u32)> {
    // Split by common separators: -, /, .
    let parts: Vec<&str> = date_str.split(['-', '/', '.']).collect();

    if parts.len() != 3 {
        return None;
    }

    let first: u32 = parts[0].trim().parse().ok()?;
    let second: u32 = parts[1].trim().parse().ok()?;
    let third: u32 = parts[2].trim().parse().ok()?;

    Some((first, second, third))
}

/// Detect the date format family from a single date string.
/// Uses heuristics to determine the most likely format.
fn detect_format_family(date_str: &str) -> Option<DateFormatFamily> {
    let (first, second, third) = parse_date_components(date_str)?;

    // Check if year is first (4-digit number)
    if (1900..=2100).contains(&first) {
        // Year-first format: YYYY-??-??
        // Determine if it's YYYY-MM-DD or YYYY-DD-MM
        if second > 12 {
            // Second component > 12, must be day → YYYY-DD-MM
            Some(DateFormatFamily::YearDayMonth)
        } else if third > 12 {
            // Third component > 12, it's invalid for a day in that position
            // This shouldn't happen for YYYY-MM-DD, so assume YYYY-MM-DD anyway
            Some(DateFormatFamily::YearMonthDay)
        } else {
            // Both ≤ 12, default to ISO standard YYYY-MM-DD
            Some(DateFormatFamily::YearMonthDay)
        }
    } else if (1900..=2100).contains(&third) {
        // Year-last format: ??-??-YYYY
        // Determine if it's DD-MM-YYYY or MM-DD-YYYY
        if first > 12 {
            // First component > 12, must be day → DD-MM-YYYY
            Some(DateFormatFamily::DayMonthYear)
        } else if second > 12 {
            // Second component > 12, must be day → MM-DD-YYYY
            Some(DateFormatFamily::MonthDayYear)
        } else {
            // Both ≤ 12, default to European DD-MM-YYYY (Czech context)
            Some(DateFormatFamily::DayMonthYear)
        }
    } else {
        // Could be 2-digit year, try to handle
        // For 2-digit years, assume year-last format
        if first > 12 {
            Some(DateFormatFamily::DayMonthYear)
        } else if second > 12 {
            Some(DateFormatFamily::MonthDayYear)
        } else {
            // Default to European
            Some(DateFormatFamily::DayMonthYear)
        }
    }
}

/// Detect the most likely date format from multiple sample strings.
/// Analyzes all samples to find a consensus format.
pub fn detect_date_format_from_samples(samples: &[&str]) -> DateFormatFamily {
    let mut year_month_day_count = 0;
    let mut year_day_month_count = 0;
    let mut day_month_year_count = 0;
    let mut month_day_year_count = 0;

    for sample in samples {
        let stripped = strip_time_component(sample);
        if let Some(format) = detect_format_family(stripped) {
            match format {
                DateFormatFamily::YearMonthDay => year_month_day_count += 1,
                DateFormatFamily::YearDayMonth => year_day_month_count += 1,
                DateFormatFamily::DayMonthYear => day_month_year_count += 1,
                DateFormatFamily::MonthDayYear => month_day_year_count += 1,
            }
        }
    }

    // Return the most common format, defaulting to European DD-MM-YYYY
    let max_count = year_month_day_count
        .max(year_day_month_count)
        .max(day_month_year_count)
        .max(month_day_year_count);

    if max_count == 0 {
        return DateFormatFamily::DayMonthYear; // Default
    }

    if year_month_day_count == max_count {
        DateFormatFamily::YearMonthDay
    } else if year_day_month_count == max_count {
        DateFormatFamily::YearDayMonth
    } else if month_day_year_count == max_count {
        DateFormatFamily::MonthDayYear
    } else {
        DateFormatFamily::DayMonthYear
    }
}

/// Parse a date string with a specific chrono format string.
/// Handles time components by stripping them first.
pub fn parse_date_with_format(date_str: &str, format: &str) -> Option<NaiveDate> {
    let stripped = strip_time_component(date_str);

    // First try the exact format
    if let Ok(date) = NaiveDate::parse_from_str(stripped, format) {
        return Some(date);
    }

    // If format includes time but our stripped version doesn't have it, try without time
    // Extract just the date portion of the format
    let date_only_format = format.split_whitespace().next().unwrap_or(format);
    if date_only_format != format {
        if let Ok(date) = NaiveDate::parse_from_str(stripped, date_only_format) {
            return Some(date);
        }
    }

    None
}

/// Parse a date string using the detected format family.
fn parse_with_format_family(date_str: &str, family: DateFormatFamily) -> Option<NaiveDate> {
    let (first, second, third) = parse_date_components(date_str)?;

    let (year, month, day) = match family {
        DateFormatFamily::YearMonthDay => {
            let year = if first < 100 { 2000 + first } else { first };
            (year, second, third)
        }
        DateFormatFamily::YearDayMonth => {
            let year = if first < 100 { 2000 + first } else { first };
            (year, third, second)
        }
        DateFormatFamily::DayMonthYear => {
            let year = if third < 100 { 2000 + third } else { third };
            (year, second, first)
        }
        DateFormatFamily::MonthDayYear => {
            let year = if third < 100 { 2000 + third } else { third };
            (year, first, second)
        }
    };

    NaiveDate::from_ymd_opt(year as i32, month, day)
}

/// Parse a date string, automatically detecting the format.
/// This is the main entry point for date parsing.
///
/// # Arguments
/// * `date_str` - The date string to parse
/// * `preferred_format` - Optional chrono format string to try first
///
/// # Returns
/// * `Some(NaiveDate)` if parsing succeeds
/// * `None` if the date cannot be parsed
pub fn parse_date(date_str: &str, preferred_format: Option<&str>) -> Option<NaiveDate> {
    let stripped = strip_time_component(date_str);

    if stripped.is_empty() {
        return None;
    }

    // Try preferred format first
    if let Some(format) = preferred_format {
        if let Some(date) = parse_date_with_format(stripped, format) {
            return Some(date);
        }
    }

    // Try common chrono formats
    let formats = [
        "%Y-%m-%d", // ISO: 2024-01-15
        "%d.%m.%Y", // European: 15.01.2024
        "%d/%m/%Y", // European slash: 15/01/2024
        "%d-%m-%Y", // European dash: 15-01-2024
        "%m/%d/%Y", // US: 01/15/2024
        "%m-%d-%Y", // US dash: 01-15-2024
        "%Y/%m/%d", // ISO slash: 2024/01/15
        "%Y.%m.%d", // ISO dot: 2024.01.15
    ];

    for format in &formats {
        if let Ok(date) = NaiveDate::parse_from_str(stripped, format) {
            // Validate that the year is plausible (1900-2100)
            // This prevents 2-digit year strings from being misinterpreted
            // e.g., "15-01-24" should not be parsed as year 15
            let year = date.year();
            if (1900..=2100).contains(&year) {
                return Some(date);
            }
        }
    }

    // Fallback to intelligent format detection
    let family = detect_format_family(stripped)?;
    parse_with_format_family(stripped, family)
}

/// Parse a date string to a Unix timestamp (seconds since epoch, midnight UTC).
/// This is a convenience function for the common use case in CSV imports.
///
/// # Arguments
/// * `date_str` - The date string to parse
/// * `preferred_format` - Optional chrono format string to try first
///
/// # Returns
/// * `Ok(i64)` - Unix timestamp if parsing succeeds
/// * `Err(String)` - Error message if parsing fails
pub fn parse_date_to_timestamp(
    date_str: &str,
    preferred_format: Option<&str>,
) -> Result<i64, String> {
    parse_date(date_str, preferred_format)
        .map(|d| {
            d.and_hms_opt(0, 0, 0)
                .expect("Valid date should have valid midnight time")
                .and_utc()
                .timestamp()
        })
        .ok_or_else(|| format!("Cannot parse date '{}'", date_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_time_component() {
        // Space separator
        assert_eq!(strip_time_component("2024-01-15 14:30:00"), "2024-01-15");
        assert_eq!(strip_time_component("15.01.2024 10:00:00"), "15.01.2024");

        // ISO 8601 with T
        assert_eq!(strip_time_component("2024-01-15T14:30:00"), "2024-01-15");
        assert_eq!(strip_time_component("2024-01-15T14:30:00Z"), "2024-01-15");
        assert_eq!(
            strip_time_component("2024-01-15T14:30:00+01:00"),
            "2024-01-15"
        );

        // No time component
        assert_eq!(strip_time_component("2024-01-15"), "2024-01-15");
        assert_eq!(strip_time_component("15.01.2024"), "15.01.2024");

        // With whitespace
        assert_eq!(strip_time_component("  2024-01-15  "), "2024-01-15");
    }

    #[test]
    fn test_parse_date_components() {
        assert_eq!(parse_date_components("2024-01-15"), Some((2024, 1, 15)));
        assert_eq!(parse_date_components("15.01.2024"), Some((15, 1, 2024)));
        assert_eq!(parse_date_components("01/15/2024"), Some((1, 15, 2024)));
        assert_eq!(parse_date_components("invalid"), None);
        assert_eq!(parse_date_components("2024-01"), None);
    }

    #[test]
    fn test_detect_format_family() {
        // Year first - ISO standard
        assert_eq!(
            detect_format_family("2024-01-15"),
            Some(DateFormatFamily::YearMonthDay)
        );
        assert_eq!(
            detect_format_family("2024/01/15"),
            Some(DateFormatFamily::YearMonthDay)
        );

        // Year first with day > 12 in second position
        assert_eq!(
            detect_format_family("2024-25-01"),
            Some(DateFormatFamily::YearDayMonth)
        );

        // European (day first) - detectable when day > 12
        assert_eq!(
            detect_format_family("15-01-2024"),
            Some(DateFormatFamily::DayMonthYear)
        );
        assert_eq!(
            detect_format_family("25.01.2024"),
            Some(DateFormatFamily::DayMonthYear)
        );

        // US (month first) - detectable when day > 12 in second position
        assert_eq!(
            detect_format_family("01-25-2024"),
            Some(DateFormatFamily::MonthDayYear)
        );
        assert_eq!(
            detect_format_family("01/31/2024"),
            Some(DateFormatFamily::MonthDayYear)
        );

        // Ambiguous - defaults to European
        assert_eq!(
            detect_format_family("01-05-2024"),
            Some(DateFormatFamily::DayMonthYear)
        );
        assert_eq!(
            detect_format_family("05/01/2024"),
            Some(DateFormatFamily::DayMonthYear)
        );
    }

    #[test]
    fn test_parse_date_with_time() {
        // Revolut format
        let result = parse_date("2024-01-15 14:30:00", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // ISO 8601
        let result = parse_date("2024-01-15T14:30:00Z", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // European with time
        let result = parse_date("15.01.2024 10:00", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));
    }

    #[test]
    fn test_parse_date_various_formats() {
        // ISO
        let result = parse_date("2024-01-15", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // European dot
        let result = parse_date("15.01.2024", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // European slash
        let result = parse_date("15/01/2024", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // European dash
        let result = parse_date("15-01-2024", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));
    }

    #[test]
    fn test_parse_date_us_format_detected() {
        // US format with day > 12 in second position
        let result = parse_date("01/31/2024", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 31).unwrap()));

        // Unambiguous US date
        let result = parse_date("12/25/2024", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 12, 25).unwrap()));
    }

    #[test]
    fn test_parse_date_with_preferred_format() {
        // Preferred format should be tried first
        let result = parse_date("15-01-2024", Some("%d-%m-%Y"));
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));

        // Even if input has time, should work with date-only format
        let result = parse_date("2024-01-15 14:30:00", Some("%Y-%m-%d"));
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));
    }

    #[test]
    fn test_parse_date_to_timestamp() {
        let result = parse_date_to_timestamp("2024-01-15", None);
        assert!(result.is_ok());
        // 2024-01-15 00:00:00 UTC = 1705276800
        assert_eq!(result.unwrap(), 1705276800);

        let result = parse_date_to_timestamp("invalid", None);
        assert!(result.is_err());
    }

    #[test]
    fn test_detect_format_from_samples() {
        // All ISO dates
        let samples = vec!["2024-01-15", "2024-02-20", "2024-03-25"];
        assert_eq!(
            detect_date_format_from_samples(&samples),
            DateFormatFamily::YearMonthDay
        );

        // Mix with unambiguous European
        let samples = vec!["15-01-2024", "25-02-2024", "31-03-2024"];
        assert_eq!(
            detect_date_format_from_samples(&samples),
            DateFormatFamily::DayMonthYear
        );

        // Mix with unambiguous US
        let samples = vec!["01-15-2024", "02-25-2024", "03-31-2024"];
        assert_eq!(
            detect_date_format_from_samples(&samples),
            DateFormatFamily::MonthDayYear
        );

        // Empty samples default to European
        let samples: Vec<&str> = vec![];
        assert_eq!(
            detect_date_format_from_samples(&samples),
            DateFormatFamily::DayMonthYear
        );
    }

    #[test]
    fn test_two_digit_year() {
        // Two-digit year with unambiguous day
        let result = parse_date("15-01-24", None);
        assert_eq!(result, Some(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()));
    }
}
