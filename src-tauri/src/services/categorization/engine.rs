//! Master categorization engine orchestrating the waterfall flow
//!
//! This engine combines:
//! 1. Rule Engine - Regex and pattern-based matching
//! 2. Exact Match Engine - HashMap lookup for known payees
//! 3. ML Classifier - Naive Bayes prediction for unknown transactions
//!
//! Flow: Rules → Exact Match → ML Prediction

use anyhow::Result;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::RwLock;

use super::exact_match::ExactMatchEngine;
use super::ml_classifier::MLClassifier;
use super::rules::RuleEngine;
use super::types::{CategorizationResult, CategorizationRule, TransactionInput};

/// Main categorization engine orchestrating all classification methods
pub struct CategorizationEngine {
    rule_engine: RwLock<RuleEngine>,
    exact_match: RwLock<ExactMatchEngine>,
    ml_classifier: RwLock<MLClassifier>,
    /// Minimum confidence threshold for ML predictions
    ml_min_confidence: f64,
    /// User's own IBANs for internal transfer detection
    own_ibans: RwLock<HashSet<String>>,
}

impl CategorizationEngine {
    /// Create a new engine with the given rules
    pub fn new(rules: Vec<CategorizationRule>) -> Self {
        Self {
            rule_engine: RwLock::new(RuleEngine::new(rules)),
            exact_match: RwLock::new(ExactMatchEngine::new()),
            ml_classifier: RwLock::new(MLClassifier::new()),
            ml_min_confidence: 0.60, // Default threshold
            own_ibans: RwLock::new(HashSet::new()),
        }
    }

    /// Create engine with default rules and bundled ML model
    pub fn with_defaults() -> Self {
        let default_rules = super::default_rules::get_default_rules();
        let engine = Self::new(default_rules);

        // Try to load bundled ML model from various possible locations
        let model_paths = [
            // Development: relative to src-tauri directory
            std::path::PathBuf::from("resources/categorization_model.bin"),
            // macOS app bundle
            std::path::PathBuf::from("../Resources/resources/categorization_model.bin"),
            // Linux/Windows installed
            std::path::PathBuf::from("./resources/categorization_model.bin"),
        ];

        for path in &model_paths {
            if path.exists() {
                match engine.load_ml_model(path) {
                    Ok(()) => {
                        log::info!("ML model loaded from {:?}", path);
                        break;
                    }
                    Err(e) => {
                        log::warn!("Failed to load ML model from {:?}: {}", path, e);
                    }
                }
            }
        }

        engine
    }

    /// Load engine with persisted state
    ///
    /// # Arguments
    /// * `rules` - Active categorization rules
    /// * `payee_map` - Learned payee → category mappings
    /// * `model_path` - Optional path to ML model file
    pub fn load(
        rules: Vec<CategorizationRule>,
        payee_map: HashMap<String, String>,
        model_path: Option<&Path>,
    ) -> Result<Self> {
        let ml_classifier = if let Some(path) = model_path {
            if path.exists() {
                log::info!("Loading ML model from {:?}", path);
                match MLClassifier::load_model(path) {
                    Ok(classifier) => classifier,
                    Err(e) => {
                        log::warn!("Failed to load ML model: {}, using empty classifier", e);
                        MLClassifier::new()
                    }
                }
            } else {
                log::info!("ML model file not found, using empty classifier");
                MLClassifier::new()
            }
        } else {
            MLClassifier::new()
        };

        Ok(Self {
            rule_engine: RwLock::new(RuleEngine::new(rules)),
            exact_match: RwLock::new(ExactMatchEngine::from_map(payee_map)),
            ml_classifier: RwLock::new(ml_classifier),
            ml_min_confidence: 0.60,
            own_ibans: RwLock::new(HashSet::new()),
        })
    }

    /// Set the minimum confidence threshold for ML predictions
    pub fn set_ml_threshold(&mut self, threshold: f64) {
        self.ml_min_confidence = threshold.clamp(0.0, 1.0);
    }

    /// Set the user's own IBANs for internal transfer detection
    ///
    /// When a transaction's counterparty IBAN matches any of these,
    /// it will be categorized as "Internal Transfer" (unless overridden by learned payees).
    pub fn set_own_ibans(&self, ibans: Vec<String>) {
        let normalized: HashSet<String> = ibans
            .into_iter()
            .map(|s| s.replace(' ', "").to_uppercase())
            .filter(|s| !s.is_empty())
            .collect();
        if let Ok(mut own) = self.own_ibans.write() {
            *own = normalized;
        }
    }

    /// Check if counterparty IBAN matches user's own accounts
    fn is_internal_transfer(&self, counterparty_iban: Option<&str>) -> bool {
        if let Some(iban) = counterparty_iban {
            let normalized = iban.replace(' ', "").to_uppercase();
            if !normalized.is_empty() {
                if let Ok(own) = self.own_ibans.read() {
                    return own.contains(&normalized);
                }
            }
        }
        false
    }

    /// Categorize a single transaction using waterfall approach
    ///
    /// Flow (priority order):
    /// 1. Try exact payee match FIRST (user's learned categorizations take priority)
    /// 2. Check if counterparty IBAN matches user's own accounts (internal transfer)
    /// 3. Try rules (regex, patterns, symbols)
    /// 4. Try ML classifier
    /// 5. Return None if nothing matches
    pub fn categorize(&self, tx: &TransactionInput) -> CategorizationResult {
        // Step 1: Try exact payee match FIRST (learned payees override everything)
        if let Ok(exact) = self.exact_match.read() {
            if let Some(result) = exact.apply(tx) {
                return result;
            }
        }

        // Step 2: Check own IBANs for internal transfer detection
        if self.is_internal_transfer(tx.counterparty_iban.as_deref()) {
            return CategorizationResult::Match {
                category_id: "cat_internal_transfers".to_string(),
                source: super::types::CategorizationSource::Rule {
                    rule_id: "own_account_iban".to_string(),
                    rule_name: "Internal Transfer (own account)".to_string(),
                },
            };
        }

        // Step 3: Try rules (patterns, regex)
        if let Ok(rules) = self.rule_engine.read() {
            if let Some((result, _stop_processing)) = rules.apply(tx) {
                return result;
            }
        }

        // Step 4: Try ML classifier
        if let Ok(ml) = self.ml_classifier.read() {
            if let Some(result) = ml.predict(tx, self.ml_min_confidence) {
                return result;
            }
        }

        CategorizationResult::None
    }

    /// Categorize multiple transactions (batch)
    pub fn categorize_batch(&self, transactions: &[TransactionInput]) -> Vec<CategorizationResult> {
        transactions.iter().map(|tx| self.categorize(tx)).collect()
    }

    /// Learn from user's manual categorization with hierarchical matching
    ///
    /// This adds the payee/iban combination to the exact match engine.
    /// The engine uses cascading defaults:
    /// - iban = IBAN default (catches any payee)
    /// - payee = payee default (catches any iban)
    pub fn learn_from_user(&self, payee: Option<&str>, iban: Option<&str>, category_id: &str) {
        if let Ok(mut exact) = self.exact_match.write() {
            exact.learn_hierarchical(payee, iban, category_id);
        }
    }

    /// Legacy learn - creates payee default
    pub fn learn_from_user_simple(&self, payee: &str, category_id: &str) {
        self.learn_from_user(Some(payee), None, category_id);
    }

    /// Forget a learned payee combination
    pub fn forget_payee(&self, payee: Option<&str>, iban: Option<&str>) -> bool {
        if let Ok(mut exact) = self.exact_match.write() {
            exact.forget_hierarchical(payee, iban)
        } else {
            false
        }
    }

    /// Legacy forget - removes payee default
    pub fn forget_payee_simple(&self, payee: &str) -> bool {
        self.forget_payee(Some(payee), None)
    }

    /// Update rules (e.g., after user edits)
    pub fn update_rules(&self, rules: Vec<CategorizationRule>) {
        if let Ok(mut engine) = self.rule_engine.write() {
            *engine = RuleEngine::new(rules);
        }
    }

    /// Retrain ML model with new samples
    ///
    /// # Arguments
    /// * `samples` - Vec of (text, category_id) pairs
    pub fn retrain_ml(&self, samples: Vec<(String, String)>) -> Result<()> {
        let mut ml = self
            .ml_classifier
            .write()
            .map_err(|_| anyhow::anyhow!("ML classifier lock poisoned"))?;
        ml.train(samples)
    }

    /// Save ML model to disk
    pub fn save_ml_model(&self, path: &Path) -> Result<()> {
        let ml = self
            .ml_classifier
            .read()
            .map_err(|_| anyhow::anyhow!("ML classifier lock poisoned"))?;
        ml.save_model(path)
    }

    /// Load ML model from disk
    pub fn load_ml_model(&self, path: &Path) -> Result<()> {
        let new_classifier = MLClassifier::load_model(path)?;
        if let Ok(mut ml) = self.ml_classifier.write() {
            *ml = new_classifier;
        }
        Ok(())
    }

    /// Export learned payees for persistence
    pub fn export_learned_payees(&self) -> HashMap<String, String> {
        self.exact_match
            .read()
            .map(|e| e.export())
            .unwrap_or_default()
    }

    /// Import learned payees (raw format with prefixed keys)
    ///
    /// This imports the exact format returned by export_learned_payees(),
    /// which includes the internal key prefixes for hierarchical matching.
    pub fn import_learned_payees(&self, payees: HashMap<String, String>) {
        if let Ok(mut exact) = self.exact_match.write() {
            exact.merge(&super::exact_match::ExactMatchEngine::from_raw_map(payees));
        }
    }

    /// Get statistics about the engine
    pub fn stats(&self) -> EngineStats {
        let rules_count = self
            .rule_engine
            .read()
            .map(|r| r.active_rule_count())
            .unwrap_or(0);

        let learned_payees = self.exact_match.read().map(|e| e.len()).unwrap_or(0);

        let (ml_classes, ml_vocab) = self
            .ml_classifier
            .read()
            .map(|m| (m.num_classes(), m.vocabulary_size()))
            .unwrap_or((0, 0));

        EngineStats {
            active_rules: rules_count,
            learned_payees,
            ml_classes,
            ml_vocabulary_size: ml_vocab,
        }
    }
}

impl Default for CategorizationEngine {
    fn default() -> Self {
        Self::with_defaults()
    }
}

/// Statistics about the categorization engine
#[derive(Debug, Clone)]
pub struct EngineStats {
    pub active_rules: usize,
    pub learned_payees: usize,
    pub ml_classes: usize,
    pub ml_vocabulary_size: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::categorization::types::{CategorizationSource, RuleType};

    fn make_tx(description: &str, counterparty: Option<&str>) -> TransactionInput {
        TransactionInput {
            id: "tx1".into(),
            description: Some(description.into()),
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

    #[test]
    fn test_rule_match() {
        let rules = vec![CategorizationRule {
            id: "r1".into(),
            name: "Albert".into(),
            rule_type: RuleType::Contains,
            pattern: "albert".into(),
            category_id: "cat_groceries".into(),
            priority: 50,
            is_active: true,
            stop_processing: false,
        }];

        let engine = CategorizationEngine::new(rules);
        let tx = make_tx("Platba kartou Albert Hypermarket", None);

        let result = engine.categorize(&tx);
        match result {
            CategorizationResult::Match {
                category_id,
                source,
            } => {
                assert_eq!(category_id, "cat_groceries");
                assert!(matches!(source, CategorizationSource::Rule { .. }));
            }
            _ => panic!("Expected rule Match"),
        }
    }

    #[test]
    fn test_exact_match_after_learning() {
        let engine = CategorizationEngine::new(vec![]);
        engine.learn_from_user_simple("Uber Eats", "cat_dining");

        let tx = make_tx("", Some("Uber Eats"));
        let result = engine.categorize(&tx);

        match result {
            CategorizationResult::Match {
                category_id,
                source,
            } => {
                assert_eq!(category_id, "cat_dining");
                assert!(matches!(source, CategorizationSource::ExactMatch { .. }));
            }
            _ => panic!("Expected exact Match"),
        }
    }

    #[test]
    fn test_waterfall_order() {
        // Learned payees (exact match) now take precedence over rules
        let rules = vec![CategorizationRule {
            id: "r1".into(),
            name: "Albert Rule".into(),
            rule_type: RuleType::Contains,
            pattern: "albert".into(),
            category_id: "cat_groceries".into(),
            priority: 50,
            is_active: true,
            stop_processing: false,
        }];

        let engine = CategorizationEngine::new(rules);
        // Learn "Albert" as dining (should WIN over rule since learned payees have highest priority)
        engine.learn_from_user_simple("Albert", "cat_dining");

        // Transaction has BOTH description (for rule match) AND counterparty (for exact match)
        let tx = make_tx("Albert Praha", Some("Albert"));
        let result = engine.categorize(&tx);

        match result {
            CategorizationResult::Match {
                category_id,
                source,
            } => {
                assert_eq!(category_id, "cat_dining"); // Learned payee wins over rule
                assert!(matches!(source, CategorizationSource::ExactMatch { .. }));
            }
            _ => panic!("Expected exact Match"),
        }
    }

    #[test]
    fn test_no_match() {
        let engine = CategorizationEngine::new(vec![]);
        let tx = make_tx("Unknown merchant XYZ", None);

        let result = engine.categorize(&tx);
        assert!(matches!(result, CategorizationResult::None));
    }

    #[test]
    fn test_with_defaults() {
        let engine = CategorizationEngine::with_defaults();
        let stats = engine.stats();
        assert!(stats.active_rules > 0);
    }

    #[test]
    fn test_export_import_payees() {
        let engine1 = CategorizationEngine::new(vec![]);
        engine1.learn_from_user_simple("Test Payee", "cat_other");

        let exported = engine1.export_learned_payees();
        assert!(!exported.is_empty());

        let engine2 = CategorizationEngine::new(vec![]);
        engine2.import_learned_payees(exported);

        let tx = make_tx("", Some("Test Payee"));
        assert!(engine2.categorize(&tx).has_category());
    }

    #[test]
    fn test_forget_payee() {
        let engine = CategorizationEngine::new(vec![]);
        engine.learn_from_user_simple("Test Payee", "cat_other");

        let tx = make_tx("", Some("Test Payee"));
        assert!(engine.categorize(&tx).has_category());

        engine.forget_payee_simple("Test Payee");
        assert!(!engine.categorize(&tx).has_category());
    }
}
