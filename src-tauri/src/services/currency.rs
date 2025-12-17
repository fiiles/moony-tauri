//! Currency conversion service
//!
//! Handles exchange rate caching and currency conversion
//! Base currency is CZK

use lazy_static::lazy_static;
use std::collections::HashMap;
use std::sync::RwLock;

lazy_static! {
    /// Exchange rates relative to CZK (how many units of currency = 1 CZK)
    /// These are inverted rates: to convert X USD to CZK, do X * RATES["USD"]
    static ref EXCHANGE_RATES: RwLock<HashMap<String, f64>> = {
        let mut m = HashMap::new();
        // Default rates (will be updated from ECB)
        m.insert("CZK".to_string(), 1.0);
        m.insert("EUR".to_string(), 25.0);    // 1 EUR = 25 CZK
        m.insert("USD".to_string(), 23.0);    // 1 USD = 23 CZK
        m.insert("GBP".to_string(), 29.0);    // 1 GBP = 29 CZK
        m.insert("CHF".to_string(), 26.0);    // 1 CHF = 26 CZK
        m.insert("JPY".to_string(), 0.15);    // 1 JPY = 0.15 CZK
        m.insert("CNY".to_string(), 3.2);     // 1 CNY = 3.2 CZK
        m.insert("HKD".to_string(), 2.9);     // 1 HKD = 2.9 CZK
        RwLock::new(m)
    };
}

/// Convert an amount from a currency to CZK
#[allow(dead_code)]
pub fn convert_to_czk(amount: f64, currency: &str) -> f64 {
    if currency == "CZK" {
        return amount;
    }

    let rates = EXCHANGE_RATES.read().unwrap();
    let rate = rates.get(currency).copied().unwrap_or(1.0);
    amount * rate
}

/// Convert an amount from CZK to another currency
#[allow(dead_code)]
pub fn convert_from_czk(amount: f64, currency: &str) -> f64 {
    if currency == "CZK" {
        return amount;
    }

    let rates = EXCHANGE_RATES.read().unwrap();
    let rate = rates.get(currency).copied().unwrap_or(1.0);
    if rate == 0.0 {
        return amount;
    }
    amount / rate
}

/// Update exchange rates (called after fetching from ECB)
pub fn update_exchange_rates(new_rates: HashMap<String, f64>) {
    let mut rates = EXCHANGE_RATES.write().unwrap();
    for (currency, rate) in new_rates {
        rates.insert(currency, rate);
    }
}

/// Get current exchange rate for a currency (to CZK)
#[allow(dead_code)]
pub fn get_exchange_rate(currency: &str) -> f64 {
    let rates = EXCHANGE_RATES.read().unwrap();
    rates.get(currency).copied().unwrap_or(1.0)
}

/// Get all current exchange rates
pub fn get_all_rates() -> HashMap<String, f64> {
    let rates = EXCHANGE_RATES.read().unwrap();
    rates.clone()
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

    // Convert other currencies through EUR
    let currencies = ["USD", "GBP", "CHF", "JPY", "CNY", "HKD"];
    for currency in currencies {
        if let Some(rate_vs_eur) = extract_rate(&body, currency) {
            // rate_vs_eur is how many units of currency per 1 EUR
            // We want how many CZK per 1 unit of currency
            // 1 EUR = rate_vs_eur USD = czk_rate CZK
            // So 1 USD = czk_rate / rate_vs_eur CZK
            let rate_vs_czk = czk_rate / rate_vs_eur;
            rates.insert(currency.to_string(), rate_vs_czk);
        }
    }

    // Update global rates
    update_exchange_rates(rates.clone());

    Ok(rates)
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
        // Using default rates
        let czk = convert_to_czk(100.0, "CZK");
        assert_eq!(czk, 100.0);

        let czk = convert_to_czk(100.0, "EUR");
        assert_eq!(czk, 2500.0); // 100 EUR * 25 = 2500 CZK
    }

    #[test]
    fn test_convert_from_czk() {
        let eur = convert_from_czk(2500.0, "EUR");
        assert_eq!(eur, 100.0); // 2500 CZK / 25 = 100 EUR
    }
}
