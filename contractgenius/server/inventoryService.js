/**
 * INVENTORY SERVICE
 * Manages fixture stock levels by reading/writing from Google Sheets (Tab: Inventory).
 * Prevents over-booking and triggers AI alerts when stock is low.
 */

const { google } = require('googleapis');
const path = require('path');
const { sendLowStockAlert } = require('./emailService');
const { analyzeInventoryRisk } = require('./aiService');

const KEYFILEPATH = path.join(__dirname, 'service-account-key.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    } catch (e) {
        console.error('⚠️ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON for Inventory:', e.message);
    }
}
if (!auth) {
    auth = new google.auth.GoogleAuth({ keyFile: KEYFILEPATH, scopes: SCOPES });
}

const sheets = google.sheets({ version: 'v4', auth });

// Sheet tab name for inventory (Tab 2)
const INVENTORY_SHEET_TAB = 'Fixture Inventory';
const LOW_STOCK_THRESHOLD_PERCENT = 0.10; // Alert when below 10%

/**
 * Reads all current inventory from the Google Sheet.
 * Sheet layout (Fixture Inventory tab):
 *   Row 1-3: title / legend / column headers
 *   Row 4+:  data rows
 *   Col A: Fixture Name | B: Category | C: Min Qty | D: Total Stock
 *   Col E: Booked Count | F: Available | G: Alert Threshold
 *   Col H: Status       | I: Is Sold Out (Admin Toggle – YES/NO)
 * @returns {Promise<Array>} array of { fixtureName, totalStock, bookedCount, available, alertThreshold, isSoldOut }
 */
async function getInventory() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.warn('[InventoryService] No GOOGLE_SPREADSHEET_ID set. Returning empty inventory.');
        return [];
    }

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${INVENTORY_SHEET_TAB}!A4:I20`,
        });

        const rows = response.data.values || [];
        return rows
            .map(row => {
                const available       = parseInt(row[5]) || 0;
                const statusSoldOut   = (row[7] || '').toLowerCase().includes('sold out');
                const adminSoldOut    = (row[8] || '').toString().trim().toUpperCase() === 'YES';
                const isSoldOut       = adminSoldOut || statusSoldOut || available <= 0;
                return {
                    fixtureName:    row[0] || '',
                    totalStock:     parseInt(row[3]) || 0,
                    bookedCount:    parseInt(row[4]) || 0,
                    available,
                    alertThreshold: parseInt(row[6]) || 2,
                    isSoldOut,
                };
            })
            .filter(item => item.fixtureName);

    } catch (error) {
        console.error('[InventoryService] Failed to read inventory:', error.message);
        return [];
    }
}

/**
 * Deducts stock for the fixtures booked in a new contract
 * @param {Array} selectedFixtures - Array of { type, quantity } from the contract
 */
async function deductInventory(selectedFixtures) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId || !selectedFixtures?.length) return;

    try {
        const inventory = await getInventory();

        for (const fixture of selectedFixtures) {
            const inventoryRow = inventory.findIndex(
                i => i.fixtureName.toLowerCase() === fixture.type.toLowerCase()
            );

            if (inventoryRow === -1) continue; // Not tracked, skip

            const item = inventory[inventoryRow];
            const newBooked    = item.bookedCount + fixture.quantity;
            const newAvailable = Math.max(0, item.totalStock - newBooked);

            // Data starts at sheet row 4, inventoryRow is 0-indexed
            const sheetRowIndex = inventoryRow + 4;

            // Update Booked Count (Col E) and Available (Col F)
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${INVENTORY_SHEET_TAB}!E${sheetRowIndex}:F${sheetRowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[newBooked, newAvailable]] },
            });

            console.log(`[InventoryService] Updated ${fixture.type}: booked=${newBooked}, available=${newAvailable}`);

            // Check low stock threshold and send alert
            const lowStockThreshold = Math.ceil(item.total * LOW_STOCK_THRESHOLD_PERCENT);
            if (newAvailable <= lowStockThreshold) {
                console.warn(`[InventoryService] AI Agent analyzing stock risk for ${fixtureName}: ${newAvailable}/${item.total}`);
                
                const aiRecommendation = await analyzeInventoryRisk(fixture.type, newAvailable, item.total);
                
                sendLowStockAlert(fixture.type, newAvailable, item.total, aiRecommendation).catch(e =>
                    console.error(`[InventoryService] AI Email alert failed for ${fixtureName}:`, e.message)
                );
            }
        }
    } catch (error) {
        console.error('[InventoryService] Failed to deduct inventory:', error.message);
    }
}

module.exports = { getInventory, deductInventory };
