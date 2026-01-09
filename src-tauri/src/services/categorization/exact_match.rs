//! Hierarchical exact match engine for learned payee lookups
//!
//! This engine provides cascading lookups with prioritized matching:
//! 1. iban_only_default: iban only (general IBAN rule)
//! 2. payee_default: payee only (general payee rule)
//! 3. Partial IBAN: for suggestions

use std::collections::HashMap;

use super::tokenizer::simple_normalize;
use super::types::{CategorizationResult, CategorizationSource, TransactionInput};

/// Key prefix for different lookup types
const KEY_PAYEE_DEFAULT: &str = "payee_default:";
/// IBAN-only default (no payee) - general rule for transactions with only IBAN
const KEY_IBAN_ONLY_DEFAULT: &str = "iban_only_default:";
const KEY_IBAN_PARTIAL: &str = "iban_partial:";

/// Hierarchical exact match engine with cascading defaults
///
/// Matching priority (most specific first):
/// 1. iban_only_default: iban only (IBAN takes priority over payee!)
/// 2. payee_default: payee only
/// 3. Partial IBAN: for suggestions when only iban matches
pub struct ExactMatchEngine {
    /// Unified map with prefixed keys for different lookup types
    payee_map: HashMap<String, String>,
}

impl ExactMatchEngine {
    /// Create an empty exact match engine
    pub fn new() -> Self {
        Self {
            payee_map: HashMap::new(),
        }
    }

    /// Create from an existing payee map (backward compatibility)
    /// Old format entries become payee defaults
    pub fn from_map(payee_map: HashMap<String, String>) -> Self {
        let mut engine = Self::new();
        for (payee, category) in payee_map {
            // Old format: normalized_payee -> category
            // Treat as payee default (payee + null)
            engine.learn_hierarchical(Some(&payee), None, &category);
        }
        engine
    }

    /// Create from raw internal map format (with prefixed keys)
    ///
    /// This is used when importing the exact format returned by export(),
    /// preserving the hierarchical key structure.
    pub fn from_raw_map(payee_map: HashMap<String, String>) -> Self {
        Self { payee_map }
    }

    /// Learn from user's manual categorization with hierarchical key
    ///
    /// Logic:
    /// 1. NEW CATEGORIZATION (no existing rule matches):
    ///    - If IBAN available → create iban_only_default (IBAN takes priority!)
    ///    - If only payee (no IBAN) → create payee_default
    ///
    /// 2. RECATEGORIZATION (existing rule was matched):
    ///    - Overwrite the existing rule with new category
    ///
    /// # Arguments
    /// * `payee` - Normalized payee name (counterparty_name)
    /// * `iban` - Counterparty IBAN/account number
    /// * `category_id` - Category to assign
    pub fn learn_hierarchical(
        &mut self,
        payee: Option<&str>,
        iban: Option<&str>,
        category_id: &str,
    ) {
        let norm_payee = payee.map(simple_normalize).filter(|p| p.len() > 2);
        let norm_iban = iban
            .map(|i| i.trim().to_uppercase())
            .filter(|i| !i.is_empty());

        // Find which existing rule would match this transaction
        let existing_rule = self.find_matching_rule_key(&norm_payee, &norm_iban);

        match existing_rule {
            // NO EXISTING RULE → New categorization
            None => {
                // IBAN takes priority over payee!
                if let Some(ref i) = norm_iban {
                    // Create iban_only_default (regardless of whether payee is present)
                    let key = format!("{KEY_IBAN_ONLY_DEFAULT}{}", i);
                    self.payee_map.insert(key, category_id.to_string());

                    // Also store for partial IBAN suggestion
                    let iban_partial_key = format!("{KEY_IBAN_PARTIAL}{}", i);
                    self.payee_map
                        .entry(iban_partial_key)
                        .or_insert_with(|| category_id.to_string());
                } else if let Some(ref p) = norm_payee {
                    // No IBAN, only payee → create payee_default
                    let key = format!("{KEY_PAYEE_DEFAULT}{}", p);
                    self.payee_map.insert(key, category_id.to_string());
                }
                // else: no payee and no iban → do nothing
            }

            // EXISTING RULE → Recategorization
            Some(existing_key) => {
                // Check what type of rule matched
                let is_generic_payee = existing_key.starts_with(KEY_PAYEE_DEFAULT);

                if let Some(ref i) = norm_iban {
                    if is_generic_payee {
                        // Special case: payee_default matched, but transaction now has IBAN
                        // → delete payee_default and create iban_only_default (IBAN takes priority)
                        self.payee_map.remove(&existing_key);
                        let key = format!("{KEY_IBAN_ONLY_DEFAULT}{}", i);
                        self.payee_map.insert(key, category_id.to_string());
                    } else {
                        // Generic iban rule → overwrite existing rule
                        self.payee_map.insert(existing_key, category_id.to_string());
                    }
                } else {
                    // Generic rule → overwrite existing rule
                    self.payee_map.insert(existing_key, category_id.to_string());
                }

                // Update partial IBAN suggestion if applicable
                if let Some(ref i) = norm_iban {
                    let iban_partial_key = format!("{KEY_IBAN_PARTIAL}{}", i);
                    self.payee_map
                        .entry(iban_partial_key)
                        .or_insert_with(|| category_id.to_string());
                }
            }
        }
    }

    /// Find the key of an existing rule that would match a transaction with given attributes
    /// Returns None if no rule matches (new categorization scenario)
    fn find_matching_rule_key(
        &self,
        norm_payee: &Option<String>,
        norm_iban: &Option<String>,
    ) -> Option<String> {
        // Priority 1: iban_only_default (iban only)
        if let Some(ref i) = norm_iban {
            let key = format!("{KEY_IBAN_ONLY_DEFAULT}{}", i);
            if self.payee_map.contains_key(&key) {
                return Some(key);
            }
        }

        // Priority 2: payee_default (payee only)
        if let Some(ref p) = norm_payee {
            let key = format!("{KEY_PAYEE_DEFAULT}{}", p);
            if self.payee_map.contains_key(&key) {
                return Some(key);
            }
        }

        None
    }

    /// Legacy learn function - creates payee default
    pub fn learn(&mut self, payee: &str, category_id: &str) {
        self.learn_hierarchical(Some(payee), None, category_id);
    }

    /// Forget a learned payee - removes exact key based on provided attributes
    pub fn forget_hierarchical(&mut self, payee: Option<&str>, iban: Option<&str>) -> bool {
        let norm_payee = payee.map(simple_normalize).filter(|p| p.len() > 2);
        let norm_iban = iban
            .map(|i| i.trim().to_uppercase())
            .filter(|i| !i.is_empty());

        // Try to find and remove the most specific matching rule

        // 1. Try generic IBAN rule first (most specific)
        if let Some(ref i) = norm_iban {
            let key = format!("{KEY_IBAN_ONLY_DEFAULT}{}", i);
            if self.payee_map.remove(&key).is_some() {
                // IMPORTANT: If we remove the exact IBAN rule, we MUST also remove
                // the partial/suggestion rule. Otherwise apply() will still return
                // a Suggestion, and the "forget" won't be complete.
                let partial_key = format!("{KEY_IBAN_PARTIAL}{}", i);
                self.payee_map.remove(&partial_key);
                return true;
            }
        }

        // 2. Try generic Payee rule
        if let Some(ref p) = norm_payee {
            let key = format!("{KEY_PAYEE_DEFAULT}{}", p);
            if self.payee_map.remove(&key).is_some() {
                return true;
            }
        }

        false
    }

    /// Legacy forget function - removes payee default
    pub fn forget(&mut self, payee: &str) -> bool {
        self.forget_hierarchical(Some(payee), None)
    }

    /// Try hierarchical match lookup for a transaction
    ///
    /// Cascading priority (most specific first):
    /// 1. iban_only_default: iban only (general IBAN rule)
    /// 2. payee_default: payee only (general payee rule)
    /// 3. Partial IBAN: for suggestions when only iban matches
    pub fn apply(&self, tx: &TransactionInput) -> Option<CategorizationResult> {
        let payee = tx
            .counterparty
            .as_ref()
            .map(|p| simple_normalize(p.as_str()))
            .filter(|p| p.len() > 2);
        let iban = tx
            .counterparty_iban
            .as_ref()
            .map(|i| i.trim().to_uppercase())
            .filter(|i| !i.is_empty());

        // Priority 1: iban_only_default (iban only) - general IBAN rule
        if let Some(ref i) = iban {
            let key = format!("{KEY_IBAN_ONLY_DEFAULT}{}", i);
            if let Some(cat) = self.payee_map.get(&key) {
                return Some(CategorizationResult::Match {
                    category_id: cat.clone(),
                    source: CategorizationSource::ExactMatch {
                        payee: tx
                            .counterparty
                            .clone()
                            .or_else(|| tx.counterparty_iban.clone())
                            .unwrap_or_default(),
                    },
                });
            }
        }

        // Priority 2: payee_default (payee only) - general payee rule
        if let Some(ref p) = payee {
            let key = format!("{KEY_PAYEE_DEFAULT}{}", p);
            if let Some(cat) = self.payee_map.get(&key) {
                return Some(CategorizationResult::Match {
                    category_id: cat.clone(),
                    source: CategorizationSource::ExactMatch {
                        payee: tx.counterparty.clone().unwrap_or_default(),
                    },
                });
            }
        }

        // Priority 3: Partial IBAN match -> Suggestion
        if let Some(ref i) = iban {
            let key = format!("{KEY_IBAN_PARTIAL}{}", i);
            if let Some(cat) = self.payee_map.get(&key) {
                return Some(CategorizationResult::Suggestion {
                    category_id: cat.clone(),
                    confidence: 0.70, // Lower confidence for partial match
                });
            }
        }

        None
    }

    /// Export the payee map for persistence
    /// Returns the raw internal map (with prefixed keys)
    pub fn export(&self) -> HashMap<String, String> {
        self.payee_map.clone()
    }

    /// Export in legacy format (payee -> category for payee defaults only)
    pub fn export_legacy(&self) -> HashMap<String, String> {
        let mut result = HashMap::new();
        for (key, category) in &self.payee_map {
            if let Some(payee) = key.strip_prefix(KEY_PAYEE_DEFAULT) {
                result.insert(payee.to_string(), category.clone());
            }
        }
        result
    }

    /// Get the number of learned entries
    pub fn len(&self) -> usize {
        self.payee_map.len()
    }

    /// Check if the engine has no learned entries
    pub fn is_empty(&self) -> bool {
        self.payee_map.is_empty()
    }

    /// Check if a specific payee is known (checks payee default)
    pub fn knows_payee(&self, payee: &str) -> bool {
        let normalized = simple_normalize(payee);
        let key = format!("{KEY_PAYEE_DEFAULT}{}", normalized);
        self.payee_map.contains_key(&key)
    }

    /// Get the category for a known payee (from payee default)
    pub fn get_category(&self, payee: &str) -> Option<&str> {
        let normalized = simple_normalize(payee);
        let key = format!("{KEY_PAYEE_DEFAULT}{}", normalized);
        self.payee_map.get(&key).map(|s| s.as_str())
    }

    /// Merge another engine's payee map into this one
    /// Existing entries are not overwritten.
    pub fn merge(&mut self, other: &ExactMatchEngine) {
        for (key, category) in &other.payee_map {
            self.payee_map
                .entry(key.clone())
                .or_insert_with(|| category.clone());
        }
    }

    /// Merge with overwrite (other's entries take precedence)
    pub fn merge_overwrite(&mut self, other: &ExactMatchEngine) {
        for (key, category) in &other.payee_map {
            self.payee_map.insert(key.clone(), category.clone());
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
            bank_account_id: None,
        }
    }

    fn make_tx_full(counterparty: Option<&str>, iban: Option<&str>) -> TransactionInput {
        TransactionInput {
            id: "tx1".into(),
            description: None,
            counterparty: counterparty.map(|s| s.into()),
            counterparty_iban: iban.map(|s| s.into()),
            variable_symbol: None,
            constant_symbol: None,
            specific_symbol: None,
            amount: -500.0,
            is_credit: false,
            bank_account_id: None,
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
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_dining");
            }
            _ => panic!("Expected Match"),
        }
    }

    // ==================== NEW CATEGORIZATION TESTS ====================

    #[test]
    fn test_new_categorization_payee_only() {
        // Rule a) - platba má jen payee → vytvořit pravidlo s payee
        let mut engine = ExactMatchEngine::new();
        engine.learn_hierarchical(Some("Albert"), None, "cat_groceries");

        // Should create payee_default
        let tx = make_tx_full(Some("Albert"), None);
        match engine.apply(&tx).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_groceries");
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_new_categorization_iban_only() {
        // Rule b) - platba má jen iban → vytvořit pravidlo s iban
        let mut engine = ExactMatchEngine::new();
        engine.learn_hierarchical(None, Some("CZ123"), "cat_utilities");

        // Should create iban_only_default
        let tx = make_tx_full(None, Some("CZ123"));
        match engine.apply(&tx).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_utilities");
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_new_categorization_iban_plus_payee_creates_iban_rule() {
        // Rule c) - platba má iban + payee → vytvořit pravidlo JEN s iban
        let mut engine = ExactMatchEngine::new();
        engine.learn_hierarchical(Some("Albert"), Some("CZ123"), "cat_groceries");

        // Should create iban_only_default, NOT payee_default
        // Check: same IBAN, DIFFERENT payee should still match
        let tx = make_tx_full(Some("Different Payee"), Some("CZ123"));
        match engine.apply(&tx).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_groceries");
            }
            _ => panic!("Expected Match - iban_only_default should match any payee with same IBAN"),
        }

        // Same payee, DIFFERENT IBAN should NOT match
        let tx2 = make_tx_full(Some("Albert"), Some("CZ999"));
        assert!(
            engine.apply(&tx2).is_none(),
            "Different IBAN should not match"
        );
    }

    // ==================== RECATEGORIZATION TESTS ====================

    #[test]
    fn test_recategorization_generic_without_vs_overwrites() {
        // Existing generic rule + transaction → overwrite existing
        let mut engine = ExactMatchEngine::new();
        engine.learn_hierarchical(Some("Albert"), None, "cat_groceries");

        // Recategorization: should overwrite
        engine.learn_hierarchical(Some("Albert"), None, "cat_dining");

        let tx = make_tx_full(Some("Albert"), None);
        match engine.apply(&tx).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_dining");
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_recategorization_payee_default_replaced_by_iban_when_iban_present() {
        // Existing payee_default + transaction now has IBAN
        // → delete payee_default and create iban_only_default
        let mut engine = ExactMatchEngine::new();

        // First categorization (payee only): creates payee_default
        engine.learn_hierarchical(Some("Albert"), None, "cat_groceries");

        // Verify payee_default was created
        let tx_payee_only = make_tx_full(Some("Albert"), None);
        assert!(engine.apply(&tx_payee_only).is_some());

        // Recategorization: same payee but NOW with IBAN
        // This should DELETE payee_default and CREATE iban_only_default
        engine.learn_hierarchical(Some("Albert"), Some("CZ123"), "cat_utilities");

        // Check: payee_default should be GONE
        let tx_payee_only2 = make_tx_full(Some("Albert"), None);
        assert!(
            engine.apply(&tx_payee_only2).is_none(),
            "payee_default should have been deleted"
        );

        // Check: iban_only_default should now exist
        let tx_with_iban = make_tx_full(Some("Albert"), Some("CZ123"));
        match engine.apply(&tx_with_iban).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_utilities");
            }
            _ => panic!("Expected Match from iban_only_default"),
        }

        // Same IBAN, different payee should also match (because it's iban_only_default)
        let tx_different_payee = make_tx_full(Some("Different"), Some("CZ123"));
        match engine.apply(&tx_different_payee).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_utilities");
            }
            _ => panic!("Expected Match - iban_only_default should match any payee"),
        }
    }

    // ==================== MATCHING PRIORITY TESTS ====================

    #[test]
    fn test_iban_rule_takes_priority_over_payee() {
        let mut engine = ExactMatchEngine::new();
        // Create payee general rule
        engine.payee_map.insert(
            format!("{}albert", KEY_PAYEE_DEFAULT),
            "cat_payee".to_string(),
        );
        // Create IBAN general rule
        engine.payee_map.insert(
            format!("{}CZ123", KEY_IBAN_ONLY_DEFAULT),
            "cat_iban".to_string(),
        );

        // IBAN rule should take priority when transaction has both
        let tx = make_tx_full(Some("Albert"), Some("CZ123"));
        match engine.apply(&tx).unwrap() {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_iban");
            }
            _ => panic!("Expected Match - IBAN rule should have priority"),
        }
    }

    // ==================== LEGACY TESTS (still valid) ====================

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
    fn test_forget() {
        let mut engine = ExactMatchEngine::new();
        engine.learn("Uber Eats", "cat_dining");

        let tx = make_tx(None, Some("Uber Eats"));
        assert!(engine.apply(&tx).is_some());

        engine.forget("Uber Eats");
        assert!(engine.apply(&tx).is_none());
    }

    #[test]
    fn test_forget_hierarchical() {
        let mut engine = ExactMatchEngine::new();
        engine.learn_hierarchical(None, Some("CZ123"), "cat_utilities");

        let tx = make_tx_full(None, Some("CZ123"));
        assert!(engine.apply(&tx).is_some());

        engine.forget_hierarchical(None, Some("CZ123"));
        assert!(engine.apply(&tx).is_none());
    }

    #[test]
    fn test_partial_iban_suggestion() {
        let mut engine = ExactMatchEngine::new();
        // Learn creates both default and partial
        engine.learn_hierarchical(None, Some("CZ123"), "cat_utilities");

        // If we remove the default, partial should still give suggestion
        engine
            .payee_map
            .remove(&format!("{}CZ123", KEY_IBAN_ONLY_DEFAULT));

        let tx = make_tx_full(None, Some("CZ123"));
        match engine.apply(&tx) {
            Some(CategorizationResult::Suggestion {
                category_id,
                confidence,
            }) => {
                assert_eq!(category_id, "cat_utilities");
                assert!((confidence - 0.70).abs() < 0.01);
            }
            _ => panic!("Expected Suggestion"),
        }
    }

    #[test]
    fn test_export_import() {
        let mut engine1 = ExactMatchEngine::new();
        engine1.learn("Test Payee", "cat_other");
        engine1.learn_hierarchical(None, Some("CZ123"), "cat_utilities");

        let exported = engine1.export();
        assert!(!exported.is_empty());

        let engine2 = ExactMatchEngine::from_raw_map(exported);

        let tx_payee = make_tx(None, Some("Test Payee"));
        assert!(engine2.apply(&tx_payee).is_some());

        let tx_iban = make_tx_full(None, Some("CZ123"));
        assert!(engine2.apply(&tx_iban).is_some());
    }
}
