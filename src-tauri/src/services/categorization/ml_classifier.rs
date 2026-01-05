//! Machine Learning classifier using smartcore Naive Bayes
//!
//! This module provides text classification for bank transactions using
//! Multinomial Naive Bayes with term frequency features.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use super::tokenizer::{extract_ngrams, normalize_czech};
use super::types::{CategorizationResult, TransactionInput};

/// Vocabulary for text → feature vector conversion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vocabulary {
    word_to_idx: HashMap<String, usize>,
    idx_to_word: Vec<String>,
    document_freq: Vec<usize>,
    /// IDF weights: log(N / df) for each term
    idf_weights: Vec<f64>,
    /// Total number of documents in training corpus
    num_documents: usize,
}

impl Vocabulary {
    /// Create an empty vocabulary
    pub fn new() -> Self {
        Self {
            word_to_idx: HashMap::new(),
            idx_to_word: Vec::new(),
            document_freq: Vec::new(),
            idf_weights: Vec::new(),
            num_documents: 0,
        }
    }

    /// Build vocabulary from training corpus
    ///
    /// # Arguments
    /// * `documents` - Normalized text documents
    /// * `max_features` - Maximum vocabulary size (most frequent terms)
    /// * `min_df` - Minimum document frequency (filter rare terms)
    pub fn fit(&mut self, documents: &[String], max_features: usize, min_df: usize) {
        let mut term_doc_freq: HashMap<String, usize> = HashMap::new();

        // Count document frequency for each term
        for doc in documents {
            let ngrams: std::collections::HashSet<String> =
                extract_ngrams(doc).into_iter().collect();
            for ngram in ngrams {
                *term_doc_freq.entry(ngram).or_insert(0) += 1;
            }
        }

        // Filter by min_df and sort by frequency
        let mut terms: Vec<_> = term_doc_freq
            .into_iter()
            .filter(|(_, freq)| *freq >= min_df)
            .collect();
        terms.sort_by(|a, b| b.1.cmp(&a.1));
        terms.truncate(max_features);

        // Build vocabulary
        self.word_to_idx.clear();
        self.idx_to_word.clear();
        self.document_freq.clear();
        self.idf_weights.clear();
        self.num_documents = documents.len();

        let n = documents.len() as f64;
        for (term, df) in terms {
            let idx = self.idx_to_word.len();
            self.word_to_idx.insert(term.clone(), idx);
            self.idx_to_word.push(term);
            self.document_freq.push(df);
            // IDF = log(N / df) - smooth IDF to avoid issues with rare terms
            // Using log(1 + N / df) for smoothing
            let idf = (1.0 + n / df as f64).ln();
            self.idf_weights.push(idf);
        }
    }

    /// Transform document to term frequency vector (raw counts)
    pub fn transform(&self, text: &str) -> Vec<u32> {
        let ngrams = extract_ngrams(text);
        let mut features = vec![0u32; self.idx_to_word.len()];

        for ngram in ngrams {
            if let Some(&idx) = self.word_to_idx.get(&ngram) {
                features[idx] = features[idx].saturating_add(1);
            }
        }

        features
    }

    /// Transform document to TF-IDF weighted feature vector
    ///
    /// TF-IDF = term_frequency * inverse_document_frequency
    /// This downweights common terms that appear in many documents
    pub fn transform_tfidf(&self, text: &str) -> Vec<f64> {
        let ngrams = extract_ngrams(text);
        let mut tf = vec![0u32; self.idx_to_word.len()];

        for ngram in ngrams {
            if let Some(&idx) = self.word_to_idx.get(&ngram) {
                tf[idx] = tf[idx].saturating_add(1);
            }
        }

        // Apply TF-IDF weighting
        tf.iter()
            .zip(self.idf_weights.iter())
            .map(|(&term_freq, &idf)| term_freq as f64 * idf)
            .collect()
    }

    /// Check if we have IDF weights (for backwards compatibility)
    pub fn has_idf(&self) -> bool {
        !self.idf_weights.is_empty()
    }

    /// Get vocabulary size
    pub fn len(&self) -> usize {
        self.idx_to_word.len()
    }

    /// Check if vocabulary is empty
    pub fn is_empty(&self) -> bool {
        self.idx_to_word.is_empty()
    }

    /// Get term by index
    pub fn get_term(&self, idx: usize) -> Option<&str> {
        self.idx_to_word.get(idx).map(|s| s.as_str())
    }
}

impl Default for Vocabulary {
    fn default() -> Self {
        Self::new()
    }
}

/// Persisted model bundle containing vocabulary, labels, and trained classifier
#[derive(Serialize, Deserialize)]
pub struct CategorizationModel {
    /// Vocabulary for text → features
    pub vocabulary: Vocabulary,
    /// Label name → index mapping
    pub label_to_idx: HashMap<String, usize>,
    /// Index → label name mapping
    pub idx_to_label: Vec<String>,
    /// Model parameters (class priors and feature log probabilities)
    /// We store these instead of the full smartcore model for simpler serialization
    pub class_log_prior: Vec<f64>,
    pub feature_log_prob: Vec<Vec<f64>>,
}

/// ML-based text classifier for transaction categorization
pub struct MLClassifier {
    model: Option<CategorizationModel>,
}

impl MLClassifier {
    /// Create an empty classifier (no model loaded)
    pub fn new() -> Self {
        Self { model: None }
    }

    /// Check if a model is loaded
    pub fn has_model(&self) -> bool {
        self.model.is_some()
    }

    /// Load model from bincode file
    pub fn load_model(path: &Path) -> Result<Self> {
        let bytes = std::fs::read(path)?;
        let model: CategorizationModel = bincode::deserialize(&bytes)?;
        Ok(Self { model: Some(model) })
    }

    /// Save model to bincode file
    pub fn save_model(&self, path: &Path) -> Result<()> {
        if let Some(ref model) = self.model {
            let bytes = bincode::serialize(model)?;
            std::fs::write(path, bytes)?;
        }
        Ok(())
    }

    /// Train model on labeled samples
    ///
    /// # Arguments
    /// * `samples` - Vec of (text, category_id) pairs
    ///
    /// # Errors
    /// Returns error if not enough samples or vocabulary too small
    pub fn train(&mut self, samples: Vec<(String, String)>) -> Result<()> {
        if samples.len() < 10 {
            return Err(anyhow::anyhow!(
                "Need at least 10 samples to train, got {}",
                samples.len()
            ));
        }

        // Normalize all texts
        let normalized: Vec<String> = samples
            .iter()
            .map(|(text, _)| normalize_czech(text).0)
            .collect();

        // Build vocabulary
        let mut vocabulary = Vocabulary::new();
        vocabulary.fit(&normalized, 5000, 2); // Max 5000 features, min 2 docs

        if vocabulary.len() < 10 {
            return Err(anyhow::anyhow!(
                "Vocabulary too small after filtering: {} terms",
                vocabulary.len()
            ));
        }

        // Build label mappings
        let mut label_to_idx: HashMap<String, usize> = HashMap::new();
        let mut idx_to_label: Vec<String> = Vec::new();

        for (_, label) in &samples {
            if !label_to_idx.contains_key(label) {
                let idx = idx_to_label.len();
                label_to_idx.insert(label.clone(), idx);
                idx_to_label.push(label.clone());
            }
        }

        let n_classes = idx_to_label.len();
        let n_features = vocabulary.len();

        // Count occurrences for Naive Bayes using TF-IDF weighted features
        // class_counts[class_idx] = number of samples in class
        // feature_sums[class_idx][feature_idx] = sum of TF-IDF weights for feature in class
        let mut class_counts = vec![0usize; n_classes];
        let mut feature_sums = vec![vec![0.0f64; n_features]; n_classes];

        for ((_text, label), normalized_text) in samples.iter().zip(normalized.iter()) {
            let class_idx = *label_to_idx.get(label).expect("Label should exist");
            class_counts[class_idx] += 1;

            // Use TF-IDF weighted features instead of raw counts
            let tfidf_features = vocabulary.transform_tfidf(normalized_text);
            for (feat_idx, &weight) in tfidf_features.iter().enumerate() {
                feature_sums[class_idx][feat_idx] += weight;
            }
        }

        // Compute log probabilities with Laplace smoothing (alpha = 1)
        let alpha = 1.0f64;
        let total_samples = samples.len() as f64;

        // Class log prior: P(class) = count(class) / total
        let class_log_prior: Vec<f64> = class_counts
            .iter()
            .map(|&count| (count as f64 / total_samples).ln())
            .collect();

        // Feature log probabilities: P(feature|class)
        // With Laplace smoothing: (sum + alpha) / (total_class_sum + alpha * n_features)
        // Using TF-IDF sums instead of raw counts
        let feature_log_prob: Vec<Vec<f64>> = feature_sums
            .iter()
            .map(|class_features| {
                let total: f64 = class_features.iter().sum();
                let denom = total + alpha * n_features as f64;

                class_features
                    .iter()
                    .map(|&sum| ((sum + alpha) / denom).ln())
                    .collect()
            })
            .collect();

        self.model = Some(CategorizationModel {
            vocabulary,
            label_to_idx,
            idx_to_label,
            class_log_prior,
            feature_log_prob,
        });

        Ok(())
    }

    /// Predict category for a transaction
    ///
    /// # Arguments
    /// * `tx` - Transaction to categorize
    /// * `min_confidence` - Minimum confidence threshold (0.0 to 1.0)
    ///
    /// # Returns
    /// `Some(CategorizationResult::Suggestion)` if confidence >= min_confidence,
    /// `None` otherwise
    pub fn predict(
        &self,
        tx: &TransactionInput,
        min_confidence: f64,
    ) -> Option<CategorizationResult> {
        let model = self.model.as_ref()?;

        // Combine text fields
        let text = tx.combined_text();
        let (normalized, _) = normalize_czech(&text);

        if normalized.is_empty() {
            return None;
        }

        // Transform to TF-IDF weighted features
        let features = model.vocabulary.transform_tfidf(&normalized);

        // Check if any features were found (any weight > 0)
        let has_features = features.iter().any(|&f| f > 0.0);
        if !has_features {
            return None;
        }

        // Compute log-likelihood for each class using TF-IDF weights
        let n_classes = model.idx_to_label.len();
        let mut log_likelihoods: Vec<f64> = Vec::with_capacity(n_classes);

        for class_idx in 0..n_classes {
            let mut log_prob = model.class_log_prior[class_idx];

            for (feat_idx, &weight) in features.iter().enumerate() {
                if weight > 0.0 {
                    // Use TF-IDF weight instead of raw count
                    log_prob += weight * model.feature_log_prob[class_idx][feat_idx];
                }
            }

            log_likelihoods.push(log_prob);
        }

        // Find max and compute probabilities (softmax)
        let max_log = log_likelihoods
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);

        let exp_sum: f64 = log_likelihoods.iter().map(|&ll| (ll - max_log).exp()).sum();

        let probabilities: Vec<f64> = log_likelihoods
            .iter()
            .map(|&ll| (ll - max_log).exp() / exp_sum)
            .collect();

        // Find best class
        let (best_idx, &best_prob) = probabilities
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .expect("Should have at least one class");

        if best_prob >= min_confidence {
            let category_id = model.idx_to_label[best_idx].clone();
            Some(CategorizationResult::Suggestion {
                category_id,
                confidence: best_prob,
            })
        } else {
            None
        }
    }

    /// Get the number of classes in the model
    pub fn num_classes(&self) -> usize {
        self.model
            .as_ref()
            .map(|m| m.idx_to_label.len())
            .unwrap_or(0)
    }

    /// Get the vocabulary size
    pub fn vocabulary_size(&self) -> usize {
        self.model.as_ref().map(|m| m.vocabulary.len()).unwrap_or(0)
    }

    /// Get the list of known categories
    pub fn categories(&self) -> Vec<&str> {
        self.model
            .as_ref()
            .map(|m| m.idx_to_label.iter().map(|s| s.as_str()).collect())
            .unwrap_or_default()
    }
}

impl Default for MLClassifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vocabulary_fit() {
        let docs = vec![
            "albert hypermarket".to_string(),
            "albert praha".to_string(),
            "lidl nakup".to_string(),
        ];

        let mut vocab = Vocabulary::new();
        vocab.fit(&docs, 100, 1);

        assert!(!vocab.is_empty());
        // "albert" appears in 2 docs
        assert!(vocab.word_to_idx.contains_key("albert"));
    }

    #[test]
    fn test_vocabulary_transform() {
        let docs = vec!["albert hypermarket".to_string(), "albert praha".to_string()];

        let mut vocab = Vocabulary::new();
        vocab.fit(&docs, 100, 1);

        let features = vocab.transform("albert");
        let albert_idx = *vocab.word_to_idx.get("albert").unwrap();
        assert!(features[albert_idx] > 0);
    }

    #[test]
    fn test_train_requires_minimum_samples() {
        let mut classifier = MLClassifier::new();
        let samples = vec![("Albert".to_string(), "cat_groceries".to_string())];

        let result = classifier.train(samples);
        assert!(result.is_err());
    }

    #[test]
    fn test_train_and_predict() {
        let mut classifier = MLClassifier::new();

        // Create training data with clear patterns
        let mut samples = Vec::new();
        for _ in 0..20 {
            samples.push((
                "albert hypermarket nakup".to_string(),
                "cat_groceries".to_string(),
            ));
            samples.push((
                "lidl supermarket potraviny".to_string(),
                "cat_groceries".to_string(),
            ));
        }
        for _ in 0..20 {
            samples.push(("uber eats jidlo".to_string(), "cat_dining".to_string()));
            samples.push(("wolt dorucka".to_string(), "cat_dining".to_string()));
        }

        let result = classifier.train(samples);
        assert!(result.is_ok());
        assert!(classifier.has_model());
        assert_eq!(classifier.num_classes(), 2);

        // Test prediction
        let tx = TransactionInput::new(
            "1".into(),
            Some("Albert nakup potravin".into()),
            None,
            -500.0,
        );

        let prediction = classifier.predict(&tx, 0.5);
        assert!(prediction.is_some());

        match prediction.unwrap() {
            CategorizationResult::Suggestion {
                category_id,
                confidence,
            } => {
                assert_eq!(category_id, "cat_groceries");
                assert!(confidence > 0.5);
            }
            _ => panic!("Expected Suggestion"),
        }
    }

    #[test]
    fn test_predict_low_confidence() {
        let mut classifier = MLClassifier::new();

        // Need more diverse training data to build proper vocabulary
        let mut samples = Vec::new();
        for _ in 0..30 {
            samples.push((
                "albert hypermarket praha nakup".to_string(),
                "cat_groceries".to_string(),
            ));
            samples.push((
                "uber eats dorucka jidlo".to_string(),
                "cat_dining".to_string(),
            ));
            samples.push((
                "lidl supermarket potraviny".to_string(),
                "cat_groceries".to_string(),
            ));
            samples.push((
                "wolt food delivery restaurace".to_string(),
                "cat_dining".to_string(),
            ));
        }

        classifier.train(samples).unwrap();

        // Completely unknown input that doesn't match any training terms
        let tx = TransactionInput::new("1".into(), Some("xyz123 test random".into()), None, -500.0);

        // With high threshold, should return None (no matching features)
        let prediction = classifier.predict(&tx, 0.99);
        assert!(prediction.is_none());
    }
}
