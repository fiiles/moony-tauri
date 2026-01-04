//! Exact match engine using HashMap for learned payee lookups
//!
//! This engine provides fast O(1) lookup for previously categorized payees.
//! It learns from user corrections and manual categorizations.

use std::collections::HashMap;

use super::tokenizer::{normalize_payee, simple_normalize};
use super::types::{CategorizationResult, CategorizationSource, TransactionInput};

/// HashMap-based exact payee matching engine
pub struct ExactMatchEngine {
    /// Normalized payee name -> category_id
    payee_map: HashMap<String, String>,
}

impl ExactMatchEngine {
    /// Create an empty exact match engine
    pub fn new() -> Self {
        Self {
            payee_map: HashMap::new(),
        }
    }

    /// Create from an existing payee map
    pub fn from_map(payee_map: HashMap<String, String>) -> Self {
        Self { payee_map }
    }

    /// Learn from user's manual categorization
    ///
    /// This stores the normalized payee name with its category for future lookups.
    pub fn learn(&mut self, payee: &str, category_id: &str) {
        let normalized = simple_normalize(payee);
        if !normalized.is_empty() && normalized.len() > 2 {
            self.payee_map.insert(normalized, category_id.to_string());
        }
    }

    /// Forget a learned payee (remove from map)
    pub fn forget(&mut self, payee: &str) -> bool {
        let normalized = simple_normalize(payee);
        self.payee_map.remove(&normalized).is_some()
    }

    /// Try exact match lookup for a transaction
    ///
    /// Tries to match against counterparty first, then IBAN, then description.
    /// Uses fuzzy matching with company suffix stripping.
    pub fn apply(&self, tx: &TransactionInput) -> Option<CategorizationResult> {
        // Try counterparty name first (most reliable)
        if let Some(ref counterparty) = tx.counterparty {
            if let Some(result) = self.find_match(counterparty) {
                return Some(CategorizationResult::Match {
                    category_id: result,
                    source: CategorizationSource::ExactMatch {
                        payee: counterparty.clone(),
                    },
                });
            }
        }

        // Try counterparty IBAN (for transactions without names)
        if let Some(ref iban) = tx.counterparty_iban {
            if let Some(result) = self.find_match(iban) {
                return Some(CategorizationResult::Match {
                    category_id: result,
                    source: CategorizationSource::ExactMatch {
                        payee: iban.clone(),
                    },
                });
            }
        }

        // Try description if counterparty didn't match
        if let Some(ref description) = tx.description {
            if let Some(result) = self.find_match(description) {
                return Some(CategorizationResult::Match {
                    category_id: result,
                    source: CategorizationSource::ExactMatch {
                        payee: description.clone(),
                    },
                });
            }
        }

        None
    }

    /// Find a match using both exact and fuzzy approaches
    fn find_match(&self, text: &str) -> Option<String> {
        // 1. Try exact match with simple normalization (for previously learned payees)
        let simple = simple_normalize(text);
        if let Some(category_id) = self.payee_map.get(&simple) {
            return Some(category_id.clone());
        }

        // 2. Try fuzzy match with payee normalization (strips company suffixes)
        let fuzzy = normalize_payee(text);
        if let Some(category_id) = self.payee_map.get(&fuzzy) {
            return Some(category_id.clone());
        }

        // 3. Try prefix matching: check if any learned payee starts with the fuzzy text
        //    or if the fuzzy text starts with any learned payee
        //    (handles variations like "Albert" vs "Albert CZ" vs "Albert Hypermarket")
        if fuzzy.len() >= 4 {
            for (payee, category) in &self.payee_map {
                // Check if one starts with the other
                if payee.starts_with(&fuzzy) || fuzzy.starts_with(payee) {
                    return Some(category.clone());
                }
            }
        }

        None
    }

    /// Export the payee map for persistence
    pub fn export(&self) -> HashMap<String, String> {
        self.payee_map.clone()
    }

    /// Get the number of learned payees
    pub fn len(&self) -> usize {
        self.payee_map.len()
    }

    /// Check if the engine has no learned payees
    pub fn is_empty(&self) -> bool {
        self.payee_map.is_empty()
    }

    /// Check if a specific payee is known
    pub fn knows_payee(&self, payee: &str) -> bool {
        let normalized = simple_normalize(payee);
        self.payee_map.contains_key(&normalized)
    }

    /// Get the category for a known payee
    pub fn get_category(&self, payee: &str) -> Option<&str> {
        let normalized = simple_normalize(payee);
        self.payee_map.get(&normalized).map(|s| s.as_str())
    }

    /// Merge another engine's payee map into this one
    ///
    /// Existing entries are not overwritten.
    pub fn merge(&mut self, other: &ExactMatchEngine) {
        for (payee, category) in &other.payee_map {
            self.payee_map
                .entry(payee.clone())
                .or_insert_with(|| category.clone());
        }
    }

    /// Merge with overwrite (other's entries take precedence)
    pub fn merge_overwrite(&mut self, other: &ExactMatchEngine) {
        for (payee, category) in &other.payee_map {
            self.payee_map.insert(payee.clone(), category.clone());
        }
    }
}

impl Default for ExactMatchEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_tx(description: Option<&str>, counterparty: Option<&str>) -> TransactionInput {
        TransactionInput {
            id: "tx1".into(),
            description: description.map(|s| s.into()),
            counterparty: counterparty.map(|s| s.into()),
            counterparty_iban: None,
            variable_symbol: None,
            constant_symbol: None,
            specific_symbol: None,
            amount: -500.0,
            is_credit: false,
        }
    }

    #[test]
    fn test_learn_and_apply() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("Uber Eats", "cat_dining");

        let tx = make_tx(None, Some("Uber Eats"));
        let result = engine.apply(&tx);

        assert!(result.is_some());
        match result.unwrap() {
            CategorizationResult::Match {
                category_id,
                source,
            } => {
                assert_eq!(category_id, "cat_dining");
                match source {
                    CategorizationSource::ExactMatch { payee } => {
                        assert_eq!(payee, "Uber Eats");
                    }
                    _ => panic!("Expected ExactMatch source"),
                }
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_case_insensitive() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("UBER EATS", "cat_dining");

        let tx = make_tx(None, Some("uber eats"));
        assert!(engine.apply(&tx).is_some());

        let tx = make_tx(None, Some("Uber Eats"));
        assert!(engine.apply(&tx).is_some());
    }

    #[test]
    fn test_counterparty_priority() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("Albert", "cat_groceries");
        engine.learn("Platba", "cat_other");

        // When both match, counterparty should be tried first
        let tx = make_tx(Some("Platba"), Some("Albert"));
        let result = engine.apply(&tx);

        assert!(result.is_some());
        assert_eq!(result.unwrap().category_id(), Some("cat_groceries"));
    }

    #[test]
    fn test_forget() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("Uber Eats", "cat_dining");
        assert!(engine.knows_payee("Uber Eats"));

        engine.forget("Uber Eats");
        assert!(!engine.knows_payee("Uber Eats"));
    }

    #[test]
    fn test_no_match() {
        let engine = ExactMatchEngine::new();
        let tx = make_tx(Some("Unknown merchant"), None);
        assert!(engine.apply(&tx).is_none());
    }

    #[test]
    fn test_merge() {
        let mut engine1 = ExactMatchEngine::new();
        engine1.learn("Albert", "cat_groceries");

        let mut engine2 = ExactMatchEngine::new();
        engine2.learn("Lidl", "cat_groceries");
        engine2.learn("Albert", "cat_other"); // Different category

        engine1.merge(&engine2);

        assert_eq!(engine1.get_category("Albert"), Some("cat_groceries")); // Not overwritten
        assert_eq!(engine1.get_category("Lidl"), Some("cat_groceries"));
    }

    #[test]
    fn test_export() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("Albert", "cat_groceries");
        engine.learn("Lidl", "cat_groceries");

        let exported = engine.export();
        assert_eq!(exported.len(), 2);
    }

    #[test]
    fn test_short_payee_ignored() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("AB", "cat_other"); // Too short
        assert!(engine.is_empty());
    }
}
