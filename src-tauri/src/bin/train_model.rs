//! ML Model Training CLI
//!
//! This binary trains the categorization ML model using synthetic training data
//! and saves it to a file that ships with the application.
//!
//! # Usage
//! ```bash
//! cd src-tauri
//! cargo run --bin train_model
//! ```

use moony_tauri_lib::services::categorization::{
    ml_classifier::MLClassifier, training_data::generate_training_data,
};
use std::fs;
use std::path::Path;

fn main() -> anyhow::Result<()> {
    // Initialize logger for progress output
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    println!("🚀 ML Model Training Tool");
    println!("========================\n");

    // Step 1: Generate training data
    println!("📊 Generating training data...");
    let samples = generate_training_data();
    println!("   Generated {} training samples", samples.len());

    // Count samples per category
    let mut category_counts: std::collections::HashMap<&str, usize> =
        std::collections::HashMap::new();
    for (_, cat) in &samples {
        *category_counts.entry(cat.as_str()).or_insert(0) += 1;
    }
    println!("\n   Samples per category:");
    let mut sorted_cats: Vec<_> = category_counts.iter().collect();
    sorted_cats.sort_by(|a, b| b.1.cmp(a.1));
    for (cat, count) in sorted_cats {
        println!("   - {}: {} samples", cat, count);
    }

    // Step 2: Train the classifier
    println!("\n🧠 Training ML classifier...");
    let mut classifier = MLClassifier::new();
    classifier.train(samples)?;
    println!("   Training complete!");
    println!(
        "   - Vocabulary size: {} terms",
        classifier.vocabulary_size()
    );
    println!("   - Number of classes: {}", classifier.num_classes());

    // Step 3: Save the model
    let model_dir = Path::new("resources");
    let model_path = model_dir.join("categorization_model.bin");

    // Create resources directory if it doesn't exist
    if !model_dir.exists() {
        fs::create_dir_all(model_dir)?;
        println!("\n📁 Created resources directory");
    }

    println!("\n💾 Saving model to {:?}...", model_path);
    classifier.save_model(&model_path)?;

    // Get file size
    let metadata = fs::metadata(&model_path)?;
    let size_kb = metadata.len() as f64 / 1024.0;
    println!("   Model saved! Size: {:.1} KB", size_kb);

    println!("\n✅ Model trained and saved successfully!");
    println!("\nThe model file is at: src-tauri/{}", model_path.display());
    println!("This file should be included in your app bundle.\n");

    Ok(())
}
