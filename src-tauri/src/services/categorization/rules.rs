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

            let matched = match compiled.rule.rule_type {
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
            };

            if matched {
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
        }
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
        }
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
}
