//! Rule engine for pattern-based transaction categorization
//!
//! Supports multiple rule types:
//! - Regex: Full regex pattern matching
//! - Contains: Simple substring matching
//! - StartsWith/EndsWith: Position-based matching
//! - VariableSymbol/ConstantSymbol/SpecificSymbol: Czech payment symbol matching

use regex::Regex;

use super::types::{
    CategorizationResult, CategorizationRule, CategorizationSource, RuleType, TransactionInput,
};

/// Compiled rule for efficient matching
struct CompiledRule {
    rule: CategorizationRule,
    compiled_regex: Option<Regex>,
    lowercase_pattern: String,
}

/// Rule engine for pattern-based categorization
pub struct RuleEngine {
    rules: Vec<CompiledRule>,
}

impl RuleEngine {
    /// Create a new rule engine with the given rules
    ///
    /// Rules are sorted by priority (higher priority first)
    pub fn new(mut rules: Vec<CategorizationRule>) -> Self {
        // Sort by priority (higher first)
        rules.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Pre-compile regex patterns
        let compiled_rules = rules
            .into_iter()
            .map(|rule| {
                let compiled_regex = if rule.rule_type == RuleType::Regex {
                    Regex::new(&rule.pattern).ok()
                } else {
                    None
                };
                let lowercase_pattern = rule.pattern.to_lowercase();

                CompiledRule {
                    rule,
                    compiled_regex,
                    lowercase_pattern,
                }
            })
            .collect();

        Self {
            rules: compiled_rules,
        }
    }

    /// Create an empty rule engine
    pub fn empty() -> Self {
        Self { rules: Vec::new() }
    }

    /// Try to match transaction against rules
    ///
    /// Returns `Some((result, stop_processing))` if a rule matches,
    /// where `stop_processing` indicates if the waterfall should stop.
    pub fn apply(&self, tx: &TransactionInput) -> Option<(CategorizationResult, bool)> {
        let search_text = tx.combined_text().to_lowercase();

        for compiled in &self.rules {
            if !compiled.rule.is_active {
                continue;
            }

            let mut matched = false;
            let mut iban_mode = false;

            // Check if this is an Exclusive IBAN rule (has non-empty IBAN pattern)
            if let Some(ref iban_pattern) = compiled.rule.iban_pattern {
                if !iban_pattern.is_empty() {
                    // EXCLUSIVE IBAN MODE:
                    // If IBAN pattern is present, we ignore the text pattern/RuleType entirely
                    // and match strictly based on IBAN.
                    iban_mode = true;
                    matched = tx
                        .counterparty_iban
                        .as_ref()
                        .map(|iban| matches_iban(iban, iban_pattern))
                        .unwrap_or(false);
                }
            }

            // If not in exclusive IBAN mode, use standard RuleType matching
            if !iban_mode {
                matched = match compiled.rule.rule_type {
                    RuleType::Regex => compiled
                        .compiled_regex
                        .as_ref()
                        .map(|re| re.is_match(&search_text))
                        .unwrap_or(false),

                    RuleType::Contains => search_text.contains(&compiled.lowercase_pattern),

                    RuleType::StartsWith => search_text.starts_with(&compiled.lowercase_pattern),

                    RuleType::EndsWith => search_text.ends_with(&compiled.lowercase_pattern),

                    RuleType::VariableSymbol => tx
                        .variable_symbol
                        .as_ref()
                        .map(|vs| vs == &compiled.rule.pattern)
                        .unwrap_or(false),

                    RuleType::ConstantSymbol => tx
                        .constant_symbol
                        .as_ref()
                        .map(|ks| ks == &compiled.rule.pattern)
                        .unwrap_or(false),

                    RuleType::SpecificSymbol => tx
                        .specific_symbol
                        .as_ref()
                        .map(|ss| ss == &compiled.rule.pattern)
                        .unwrap_or(false),

                    RuleType::IsCredit => tx.is_credit,

                    RuleType::IsDebit => !tx.is_credit,
                };
            }

            // Primary condition must match
            if !matched {
                continue;
            }

            // Note: We don't need to check iban_pattern again here because:
            // 1. If iban_mode=true, we already checked it and set 'matched' based on it.
            // 2. If iban_mode=false, iban_pattern is None or Empty, so nothing to check.

            // Check additional Variable Symbol if specified
            // This applies to BOTH IBAN-mode rules and Standard rules
            let vs_matches = if let Some(ref vs_pattern) = compiled.rule.variable_symbol {
                if vs_pattern.is_empty() {
                    true // Empty pattern is ignored
                } else {
                    tx.variable_symbol
                        .as_ref()
                        .map(|vs| vs == vs_pattern)
                        .unwrap_or(false)
                }
            } else {
                true // No VS pattern specified - matches anything
            };

            // All conditions must be met
            if vs_matches {
                return Some((
                    CategorizationResult::Match {
                        category_id: compiled.rule.category_id.clone(),
                        source: CategorizationSource::Rule {
                            rule_id: compiled.rule.id.clone(),
                            rule_name: compiled.rule.name.clone(),
                        },
                    },
                    compiled.rule.stop_processing,
                ));
            }
        }

        None
    }

    /// Get the number of active rules
    pub fn active_rule_count(&self) -> usize {
        self.rules.iter().filter(|r| r.rule.is_active).count()
    }

    /// Get all rules (for debugging/export)
    pub fn rules(&self) -> Vec<&CategorizationRule> {
        self.rules.iter().map(|r| &r.rule).collect()
    }
}

/// Helper to match IBAN against user pattern (supports smart BBAN matching)
fn matches_iban(transaction_iban: &str, user_pattern: &str) -> bool {
    let tx_norm = transaction_iban.replace(' ', "").to_lowercase();
    let pat_norm = user_pattern.replace(' ', "").to_lowercase();

    // 1. Direct substring match (covers full IBANs and simple partials)
    if tx_norm.contains(&pat_norm) {
        return true;
    }

    // 2. Smart BBAN matching (e.g. "12345/0100" or "12-345/0100")
    if pat_norm.contains('/') {
        let parts: Vec<&str> = pat_norm.split('/').collect();
        if parts.len() == 2 {
            let account_part = parts[0]; // e.g. "12345" or "12-345"
            let bank_code = parts[1]; // e.g. "0100"

            // Verify bank code is present
            // In CZ IBAN: CZkk bbbb pppp pppp pppp pppp
            // Bank code is usually at index 4-7 (0-based)
            if !tx_norm.contains(bank_code) {
                return false;
            }

            // Verify account number (handle optional prefix)
            // Account part might have a hyphen (prefix-number)
            let account_clean = account_part.replace('-', "");

            // The account number in IBAN is at the end (last 16 digits includes prefix + number)
            // We check if the transaction IBAN *ends with* the account number
            if tx_norm.ends_with(&account_clean) {
                return true;
            }

            // Handling Prefix-Account format (hyphenated)
            if account_part.contains('-') {
                let acc_parts: Vec<&str> = account_part.split('-').collect();
                if acc_parts.len() == 2 {
                    let prefix = acc_parts[0];
                    let number = acc_parts[1];

                    // Basic heuristic: if it contains all parts, it's a match.
                    if tx_norm.contains(bank_code)
                        && tx_norm.contains(prefix)
                        && tx_norm.contains(number)
                    {
                        return true;
                    }
                }
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_rule(
        id: &str,
        name: &str,
        rule_type: RuleType,
        pattern: &str,
        category_id: &str,
        priority: i32,
        stop: bool,
    ) -> CategorizationRule {
        CategorizationRule {
            id: id.into(),
            name: name.into(),
            rule_type,
            pattern: pattern.into(),
            category_id: category_id.into(),
            priority,
            is_active: true,
            stop_processing: stop,
            iban_pattern: None,
            variable_symbol: None,
        }
    }

    // Helper to add IBAN/VS to rule
    fn with_iban(mut rule: CategorizationRule, iban: &str) -> CategorizationRule {
        rule.iban_pattern = Some(iban.into());
        rule
    }

    fn with_vs(mut rule: CategorizationRule, vs: &str) -> CategorizationRule {
        rule.variable_symbol = Some(vs.into());
        rule
    }

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

    fn make_tx_full(description: &str, iban: Option<&str>, vs: Option<&str>) -> TransactionInput {
        let mut tx = make_tx(description, None);
        tx.counterparty_iban = iban.map(|s| s.into());
        tx.variable_symbol = vs.map(|s| s.into());
        tx
    }

    #[test]
    fn test_contains_match() {
        let rules = vec![make_rule(
            "r1",
            "Albert",
            RuleType::Contains,
            "albert",
            "cat_groceries",
            50,
            false,
        )];
        let engine = RuleEngine::new(rules);

        let tx = make_tx("Platba kartou Albert Hypermarket", None);
        let result = engine.apply(&tx);

        assert!(result.is_some());
        let (cat_result, stop) = result.unwrap();
        assert!(!stop);

        match cat_result {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_groceries");
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_regex_match() {
        let rules = vec![make_rule(
            "r1",
            "Czech Railways",
            RuleType::Regex,
            r"(?i)ceske.*drahy|cd\.cz",
            "cat_transport",
            50,
            false,
        )];
        let engine = RuleEngine::new(rules);

        let tx = make_tx("Jizdenka Ceske drahy a.s.", None);
        let result = engine.apply(&tx);

        assert!(result.is_some());
    }

    #[test]
    fn test_variable_symbol_match() {
        let rules = vec![make_rule(
            "r1",
            "Insurance VS",
            RuleType::VariableSymbol,
            "1234567890",
            "cat_insurance",
            100,
            true,
        )];
        let engine = RuleEngine::new(rules);

        let mut tx = make_tx("Pojisteni", None);
        tx.variable_symbol = Some("1234567890".into());

        let result = engine.apply(&tx);
        assert!(result.is_some());

        let (_, stop) = result.unwrap();
        assert!(stop); // stop_processing = true
    }

    #[test]
    fn test_priority_ordering() {
        let rules = vec![
            make_rule(
                "r1",
                "Low priority",
                RuleType::Contains,
                "albert",
                "cat_other",
                10,
                false,
            ),
            make_rule(
                "r2",
                "High priority",
                RuleType::Contains,
                "albert",
                "cat_groceries",
                100,
                false,
            ),
        ];
        let engine = RuleEngine::new(rules);

        let tx = make_tx("Albert supermarket", None);
        let result = engine.apply(&tx);

        assert!(result.is_some());
        match result.unwrap().0 {
            CategorizationResult::Match { category_id, .. } => {
                assert_eq!(category_id, "cat_groceries"); // Higher priority wins
            }
            _ => panic!("Expected Match"),
        }
    }

    #[test]
    fn test_inactive_rule_skipped() {
        let mut rule = make_rule(
            "r1",
            "Albert",
            RuleType::Contains,
            "albert",
            "cat_groceries",
            50,
            false,
        );
        rule.is_active = false;

        let engine = RuleEngine::new(vec![rule]);
        let tx = make_tx("Albert supermarket", None);

        let result = engine.apply(&tx);
        assert!(result.is_none());
    }

    #[test]
    fn test_no_match() {
        let rules = vec![make_rule(
            "r1",
            "Albert",
            RuleType::Contains,
            "albert",
            "cat_groceries",
            50,
            false,
        )];
        let engine = RuleEngine::new(rules);

        let tx = make_tx("Lidl nákup", None);
        let result = engine.apply(&tx);

        assert!(result.is_none());
    }

    #[test]
    fn test_starts_with() {
        let rules = vec![make_rule(
            "r1",
            "DPP",
            RuleType::StartsWith,
            "dpp",
            "cat_transport",
            50,
            false,
        )];
        let engine = RuleEngine::new(rules);

        let tx = make_tx("DPP Litacka kupon", None);
        assert!(engine.apply(&tx).is_some());

        let tx = make_tx("Platba DPP", None);
        assert!(engine.apply(&tx).is_none()); // DPP is not at start
    }

    #[test]
    fn test_bban_exclusive_matching() {
        // BBAN Rule with completely unrelated Text Pattern
        // Should MATCH because text pattern is IGNORED in Exclusive Mode
        let rule = with_iban(
            make_rule(
                "r1",
                "My Rule",
                RuleType::Contains,
                "THIS TEXT IS NOT IN TRANSACTION",
                "cat_test",
                50,
                false,
            ),
            "123456/0100",
        );
        let engine = RuleEngine::new(vec![rule]);

        // Transaction with full IBAN but NO description matching pattern
        let tx = make_tx_full("Platba", Some("CZ1201000000000000123456"), None);

        assert!(
            engine.apply(&tx).is_some(),
            "Exclusive IBAN rule should ignore text pattern mismatch"
        );
    }

    #[test]
    fn test_full_iban_exclusive_matching() {
        // Full IBAN Rule with unrelated text pattern
        let rule = with_iban(
            make_rule(
                "r1",
                "My Rule",
                RuleType::Contains,
                "Unrelated",
                "cat_test",
                50,
                false,
            ),
            "CZ1201000000000000123456",
        );
        let engine = RuleEngine::new(vec![rule]);

        let tx = make_tx_full("Platba", Some("CZ1201000000000000123456"), None);
        assert!(
            engine.apply(&tx).is_some(),
            "Exclusive Full IBAN rule matches"
        );
    }

    #[test]
    fn test_bban_with_vs_matching() {
        // BBAN + VS rule
        let rule = with_vs(
            with_iban(
                make_rule(
                    "r1",
                    "VS Rule",
                    RuleType::Contains,
                    "Ignored Pattern",
                    "cat_test",
                    50,
                    false,
                ),
                "123456/0100",
            ),
            "555", // VS Requirement
        );
        let engine = RuleEngine::new(vec![rule]);

        // Case 1: Matching IBAN but wrong VS -> Should NOT match
        let tx_wrong_vs = make_tx_full("Platba", Some("CZ1201000000000000123456"), Some("999"));
        assert!(engine.apply(&tx_wrong_vs).is_none(), "Wrong VS matched");

        // Case 2: Matching IBAN and correct VS -> Should match
        let tx_correct = make_tx_full("Platba", Some("CZ1201000000000000123456"), Some("555"));
        assert!(
            engine.apply(&tx_correct).is_some(),
            "Correct IBAN+VS should match"
        );

        // Case 3: Wrong IBAN, correct VS -> Should NOT match
        let tx_wrong_iban = make_tx_full("Platba", Some("CZ9901000000000000999999"), Some("555"));
        assert!(engine.apply(&tx_wrong_iban).is_none(), "Wrong IBAN matched");
    }
}
