//! Czech-aware text normalization and tokenization
//!
//! This module provides text processing optimized for Czech banking transactions:
//! - Diacritics stripping (ř → r, ě → e, etc.)
//! - Stop word removal for payment context
//! - Symbol extraction (VS, SS, KS)
//! - N-gram generation for ML features

use regex::Regex;
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

/// Czech stopwords for payment context - words that don't help categorization
const CZECH_STOPWORDS: &[&str] = &[
    // Payment terms
    "platba",
    "kartou",
    "prevod",
    "prevodu",
    "transakce",
    "operace",
    // Currency
    "czk",
    "eur",
    "usd",
    "kc",
    "korun",
    // Symbols
    "vs",
    "ss",
    "ks",
    // Messages
    "zprava",
    "prijemce",
    "prichozi",
    "odchozi",
    // Common prepositions
    "z",
    "na",
    "pro",
    "od",
    "do",
    "a",
    "v",
    "ve",
    "s",
    "se",
    "k",
    "ke",
    "za",
    "pri",
    // Account terms
    "ucet",
    "uctu",
    "bankovni",
    // Articles and fillers
    "je",
    "jsou",
    "byl",
    "byla",
    "bylo",
    "bude",
    // Numbers (will be replaced with <NUM>)
    "cislo",
    // Payment types
    "inkaso",
    "trvaly",
    "prikaz",
];

/// Pre-compiled regexes for extraction
static VS_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)vs[:\s]*(\d+)").expect("Invalid VS regex"));
static SS_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)ss[:\s]*(\d+)").expect("Invalid SS regex"));
static KS_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)ks[:\s]*(\d+)").expect("Invalid KS regex"));
static NUM_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b\d{4,}\b").expect("Invalid number regex"));
#[allow(dead_code)]
static PUNCTUATION_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"[^\w\s]").expect("Invalid punctuation regex"));
static WHITESPACE_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+").expect("Invalid whitespace regex"));

/// Extracted payment symbols from transaction text
#[derive(Debug, Clone, Default)]
pub struct ExtractedSymbols {
    pub variable_symbol: Option<String>,
    pub specific_symbol: Option<String>,
    pub constant_symbol: Option<String>,
}

impl ExtractedSymbols {
    /// Check if any symbol was extracted
    pub fn has_any(&self) -> bool {
        self.variable_symbol.is_some()
            || self.specific_symbol.is_some()
            || self.constant_symbol.is_some()
    }
}

/// Normalize Czech text for ML processing and matching
///
/// This function:
/// 1. Converts to lowercase
/// 2. Extracts payment symbols (VS, SS, KS)
/// 3. Strips diacritics (NFD decomposition, filter ASCII)
/// 4. Replaces long numbers with <NUM> token
/// 5. Removes punctuation
/// 6. Removes stopwords
///
/// # Example
/// ```
/// use moony_tauri_lib::services::categorization::tokenizer::normalize_czech;
///
/// let (normalized, symbols) = normalize_czech("Příchozí platba VS:123456 Albert");
/// assert!(normalized.contains("albert"));
/// assert!(!normalized.contains("platba")); // stopword removed
/// assert_eq!(symbols.variable_symbol, Some("123456".to_string()));
/// ```
pub fn normalize_czech(text: &str) -> (String, ExtractedSymbols) {
    // 1. Lowercase
    let text = text.to_lowercase();

    // 2. Extract symbols before normalization
    let symbols = extract_symbols(&text);

    // 3. Strip diacritics (NFD decompose, keep only ASCII letters/digits/spaces)
    let normalized: String = text
        .nfd()
        .filter(|c| c.is_ascii_alphanumeric() || c.is_ascii_whitespace())
        .collect();

    // 4. Replace numeric sequences (4+ digits) with <NUM>
    let normalized = NUM_REGEX.replace_all(&normalized, "<NUM>").to_string();

    // 5. Remove punctuation (already done in step 3 by filtering)
    // 6. Normalize whitespace
    let normalized = WHITESPACE_REGEX.replace_all(&normalized, " ").to_string();

    // 7. Tokenize and remove stopwords
    let tokens: Vec<&str> = normalized
        .split_whitespace()
        .filter(|t| t.len() > 1 && !CZECH_STOPWORDS.contains(t))
        .collect();

    (tokens.join(" "), symbols)
}

/// Extract payment symbols (VS, SS, KS) from text
fn extract_symbols(text: &str) -> ExtractedSymbols {
    ExtractedSymbols {
        variable_symbol: VS_REGEX
            .captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        specific_symbol: SS_REGEX
            .captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
        constant_symbol: KS_REGEX
            .captures(text)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string()),
    }
}

/// Create a bag of n-grams (unigrams + bigrams) for ML features
///
/// # Example
/// ```
/// use moony_tauri_lib::services::categorization::tokenizer::extract_ngrams;
///
/// let ngrams = extract_ngrams("albert hypermarket praha");
/// assert!(ngrams.contains(&"albert".to_string()));
/// assert!(ngrams.contains(&"albert_hypermarket".to_string()));
/// ```
pub fn extract_ngrams(text: &str) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut ngrams = Vec::with_capacity(words.len() * 2);

    // Unigrams
    for word in &words {
        if !word.is_empty() {
            ngrams.push((*word).to_string());
        }
    }

    // Bigrams
    for window in words.windows(2) {
        ngrams.push(format!("{}_{}", window[0], window[1]));
    }

    ngrams
}

/// Simple tokenization without stopword removal (for exact matching)
pub fn simple_normalize(text: &str) -> String {
    let text = text.to_lowercase();
    let normalized: String = text
        .nfd()
        .filter(|c| c.is_ascii_alphanumeric() || c.is_ascii_whitespace())
        .collect();
    WHITESPACE_REGEX
        .replace_all(&normalized, " ")
        .trim()
        .to_string()
}

/// Czech company suffixes to strip for better payee matching
const CZECH_COMPANY_SUFFIXES: &[&str] = &[
    "s r o", "sro", "a s", "as", "spol", "k s", "ks", "v o s", "vos", "o p s", "ops", "se", "z s",
    "zs", "inc", "ltd", "gmbh", "sp z o o", "sp zoo",
];

/// Common payment prefixes often added by banks
const PAYMENT_PREFIXES: &[&str] = &[
    "platba",
    "platba kartou",
    "bezhotovostni platba",
    "prichozi platba",
    "odchozi platba",
    "prevod",
    "inkaso",
    "trvaly prikaz",
];

/// Normalize payee name for matching
///
/// This function provides more aggressive normalization for payee matching:
/// 1. Uses simple_normalize for basic normalization
/// 2. Strips common Czech company suffixes (s.r.o., a.s., etc.)
/// 3. Strips common payment prefixes from banks
///
/// # Example
/// ```
/// use moony_tauri_lib::services::categorization::tokenizer::normalize_payee;
///
/// assert_eq!(normalize_payee("ABC Company s.r.o."), "abc company");
/// assert_eq!(normalize_payee("XYZ a.s."), "xyz");
/// assert_eq!(normalize_payee("Albert CZ spol. s r.o."), "albert cz spol s ro");
/// ```
pub fn normalize_payee(text: &str) -> String {
    let mut normalized = simple_normalize(text);

    // Strip payment prefixes from the start
    for prefix in PAYMENT_PREFIXES {
        if normalized.starts_with(prefix) {
            normalized = normalized[prefix.len()..].trim_start().to_string();
        }
    }

    // Strip company suffixes from the end
    for suffix in CZECH_COMPANY_SUFFIXES {
        if normalized.ends_with(suffix) {
            normalized = normalized[..normalized.len() - suffix.len()]
                .trim_end()
                .to_string();
            break; // Only strip one suffix
        }
    }

    normalized.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_czech_strips_diacritics() {
        let (normalized, _) = normalize_czech("Příchozí platba žluťoučký kůň");
        assert!(normalized.contains("zlutoucky"));
        assert!(normalized.contains("kun"));
        // "prichozi" might be filtered as stopword variant
    }

    #[test]
    fn test_normalize_czech_removes_stopwords() {
        let (normalized, _) = normalize_czech("Platba kartou Albert Praha");
        assert!(!normalized.contains("platba"));
        assert!(!normalized.contains("kartou"));
        assert!(normalized.contains("albert"));
        assert!(normalized.contains("praha"));
    }

    #[test]
    fn test_extract_variable_symbol() {
        let (_, symbols) = normalize_czech("Pojisteni VS:1234567890 za rok 2025");
        assert_eq!(symbols.variable_symbol, Some("1234567890".to_string()));
    }

    #[test]
    fn test_extract_all_symbols() {
        let (_, symbols) = normalize_czech("Platba VS:111 SS:222 KS:333");
        assert_eq!(symbols.variable_symbol, Some("111".to_string()));
        assert_eq!(symbols.specific_symbol, Some("222".to_string()));
        assert_eq!(symbols.constant_symbol, Some("333".to_string()));
    }

    #[test]
    fn test_number_replacement() {
        let (normalized, _) = normalize_czech("Faktura 2024123456 za sluzby");
        assert!(normalized.contains("<NUM>"));
        assert!(!normalized.contains("2024123456"));
    }

    #[test]
    fn test_extract_ngrams() {
        let ngrams = extract_ngrams("albert hypermarket");
        assert!(ngrams.contains(&"albert".to_string()));
        assert!(ngrams.contains(&"hypermarket".to_string()));
        assert!(ngrams.contains(&"albert_hypermarket".to_string()));
        assert_eq!(ngrams.len(), 3);
    }

    #[test]
    fn test_simple_normalize() {
        let result = simple_normalize("  ALBERT  CZ  Praha  ");
        assert_eq!(result, "albert cz praha");
    }

    #[test]
    fn test_empty_input() {
        let (normalized, symbols) = normalize_czech("");
        assert!(normalized.is_empty());
        assert!(!symbols.has_any());
    }

    #[test]
    fn test_only_stopwords() {
        let (normalized, _) = normalize_czech("platba kartou z uctu na ucet");
        // All words are stopwords, should be mostly empty
        assert!(normalized.trim().is_empty() || normalized.trim() == "<NUM>");
    }

    #[test]
    fn test_normalize_payee_strips_sro() {
        let result = normalize_payee("ABC Company s.r.o.");
        assert_eq!(result, "abc company");
    }

    #[test]
    fn test_normalize_payee_strips_as() {
        let result = normalize_payee("XYZ a.s.");
        assert_eq!(result, "xyz");
    }

    #[test]
    fn test_normalize_payee_strips_spol() {
        let result = normalize_payee("Albert CZ spol.");
        assert_eq!(result, "albert cz");
    }

    #[test]
    fn test_normalize_payee_strips_payment_prefix() {
        let result = normalize_payee("prevod Albert");
        assert_eq!(result, "albert");
    }

    #[test]
    fn test_normalize_payee_case_insensitive() {
        let result = normalize_payee("ALBERT HYPERMARKET S.R.O.");
        assert_eq!(result, "albert hypermarket");
    }
}
