//! Currency conversion service
//!
//! Handles exchange rate caching and currency conversion
//! Base currency is CZK

use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::RwLock;

lazy_static! {
    /// Exchange rates relative to CZK (how many CZK = 1 unit of currency)
    /// These rates convert X CURRENCY to CZK via: amount * rate
    /// Starts empty - will be populated from database on startup, then updated from ECB
    static ref EXCHANGE_RATES: RwLock<HashMap<String, f64>> = {
        let mut m = HashMap::new();
        // Only CZK rate is hardcoded (1:1 conversion)
        m.insert("CZK".to_string(), 1.0);
        RwLock::new(m)
    };

    /// Timestamp when exchange rates were last fetched (Unix timestamp in seconds)
    static ref EXCHANGE_RATES_FETCHED_AT: RwLock<Option<i64>> = RwLock::new(None);
}

/// Convert an amount from a currency to CZK
#[allow(dead_code)]
pub fn convert_to_czk(amount: f64, currency: &str) -> f64 {
    let currency = currency.to_uppercase();
    if currency == "CZK" {
        return amount;
    }

    let rates = EXCHANGE_RATES.read().expect("Exchange rates lock poisoned");
    let rate = rates.get(&currency).copied().unwrap_or(1.0);
    amount * rate
}

/// Convert an amount from CZK to another currency
#[allow(dead_code)]
pub fn convert_from_czk(amount: f64, currency: &str) -> f64 {
    let currency = currency.to_uppercase();
    if currency == "CZK" {
        return amount;
    }

    let rates = EXCHANGE_RATES.read().expect("Exchange rates lock poisoned");
    let rate = rates.get(&currency).copied().unwrap_or(1.0);
    if rate == 0.0 {
        return amount;
    }
    amount / rate
}

/// Convert an amount from one currency to another (via CZK as intermediary)
/// Example: convert_between(100.0, "EUR", "USD") converts 100 EUR to USD
#[allow(dead_code)]
pub fn convert_between(amount: f64, from_currency: &str, to_currency: &str) -> f64 {
    let from = from_currency.to_uppercase();
    let to = to_currency.to_uppercase();

    // If same currency, no conversion needed
    if from == to {
        return amount;
    }

    // Convert to CZK first, then to target currency
    let amount_in_czk = convert_to_czk(amount, &from);
    convert_from_czk(amount_in_czk, &to)
}

/// Update exchange rates in memory (called after fetching from ECB or loading from DB)
pub fn update_exchange_rates(new_rates: HashMap<String, f64>) {
    let mut rates = EXCHANGE_RATES
        .write()
        .expect("Exchange rates lock poisoned");
    for (currency, rate) in new_rates {
        rates.insert(currency, rate);
    }
}

/// Update the fetched_at timestamp
pub fn set_exchange_rates_fetched_at(timestamp: i64) {
    let mut fetched_at = EXCHANGE_RATES_FETCHED_AT
        .write()
        .expect("Exchange rates fetched_at lock poisoned");
    *fetched_at = Some(timestamp);
}

/// Get the timestamp when exchange rates were last fetched
pub fn get_exchange_rates_fetched_at() -> Option<i64> {
    let fetched_at = EXCHANGE_RATES_FETCHED_AT
        .read()
        .expect("Exchange rates fetched_at lock poisoned");
    *fetched_at
}

/// Get current exchange rate for a currency (to CZK)
#[allow(dead_code)]
pub fn get_exchange_rate(currency: &str) -> f64 {
    let rates = EXCHANGE_RATES.read().expect("Exchange rates lock poisoned");
    rates.get(currency).copied().unwrap_or(1.0)
}

/// Get all current exchange rates
pub fn get_all_rates() -> HashMap<String, f64> {
    let rates = EXCHANGE_RATES.read().expect("Exchange rates lock poisoned");
    rates.clone()
}

/// Load exchange rates from database on startup
/// This ensures we have rates available even when offline
pub fn load_rates_from_db(conn: &rusqlite::Connection) -> crate::error::Result<()> {
    // Check if exchange_rates table exists
    let table_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='exchange_rates'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .map(|count| count > 0)
        .unwrap_or(false);

    if !table_exists {
        println!("[CURRENCY] exchange_rates table does not exist yet, skipping load");
        return Ok(());
    }

    let mut stmt = conn.prepare("SELECT currency, rate, fetched_at FROM exchange_rates")?;
    let mut rates = HashMap::new();
    let mut oldest_fetched_at: Option<i64> = None;

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, f64>(1)?,
            row.get::<_, i64>(2)?,
        ))
    })?;

    for row in rows.flatten() {
        let (currency, rate, fetched_at) = row;
        rates.insert(currency, rate);

        // Track the most recent fetch time
        match oldest_fetched_at {
            None => oldest_fetched_at = Some(fetched_at),
            Some(existing) => {
                if fetched_at > existing {
                    oldest_fetched_at = Some(fetched_at);
                }
            }
        }
    }

    if !rates.is_empty() {
        println!(
            "[CURRENCY] Loaded {} exchange rates from database",
            rates.len()
        );
        update_exchange_rates(rates);

        if let Some(ts) = oldest_fetched_at {
            set_exchange_rates_fetched_at(ts);
        }
    } else {
        println!("[CURRENCY] No exchange rates in database, will fetch from ECB");
    }

    Ok(())
}

/// Save exchange rates to database for offline use
pub fn save_rates_to_db(
    conn: &rusqlite::Connection,
    rates: &HashMap<String, f64>,
) -> crate::error::Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as i64;

    for (currency, rate) in rates {
        conn.execute(
            "INSERT INTO exchange_rates (currency, rate, fetched_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(currency) DO UPDATE SET rate = ?2, fetched_at = ?3",
            rusqlite::params![currency, rate, now],
        )?;
    }

    println!(
        "[CURRENCY] Saved {} exchange rates to database",
        rates.len()
    );
    set_exchange_rates_fetched_at(now);

    Ok(())
}

/// Fetch exchange rates from ECB API
/// Returns rates relative to CZK
pub async fn fetch_ecb_rates() -> crate::error::Result<HashMap<String, f64>> {
    // ECB provides rates relative to EUR
    // We need to convert them to be relative to CZK

    let url = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

    let response = reqwest::get(url).await?;
    let body = response.text().await?;

    let mut rates = HashMap::new();
    rates.insert("CZK".to_string(), 1.0);

    // Parse XML response to extract rates
    // ECB format: <Cube currency="USD" rate="1.0843"/>

    // Find CZK rate first (CZK per 1 EUR)
    let czk_rate = extract_rate(&body, "CZK").unwrap_or(25.0);
    rates.insert("EUR".to_string(), czk_rate);

    // Extract ALL currencies from the ECB XML response
    let all_currencies = extract_all_currencies(&body);
    for currency in all_currencies {
        if currency != "CZK" {
            if let Some(rate_vs_eur) = extract_rate(&body, &currency) {
                // rate_vs_eur is how many units of currency per 1 EUR
                // We want how many CZK per 1 unit of currency
                // 1 EUR = rate_vs_eur USD = czk_rate CZK
                // So 1 USD = czk_rate / rate_vs_eur CZK
                let rate_vs_czk = czk_rate / rate_vs_eur;
                rates.insert(currency, rate_vs_czk);
            }
        }
    }

    // Update global rates
    update_exchange_rates(rates.clone());

    // Update fetched_at timestamp
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("Time went backwards")
        .as_secs() as i64;
    set_exchange_rates_fetched_at(now);

    Ok(rates)
}

/// Extract all currency codes from ECB XML response
fn extract_all_currencies(xml: &str) -> Vec<String> {
    let mut currencies = Vec::new();

    // Find all occurrences of currency="XXX" or currency='XXX'
    let mut search_start = 0;
    while let Some(pos) = xml[search_start..].find("currency=") {
        let abs_pos = search_start + pos;
        let after = &xml[abs_pos + 9..]; // Skip "currency="

        // Determine quote character
        let quote_char = after.chars().next();
        if let Some(q) = quote_char {
            if q == '"' || q == '\'' {
                let after_quote = &after[1..]; // Skip opening quote
                if let Some(end_pos) = after_quote.find(q) {
                    let currency = after_quote[..end_pos].to_string();
                    if currency.len() == 3
                        && currency.chars().all(|c| c.is_ascii_uppercase())
                        && !currencies.contains(&currency)
                    {
                        currencies.push(currency);
                    }
                }
            }
        }
        search_start = abs_pos + 10; // Move past this occurrence
    }

    currencies
}

/// Extract rate from ECB XML response
fn extract_rate(xml: &str, currency: &str) -> Option<f64> {
    // Try double quotes first: currency="USD"
    let mut pos = xml.find(&format!("currency=\"{}\"", currency));

    // If not found, try single quotes: currency='USD'
    if pos.is_none() {
        pos = xml.find(&format!("currency='{}'", currency));
    }

    if let Some(p) = pos {
        let after = &xml[p..];

        // Try double quotes for rate: rate="1.23"
        // Check finding it relatively close to the currency to avoid reading a different line
        // But the XML structure <Cube currency='...' rate='...'/> is consistent
        if let Some(rate_start) = after.find("rate=\"") {
            // Ensure this rate belongs to this currency (is close)
            // A simple check is that it should be within < 50 chars usually
            if rate_start < 50 {
                let rate_str = &after[rate_start + 6..];
                if let Some(rate_end) = rate_str.find('"') {
                    let rate_value = &rate_str[..rate_end];
                    return rate_value.parse().ok();
                }
            }
        }

        // Try single quotes for rate: rate='1.23'
        if let Some(rate_start) = after.find("rate='") {
            if rate_start < 50 {
                let rate_str = &after[rate_start + 6..];
                if let Some(rate_end) = rate_str.find('\'') {
                    let rate_value = &rate_str[..rate_end];
                    return rate_value.parse().ok();
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_to_czk() {
        // CZK to CZK should be identity
        let czk = convert_to_czk(100.0, "CZK");
        assert_eq!(czk, 100.0);
    }

    #[test]
    fn test_currency_case_sensitivity() {
        // Case sensitivity test - both should work the same
        let val_upper = convert_to_czk(100.0, "CZK");
        let val_lower = convert_to_czk(100.0, "czk");

        assert_eq!(
            val_upper, val_lower,
            "Currency conversion should be case insensitive"
        );
    }
}
