//! Real estate commands

use crate::db::Database;
use crate::error::{AppError, Result};
use crate::models::{
    RealEstate, InsertRealEstate, RealEstateOneTimeCost, InsertRealEstateOneTimeCost, Loan,
    RealEstatePhotoBatch, RealEstatePhoto, InsertPhotoBatch, UpdatePhotoBatch,
    RealEstateDocument, InsertRealEstateDocument,
};
use tauri::{State, Manager};
use uuid::Uuid;
use std::path::PathBuf;
use std::fs;

/// Get all real estate
#[tauri::command]
pub async fn get_all_real_estate(db: State<'_, Database>) -> Result<Vec<RealEstate>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, address, type, purchase_price, purchase_price_currency,
                    market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                    recurring_costs, photos, notes, created_at, updated_at 
             FROM real_estate ORDER BY name"
        )?;
        
        let properties = stmt.query_map([], |row| {
            let rc_json: String = row.get(10)?;
            let photos_json: String = row.get(11)?;
            
            Ok(RealEstate {
                id: row.get(0)?,
                name: row.get(1)?,
                address: row.get(2)?,
                property_type: row.get(3)?,
                purchase_price: row.get(4)?,
                purchase_price_currency: row.get(5)?,
                market_price: row.get(6)?,
                market_price_currency: row.get(7)?,
                monthly_rent: row.get(8)?,
                monthly_rent_currency: row.get(9)?,
                recurring_costs: serde_json::from_str(&rc_json).unwrap_or_default(),
                photos: serde_json::from_str(&photos_json).unwrap_or_default(),
                notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(properties)
    })
}

/// Get single real estate
#[tauri::command]
pub async fn get_real_estate(db: State<'_, Database>, id: String) -> Result<Option<RealEstate>> {
    db.with_conn(|conn| {
        let result = conn.query_row(
            "SELECT id, name, address, type, purchase_price, purchase_price_currency,
                    market_price, market_price_currency, monthly_rent, monthly_rent_currency,
                    recurring_costs, photos, notes, created_at, updated_at 
             FROM real_estate WHERE id = ?1",
            [&id],
            |row| {
                let rc_json: String = row.get(10)?;
                let photos_json: String = row.get(11)?;
                
                Ok(RealEstate {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    address: row.get(2)?,
                    property_type: row.get(3)?,
                    purchase_price: row.get(4)?,
                    purchase_price_currency: row.get(5)?,
                    market_price: row.get(6)?,
                    market_price_currency: row.get(7)?,
                    monthly_rent: row.get(8)?,
                    monthly_rent_currency: row.get(9)?,
                    recurring_costs: serde_json::from_str(&rc_json).unwrap_or_default(),
                    photos: serde_json::from_str(&photos_json).unwrap_or_default(),
                    notes: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        );
        
        match result {
            Ok(re) => Ok(Some(re)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
}

/// Create real estate
#[tauri::command]
pub async fn create_real_estate(db: State<'_, Database>, data: InsertRealEstate) -> Result<RealEstate> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let rc_json = serde_json::to_string(&data.recurring_costs.unwrap_or_default())?;
    let photos_json = serde_json::to_string(&data.photos.unwrap_or_default())?;
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO real_estate (id, name, address, type, purchase_price, purchase_price_currency,
             market_price, market_price_currency, monthly_rent, monthly_rent_currency,
             recurring_costs, photos, notes, created_at, updated_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)",
            rusqlite::params![
                id,
                data.name,
                data.address,
                data.property_type,
                data.purchase_price.unwrap_or_else(|| "0".to_string()),
                data.purchase_price_currency.unwrap_or_else(|| "CZK".to_string()),
                data.market_price.unwrap_or_else(|| "0".to_string()),
                data.market_price_currency.unwrap_or_else(|| "CZK".to_string()),
                data.monthly_rent,
                data.monthly_rent_currency,
                rc_json,
                photos_json,
                data.notes,
                now,
            ],
        )?;
        Ok(())
    })?;
    
    get_real_estate(db, id).await?
        .ok_or_else(|| AppError::Internal("Failed to retrieve created property".into()))
}

/// Update real estate
#[tauri::command]
pub async fn update_real_estate(
    db: State<'_, Database>,
    id: String,
    data: InsertRealEstate,
) -> Result<RealEstate> {
    let now = chrono::Utc::now().timestamp();
    
    db.with_conn(|conn| {
        let rc_json = data.recurring_costs.map(|rc| serde_json::to_string(&rc).ok()).flatten();
        let photos_json = data.photos.map(|p| serde_json::to_string(&p).ok()).flatten();
        
        conn.execute(
            "UPDATE real_estate SET name = ?1, address = ?2, type = ?3,
             purchase_price = COALESCE(?4, purchase_price),
             purchase_price_currency = COALESCE(?5, purchase_price_currency),
             market_price = COALESCE(?6, market_price),
             market_price_currency = COALESCE(?7, market_price_currency),
             monthly_rent = ?8, monthly_rent_currency = ?9,
             recurring_costs = COALESCE(?10, recurring_costs),
             photos = COALESCE(?11, photos), notes = ?12, updated_at = ?13 
             WHERE id = ?14",
            rusqlite::params![
                data.name, data.address, data.property_type,
                data.purchase_price, data.purchase_price_currency,
                data.market_price, data.market_price_currency,
                data.monthly_rent, data.monthly_rent_currency,
                rc_json, photos_json, data.notes, now, id
            ],
        )?;
        Ok(())
    })?;
    
    get_real_estate(db, id).await?
        .ok_or_else(|| AppError::NotFound("Real estate not found".into()))
}

/// Delete real estate
#[tauri::command]
pub async fn delete_real_estate(db: State<'_, Database>, id: String) -> Result<()> {
    db.with_conn(|conn| {
        // Delete documents first
        conn.execute("DELETE FROM real_estate_documents WHERE real_estate_id = ?1", [&id])?;
        let changes = conn.execute("DELETE FROM real_estate WHERE id = ?1", [&id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Real estate not found".into()));
        }
        Ok(())
    })
}

/// Get one-time costs for real estate
#[tauri::command]
pub async fn get_real_estate_costs(
    db: State<'_, Database>,
    real_estate_id: String,
) -> Result<Vec<RealEstateOneTimeCost>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, real_estate_id, name, description, amount, currency, date, created_at 
             FROM real_estate_one_time_costs WHERE real_estate_id = ?1 ORDER BY date DESC"
        )?;
        
        let costs = stmt.query_map([&real_estate_id], |row| {
            Ok(RealEstateOneTimeCost {
                id: row.get(0)?,
                real_estate_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                amount: row.get(4)?,
                currency: row.get(5)?,
                date: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(costs)
    })
}

/// Create one-time cost
#[tauri::command]
pub async fn create_real_estate_cost(
    db: State<'_, Database>,
    data: InsertRealEstateOneTimeCost,
) -> Result<RealEstateOneTimeCost> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let currency = data.currency.unwrap_or_else(|| "CZK".to_string());
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO real_estate_one_time_costs (id, real_estate_id, name, description, amount, currency, date, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, data.real_estate_id, data.name, data.description, data.amount, currency, data.date, now],
        )?;
        
        Ok(RealEstateOneTimeCost {
            id,
            real_estate_id: data.real_estate_id,
            name: data.name,
            description: data.description,
            amount: data.amount,
            currency,
            date: data.date,
            created_at: now,
        })
    })
}

/// Delete one-time cost
#[tauri::command]
pub async fn delete_real_estate_cost(db: State<'_, Database>, cost_id: String) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute("DELETE FROM real_estate_one_time_costs WHERE id = ?1", [&cost_id])?;
        Ok(())
    })
}

/// Update one-time cost
#[tauri::command]
pub async fn update_real_estate_cost(
    db: State<'_, Database>,
    cost_id: String,
    data: InsertRealEstateOneTimeCost,
) -> Result<RealEstateOneTimeCost> {
    let currency = data.currency.unwrap_or_else(|| "CZK".to_string());
    
    db.with_conn(|conn| {
        conn.execute(
            "UPDATE real_estate_one_time_costs 
             SET name = ?2, description = ?3, amount = ?4, currency = ?5, date = ?6 
             WHERE id = ?1",
            rusqlite::params![cost_id, data.name, data.description, data.amount, currency, data.date],
        )?;
        
        // Fetch updated cost
        let cost = conn.query_row(
            "SELECT id, real_estate_id, name, description, amount, currency, date, created_at 
             FROM real_estate_one_time_costs WHERE id = ?1",
            [&cost_id],
            |row| Ok(RealEstateOneTimeCost {
                id: row.get(0)?,
                real_estate_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                amount: row.get(4)?,
                currency: row.get(5)?,
                date: row.get(6)?,
                created_at: row.get(7)?,
            }),
        )?;
        
        Ok(cost)
    })
}

/// Link loan to real estate
#[tauri::command]
pub async fn link_loan_to_real_estate(
    db: State<'_, Database>,
    real_estate_id: String,
    loan_id: String,
) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO real_estate_loans (real_estate_id, loan_id) VALUES (?1, ?2)",
            [&real_estate_id, &loan_id],
        )?;
        Ok(())
    })
}

/// Unlink loan from real estate
#[tauri::command]
pub async fn unlink_loan_from_real_estate(
    db: State<'_, Database>,
    real_estate_id: String,
    loan_id: String,
) -> Result<()> {
    db.with_conn(|conn| {
        conn.execute(
            "DELETE FROM real_estate_loans WHERE real_estate_id = ?1 AND loan_id = ?2",
            [&real_estate_id, &loan_id],
        )?;
        Ok(())
    })
}

/// Get loans linked to real estate
#[tauri::command]
pub async fn get_real_estate_loans(db: State<'_, Database>, real_estate_id: String) -> Result<Vec<Loan>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT l.id, l.name, l.principal, l.currency, l.interest_rate, l.interest_rate_validity_date,
                    l.monthly_payment, l.start_date, l.end_date, l.created_at, l.updated_at 
             FROM loans l
             INNER JOIN real_estate_loans rel ON l.id = rel.loan_id
             WHERE rel.real_estate_id = ?1"
        )?;
        
        let loans = stmt.query_map([&real_estate_id], |row| {
            Ok(Loan {
                id: row.get(0)?,
                name: row.get(1)?,
                principal: row.get(2)?,
                currency: row.get(3)?,
                interest_rate: row.get(4)?,
                interest_rate_validity_date: row.get(5)?,
                monthly_payment: row.get(6)?,
                start_date: row.get(7)?,
                end_date: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(loans)
    })
}

// ============================================================================
// Photo Batch Commands
// ============================================================================

/// Get photos directory for a real estate property
fn get_photos_dir(app_handle: &tauri::AppHandle, real_estate_id: &str, batch_id: &str) -> Result<PathBuf> {
    let app_data = app_handle.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let dir = app_data.join("real_estate_photos").join(real_estate_id).join(batch_id);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Get all photo batches for a real estate property
#[tauri::command]
pub async fn get_real_estate_photo_batches(
    db: State<'_, Database>,
    real_estate_id: String,
) -> Result<Vec<RealEstatePhotoBatch>> {
    db.with_conn(|conn| {
        // Get batches
        let mut batch_stmt = conn.prepare(
            "SELECT id, real_estate_id, photo_date, description, created_at 
             FROM real_estate_photo_batches WHERE real_estate_id = ?1 ORDER BY photo_date DESC"
        )?;
        
        let batches: Vec<(String, String, i64, Option<String>, i64)> = batch_stmt.query_map([&real_estate_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        })?.filter_map(|r| r.ok()).collect();
        
        // Get photos for each batch
        let mut photo_stmt = conn.prepare(
            "SELECT id, batch_id, file_path, thumbnail_path, created_at 
             FROM real_estate_photos WHERE batch_id = ?1 ORDER BY created_at"
        )?;
        
        let result: Vec<RealEstatePhotoBatch> = batches.into_iter().map(|(id, real_estate_id, photo_date, description, created_at)| {
            let photos: Vec<RealEstatePhoto> = photo_stmt.query_map([&id], |row| {
                Ok(RealEstatePhoto {
                    id: row.get(0)?,
                    batch_id: row.get(1)?,
                    file_path: row.get(2)?,
                    thumbnail_path: row.get(3)?,
                    created_at: row.get(4)?,
                })
            }).ok().map(|iter| iter.filter_map(|r| r.ok()).collect()).unwrap_or_default();
            
            RealEstatePhotoBatch {
                id,
                real_estate_id,
                photo_date,
                description,
                photos,
                created_at,
            }
        }).collect();
        
        Ok(result)
    })
}

/// Create a new photo batch (without photos initially)
#[tauri::command]
pub async fn create_photo_batch(
    db: State<'_, Database>,
    real_estate_id: String,
    data: InsertPhotoBatch,
) -> Result<RealEstatePhotoBatch> {
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO real_estate_photo_batches (id, real_estate_id, photo_date, description, created_at) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, real_estate_id, data.photo_date, data.description, now],
        )?;
        
        Ok(RealEstatePhotoBatch {
            id,
            real_estate_id,
            photo_date: data.photo_date,
            description: data.description,
            photos: vec![],
            created_at: now,
        })
    })
}

/// Add photos to existing batch
#[tauri::command]
pub async fn add_photos_to_batch(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    batch_id: String,
    file_paths: Vec<String>,
) -> Result<Vec<RealEstatePhoto>> {
    // Get real_estate_id for directory
    let real_estate_id: String = db.with_conn(|conn| {
        conn.query_row(
            "SELECT real_estate_id FROM real_estate_photo_batches WHERE id = ?1",
            [&batch_id],
            |row| row.get(0),
        ).map_err(|_| AppError::NotFound("Batch not found".into()))
    })?;
    
    let photos_dir = get_photos_dir(&app_handle, &real_estate_id, &batch_id)?;
    let now = chrono::Utc::now().timestamp();
    let mut created_photos = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    
    for source_path in &file_paths {
        let source = PathBuf::from(source_path);
        
        // Check if file exists
        if !source.exists() {
            errors.push(format!("File not found: {}", source_path));
            continue;
        }
        
        let photo_id = Uuid::new_v4().to_string();
        // Always save as jpg for consistency
        let file_name = format!("{}.jpg", photo_id);
        let thumb_name = format!("{}_thumb.jpg", photo_id);
        let dest_path = photos_dir.join(&file_name);
        let thumb_path = photos_dir.join(&thumb_name);
        
        // Load and optionally resize original image
        match image::open(&source) {
            Ok(img) => {
                // Resize if larger than 2560px on longest edge
                let resized = if img.width() > 2560 || img.height() > 2560 {
                    img.resize(2560, 2560, image::imageops::FilterType::Lanczos3)
                } else {
                    img.clone()
                };
                
                // Save resized original
                if let Err(e) = resized.save(&dest_path) {
                    errors.push(format!("Failed to save image: {}", e));
                    continue;
                }
                
                // Create thumbnail (400px width)
                let thumb = img.thumbnail(400, 400);
                if let Err(e) = thumb.save(&thumb_path) {
                    // Clean up original if thumbnail fails
                    let _ = fs::remove_file(&dest_path);
                    errors.push(format!("Failed to save thumbnail: {}", e));
                    continue;
                }
                
                // Store relative paths in DB
                let rel_file = format!("real_estate_photos/{}/{}/{}", real_estate_id, batch_id, file_name);
                let rel_thumb = format!("real_estate_photos/{}/{}/{}", real_estate_id, batch_id, thumb_name);
                
                db.with_conn(|conn| {
                    conn.execute(
                        "INSERT INTO real_estate_photos (id, batch_id, file_path, thumbnail_path, created_at) 
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        rusqlite::params![photo_id, batch_id, rel_file, rel_thumb, now],
                    )?;
                    Ok(())
                })?;
                
                created_photos.push(RealEstatePhoto {
                    id: photo_id,
                    batch_id: batch_id.clone(),
                    file_path: rel_file,
                    thumbnail_path: rel_thumb,
                    created_at: now,
                });
            }
            Err(e) => {
                errors.push(format!("Failed to open image {}: {}", source_path, e));
            }
        }
    }
    
    // If we had files but none were processed, return an error with details
    if !file_paths.is_empty() && created_photos.is_empty() {
        return Err(AppError::Internal(format!(
            "No photos could be processed. Errors: {}",
            errors.join("; ")
        )));
    }
    
    Ok(created_photos)
}

/// Update photo batch metadata
#[tauri::command]
pub async fn update_photo_batch(
    db: State<'_, Database>,
    batch_id: String,
    data: UpdatePhotoBatch,
) -> Result<RealEstatePhotoBatch> {
    db.with_conn(|conn| {
        // Build update query dynamically
        let mut updates = Vec::new();
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(date) = data.photo_date {
            updates.push("photo_date = ?");
            params.push(Box::new(date));
        }
        if let Some(ref desc) = data.description {
            updates.push("description = ?");
            params.push(Box::new(desc.clone()));
        }
        
        if updates.is_empty() {
            return Err(AppError::Validation("No fields to update".into()));
        }
        
        let sql = format!(
            "UPDATE real_estate_photo_batches SET {} WHERE id = ?",
            updates.join(", ")
        );
        params.push(Box::new(batch_id.clone()));
        
        let params_ref: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_ref.as_slice())?;
        
        // Fetch updated batch with photos
        let batch = conn.query_row(
            "SELECT id, real_estate_id, photo_date, description, created_at 
             FROM real_estate_photo_batches WHERE id = ?1",
            [&batch_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?, row.get::<_, Option<String>>(3)?, row.get::<_, i64>(4)?)),
        )?;
        
        let mut photo_stmt = conn.prepare(
            "SELECT id, batch_id, file_path, thumbnail_path, created_at 
             FROM real_estate_photos WHERE batch_id = ?1"
        )?;
        let photos: Vec<RealEstatePhoto> = photo_stmt.query_map([&batch_id], |row| {
            Ok(RealEstatePhoto {
                id: row.get(0)?,
                batch_id: row.get(1)?,
                file_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(RealEstatePhotoBatch {
            id: batch.0,
            real_estate_id: batch.1,
            photo_date: batch.2,
            description: batch.3,
            photos,
            created_at: batch.4,
        })
    })
}

/// Delete a photo batch and all its photos
#[tauri::command]
pub async fn delete_photo_batch(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    batch_id: String,
) -> Result<()> {
    // Get real_estate_id for directory cleanup
    let real_estate_id: String = db.with_conn(|conn| {
        conn.query_row(
            "SELECT real_estate_id FROM real_estate_photo_batches WHERE id = ?1",
            [&batch_id],
            |row| row.get(0),
        ).map_err(|_| AppError::NotFound("Batch not found".into()))
    })?;
    
    // Delete from database (CASCADE will delete photos)
    db.with_conn(|conn| {
        conn.execute("DELETE FROM real_estate_photo_batches WHERE id = ?1", [&batch_id])?;
        Ok(())
    })?;
    
    // Delete directory
    let app_data = app_handle.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let batch_dir = app_data.join("real_estate_photos").join(&real_estate_id).join(&batch_id);
    if batch_dir.exists() {
        let _ = fs::remove_dir_all(batch_dir);
    }
    
    Ok(())
}

/// Delete a single photo from a batch
#[tauri::command]
pub async fn delete_real_estate_photo(
    app_handle: tauri::AppHandle,
    db: State<'_, Database>,
    photo_id: String,
) -> Result<()> {
    // Get paths before deletion
    let (file_path, thumb_path): (String, String) = db.with_conn(|conn| {
        conn.query_row(
            "SELECT file_path, thumbnail_path FROM real_estate_photos WHERE id = ?1",
            [&photo_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).map_err(|_| AppError::NotFound("Photo not found".into()))
    })?;
    
    // Delete from database
    db.with_conn(|conn| {
        conn.execute("DELETE FROM real_estate_photos WHERE id = ?1", [&photo_id])?;
        Ok(())
    })?;
    
    // Delete files
    let app_data = app_handle.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let _ = fs::remove_file(app_data.join(&file_path));
    let _ = fs::remove_file(app_data.join(&thumb_path));
    
    Ok(())
}

// ============================================================================
// Document Commands
// ============================================================================

/// Get all documents for a real estate property
#[tauri::command]
pub async fn get_real_estate_documents(
    db: State<'_, Database>,
    real_estate_id: String,
) -> Result<Vec<RealEstateDocument>> {
    db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, real_estate_id, name, description, file_path, file_type, file_size, uploaded_at 
             FROM real_estate_documents WHERE real_estate_id = ?1 ORDER BY uploaded_at DESC"
        )?;
        
        let documents = stmt.query_map([&real_estate_id], |row| {
            Ok(RealEstateDocument {
                id: row.get(0)?,
                real_estate_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                file_path: row.get(4)?,
                file_type: row.get(5)?,
                file_size: row.get(6)?,
                uploaded_at: row.get(7)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        
        Ok(documents)
    })
}

/// Add a document to a real estate property
#[tauri::command]
pub async fn add_real_estate_document(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    real_estate_id: String,
    file_path: String,
    data: InsertRealEstateDocument,
) -> Result<RealEstateDocument> {
    use std::path::Path;
    
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    // Get app data directory for storing documents
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| AppError::Internal(format!("Failed to get app data dir: {}", e)))?;
    let documents_dir = app_data_dir.join("real_estate_documents").join(&real_estate_id);
    
    // Create documents directory if it doesn't exist
    fs::create_dir_all(&documents_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create documents dir: {}", e)))?;
    
    // Get file info
    let source_path = Path::new(&file_path);
    let file_name = source_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document");
    
    let file_size = fs::metadata(&source_path)
        .map(|m| m.len() as i64)
        .ok();
    
    // Copy file to app data directory
    let dest_path = documents_dir.join(format!("{}_{}", id, file_name));
    fs::copy(&source_path, &dest_path)
        .map_err(|e| AppError::Internal(format!("Failed to copy file: {}", e)))?;
    
    let dest_path_str = dest_path.to_string_lossy().to_string();
    let file_type = data.file_type.unwrap_or_else(|| "other".to_string());
    
    db.with_conn(|conn| {
        conn.execute(
            "INSERT INTO real_estate_documents (id, real_estate_id, name, description, file_path, file_type, file_size, uploaded_at) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, real_estate_id, data.name, data.description, dest_path_str, file_type, file_size, now],
        )?;
        
        Ok(RealEstateDocument {
            id,
            real_estate_id,
            name: data.name,
            description: data.description,
            file_path: dest_path_str,
            file_type,
            file_size,
            uploaded_at: now,
        })
    })
}

/// Delete a real estate document
#[tauri::command]
pub async fn delete_real_estate_document(db: State<'_, Database>, document_id: String) -> Result<()> {
    // Get file path before deleting
    let file_path: String = db.with_conn(|conn| {
        conn.query_row(
            "SELECT file_path FROM real_estate_documents WHERE id = ?1",
            [&document_id],
            |row| row.get(0),
        ).map_err(|_| AppError::NotFound("Document not found".into()))
    })?;
    
    // Delete from database
    db.with_conn(|conn| {
        let changes = conn.execute("DELETE FROM real_estate_documents WHERE id = ?1", [&document_id])?;
        if changes == 0 {
            return Err(AppError::NotFound("Document not found".into()));
        }
        Ok(())
    })?;
    
    // Delete file (ignore errors if file doesn't exist)
    let _ = fs::remove_file(&file_path);
    
    Ok(())
}

/// Open a real estate document with the system default application
#[tauri::command]
pub async fn open_real_estate_document(db: State<'_, Database>, document_id: String) -> Result<()> {
    let file_path: String = db.with_conn(|conn| {
        conn.query_row(
            "SELECT file_path FROM real_estate_documents WHERE id = ?1",
            [&document_id],
            |row| row.get(0),
        ).map_err(|_| AppError::NotFound("Document not found".into()))
    })?;
    
    // Open with system default application
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&file_path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to open file: {}", e)))?;
    
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&file_path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to open file: {}", e)))?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&file_path)
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to open file: {}", e)))?;
    
    Ok(())
}
