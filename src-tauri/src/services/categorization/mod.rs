//! Smart Categorization Engine
//!
//! This module provides intelligent transaction categorization using a waterfall approach:
//! 1. Rule Engine - Regex and pattern-based matching
//! 2. Exact Match - HashMap lookup for known payees
//! 3. ML Classifier - Naive Bayes prediction for unknown transactions
//!
//! The engine is optimized for Czech banking context with proper text normalization.

pub mod default_rules;
pub mod engine;
pub mod exact_match;
pub mod fio_scraper;
pub mod ml_classifier;
pub mod rules;
pub mod tokenizer;
pub mod training_data;
pub mod types;

// Re-export main types and engine
pub use engine::CategorizationEngine;
pub use types::{
    CategorizationResult, CategorizationRule, CategorizationSource, RuleType, TransactionInput,
};
