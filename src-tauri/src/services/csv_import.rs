//! CSV Import Service for Bank Transactions
//!
//! Provides functionality to import bank transactions from CSV files with:
//! - Bank-specific presets for Czech banks (ČS, Fio, Air Bank, etc.)
//! - Auto-detection of CSV format based on column headers
//! - Regex patterns for EN/CZ column matching
//! - Duplicate detection

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Bank-specific CSV format preset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankCsvPreset {
    pub institution_id: String,
    pub bank_name: String,
    pub delimiter: char,
    pub encoding: String,
    pub skip_rows: usize,
    pub date_column: String,
    pub date_format: String,
    pub amount_column: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable_symbol_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency_column: Option<String>,
    /// Some banks split credits/debits into separate columns
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credit_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debit_column: Option<String>,
}

/// Column mapping suggestion with confidence score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnMapping {
    pub column_name: String,
    pub maps_to: String,
    pub confidence: f32,
}

/// Result of CSV format detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvFormatDetection {
    pub detected_preset: Option<String>,
    pub delimiter: char,
    pub encoding: String,
    pub skip_rows: usize,
    pub headers: Vec<String>,
    pub column_mappings: Vec<ColumnMapping>,
    pub sample_rows: Vec<Vec<String>>,
    pub confidence: f32,
}

/// Configuration for CSV import
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportConfig {
    pub delimiter: char,
    pub encoding: String,
    pub skip_rows: usize,
    pub date_column: String,
    pub date_format: String,
    pub amount_column: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub counterparty_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub variable_symbol_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency_column: Option<String>,
    /// For banks with separate credit/debit columns
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credit_column: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debit_column: Option<String>,
}

/// Result of CSV import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportResult {
    pub imported_count: usize,
    pub duplicate_count: usize,
    pub error_count: usize,
    pub errors: Vec<String>,
}

/// Column name patterns for auto-detection (supports CZ/EN)
pub struct ColumnPatterns;

impl ColumnPatterns {
    pub fn date_patterns() -> Vec<&'static str> {
        vec![
            r"(?i)^datum$",
            r"(?i)^date$",
            r"(?i)^datum\s*(zaúčtování|splatnosti|operace|provedení)?$",
            r"(?i)^booking\s*date$",
            r"(?i)^value\s*date$",
            r"(?i)^datum\s*valuty$",
            r"(?i)^transaction\s*date$",
        ]
    }

    pub fn amount_patterns() -> Vec<&'static str> {
        vec![
            r"(?i)^částka$",
            r"(?i)^castka$",
            r"(?i)^amount$",
            r"(?i)^suma$",
            r"(?i)^objem$",
            r"(?i)^hodnota$",
            r"(?i)^transaction\s*amount$",
            r"(?i)^částka\s*(v\s*měně\s*účtu)?$",
        ]
    }

    pub fn description_patterns() -> Vec<&'static str> {
        vec![
            r"(?i)^popis$",
            r"(?i)^poznámka$",
            r"(?i)^poznamka$",
            r"(?i)^description$",
            r"(?i)^message$",
            r"(?i)^zpráva\s*(pro\s*příjemce)?$",
            r"(?i)^zprava$",
            r"(?i)^účel\s*platby$",
            r"(?i)^ucel\s*platby$",
            r"(?i)^poznámka\s*k\s*platbě$",
        ]
    }

    pub fn counterparty_patterns() -> Vec<&'static str> {
        vec![
            r"(?i)^příjemce$",
            r"(?i)^prijemce$",
            r"(?i)^odesílatel$",
            r"(?i)^protistrana$",
            r"(?i)^název\s*protiúčtu$",
            r"(?i)^counterparty$",
            r"(?i)^beneficiary$",
            r"(?i)^merchant$",
            r"(?i)^obchodník$",
            r"(?i)^název\s*protistrany$",
            r"(?i)^protiúčet$",
        ]
    }

    pub fn variable_symbol_patterns() -> Vec<&'static str> {
        vec![
            r"(?i)^vs$",
            r"(?i)^variabilní\s*symbol$",
            r"(?i)^variabilni\s*symbol$",
            r"(?i)^var\.?\s*symbol$",
        ]
    }

    pub fn currency_patterns() -> Vec<&'static str> {
        vec![r"(?i)^měna$", r"(?i)^mena$", r"(?i)^currency$"]
    }
}

/// Get predefined bank CSV presets for Czech banks
pub fn get_bank_presets() -> Vec<BankCsvPreset> {
    vec![
        // Česká spořitelna
        BankCsvPreset {
            institution_id: "inst_ceska_sporitelna".into(),
            bank_name: "Česká spořitelna".into(),
            delimiter: ';',
            encoding: "Windows-1250".into(),
            skip_rows: 0,
            date_column: "Datum zaúčtování".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Částka".into(),
            description_column: Some("Zpráva pro příjemce".into()),
            counterparty_column: Some("Název protiúčtu".into()),
            variable_symbol_column: Some("VS".into()),
            currency_column: Some("Měna".into()),
            credit_column: None,
            debit_column: None,
        },
        // Fio banka
        BankCsvPreset {
            institution_id: "inst_fio".into(),
            bank_name: "Fio banka".into(),
            delimiter: ';',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "Datum".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Objem".into(),
            description_column: Some("Poznámka".into()),
            counterparty_column: Some("Protiúčet".into()),
            variable_symbol_column: Some("VS".into()),
            currency_column: Some("Měna".into()),
            credit_column: None,
            debit_column: None,
        },
        // Air Bank
        BankCsvPreset {
            institution_id: "inst_air_bank".into(),
            bank_name: "Air Bank".into(),
            delimiter: ';',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "Datum provedení".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Částka v měně účtu".into(),
            description_column: Some("Poznámka k platbě".into()),
            counterparty_column: Some("Název protistrany".into()),
            variable_symbol_column: Some("Variabilní symbol".into()),
            currency_column: None,
            credit_column: None,
            debit_column: None,
        },
        // ČSOB
        BankCsvPreset {
            institution_id: "inst_csob".into(),
            bank_name: "ČSOB".into(),
            delimiter: ';',
            encoding: "Windows-1250".into(),
            skip_rows: 1,
            date_column: "datum zaúčtování".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "částka".into(),
            description_column: Some("zpráva pro příjemce".into()),
            counterparty_column: Some("název protiúčtu".into()),
            variable_symbol_column: Some("VS".into()),
            currency_column: Some("měna".into()),
            credit_column: None,
            debit_column: None,
        },
        // Komerční banka
        BankCsvPreset {
            institution_id: "inst_komercni_banka".into(),
            bank_name: "Komerční banka".into(),
            delimiter: ';',
            encoding: "Windows-1250".into(),
            skip_rows: 0,
            date_column: "Datum splatnosti".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Částka".into(),
            description_column: Some("Popis příkazce".into()),
            counterparty_column: Some("Název protiúčtu".into()),
            variable_symbol_column: Some("VS".into()),
            currency_column: Some("Měna".into()),
            credit_column: None,
            debit_column: None,
        },
        // Raiffeisenbank
        BankCsvPreset {
            institution_id: "inst_raiffeisenbank".into(),
            bank_name: "Raiffeisenbank".into(),
            delimiter: ';',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "Datum zaúčtování".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Zaúčtovaná částka".into(),
            description_column: Some("Zpráva pro příjemce".into()),
            counterparty_column: Some("Název protiúčtu".into()),
            variable_symbol_column: Some("Variabilní symbol".into()),
            currency_column: Some("Měna účtu".into()),
            credit_column: None,
            debit_column: None,
        },
        // mBank
        BankCsvPreset {
            institution_id: "inst_mbank".into(),
            bank_name: "mBank".into(),
            delimiter: ';',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "#Datum operace".into(),
            date_format: "%d-%m-%Y".into(),
            amount_column: "#Částka".into(),
            description_column: Some("#Popis operace".into()),
            counterparty_column: Some("#Příjemce/plátce".into()),
            variable_symbol_column: None,
            currency_column: None,
            credit_column: None,
            debit_column: None,
        },
        // Moneta Money Bank
        BankCsvPreset {
            institution_id: "inst_moneta".into(),
            bank_name: "MONETA Money Bank".into(),
            delimiter: ';',
            encoding: "Windows-1250".into(),
            skip_rows: 0,
            date_column: "Datum zaúčtování".into(),
            date_format: "%d.%m.%Y".into(),
            amount_column: "Částka".into(),
            description_column: Some("Poznámka".into()),
            counterparty_column: Some("Název protistrany".into()),
            variable_symbol_column: Some("VS".into()),
            currency_column: Some("Měna".into()),
            credit_column: None,
            debit_column: None,
        },
        // Revolut
        BankCsvPreset {
            institution_id: "inst_revolut".into(),
            bank_name: "Revolut".into(),
            delimiter: ',',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "Completed Date".into(),
            date_format: "%Y-%m-%d %H:%M:%S".into(),
            amount_column: "Amount".into(),
            description_column: Some("Description".into()),
            counterparty_column: None,
            variable_symbol_column: None,
            currency_column: Some("Currency".into()),
            credit_column: None,
            debit_column: None,
        },
        // Wise
        BankCsvPreset {
            institution_id: "inst_wise".into(),
            bank_name: "Wise".into(),
            delimiter: ',',
            encoding: "UTF-8".into(),
            skip_rows: 0,
            date_column: "Date".into(),
            date_format: "%d-%m-%Y".into(),
            amount_column: "Amount".into(),
            description_column: Some("Description".into()),
            counterparty_column: Some("Payee Name".into()),
            variable_symbol_column: None,
            currency_column: Some("Currency".into()),
            credit_column: None,
            debit_column: None,
        },
    ]
}

/// Get preset by institution ID
pub fn get_preset_by_institution(institution_id: &str) -> Option<BankCsvPreset> {
    get_bank_presets()
        .into_iter()
        .find(|p| p.institution_id == institution_id)
}

/// Check if a header matches any pattern in the list
#[allow(dead_code)]
fn matches_patterns(header: &str, patterns: &[&str]) -> bool {
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if re.is_match(header) {
                return true;
            }
        }
    }
    false
}

/// Try to match headers against known column patterns
/// Returns a map of field_name -> (column_name, confidence)
pub fn suggest_column_mappings(headers: &[String]) -> HashMap<String, (String, f32)> {
    let mut mappings: HashMap<String, (String, f32)> = HashMap::new();

    for header in headers {
        let header_lower = header.to_lowercase();

        // Check date patterns
        for pattern in ColumnPatterns::date_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = if header_lower == "datum" || header_lower == "date" {
                        0.95
                    } else {
                        0.80
                    };
                    if !mappings.contains_key("date") || mappings["date"].1 < confidence {
                        mappings.insert("date".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }

        // Check amount patterns
        for pattern in ColumnPatterns::amount_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = if header_lower.contains("částka") || header_lower == "amount"
                    {
                        0.95
                    } else {
                        0.80
                    };
                    if !mappings.contains_key("amount") || mappings["amount"].1 < confidence {
                        mappings.insert("amount".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }

        // Check description patterns
        for pattern in ColumnPatterns::description_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = 0.85;
                    if !mappings.contains_key("description")
                        || mappings["description"].1 < confidence
                    {
                        mappings.insert("description".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }

        // Check counterparty patterns
        for pattern in ColumnPatterns::counterparty_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = 0.85;
                    if !mappings.contains_key("counterparty")
                        || mappings["counterparty"].1 < confidence
                    {
                        mappings.insert("counterparty".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }

        // Check variable symbol patterns
        for pattern in ColumnPatterns::variable_symbol_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = 0.90;
                    if !mappings.contains_key("variable_symbol")
                        || mappings["variable_symbol"].1 < confidence
                    {
                        mappings.insert("variable_symbol".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }

        // Check currency patterns
        for pattern in ColumnPatterns::currency_patterns() {
            if let Ok(re) = regex::Regex::new(pattern) {
                if re.is_match(&header_lower) {
                    let confidence = 0.90;
                    if !mappings.contains_key("currency") || mappings["currency"].1 < confidence {
                        mappings.insert("currency".into(), (header.clone(), confidence));
                    }
                    break;
                }
            }
        }
    }

    mappings
}
