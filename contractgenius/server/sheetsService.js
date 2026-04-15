const { google } = require('googleapis');
const path = require('path');

// Re-using the same authentication as driveService
const KEYFILEPATH = path.join(__dirname, 'service-account-key.json');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        });
        console.log('📊 Sheets Auth: Using credentials from environment');
    } catch (e) {
        console.error('⚠️ Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON for Sheets:', e.message);
    }
}

if (!auth) {
    auth = new google.auth.GoogleAuth({
        keyFile: KEYFILEPATH,
        scopes: SCOPES,
    });
}

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Appends a new contract submission to the central Google Sheet
 * @param {Object} contract - The full contract object including vendor data
 */
async function appendContractRow(contract) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.warn('⚠️ GOOGLE_SPREADSHEET_ID is not set. Skipping Sheets aggregation.');
        return null;
    }

    try {
        const vendor = contract.vendorDetails || contract.vendor;
        const fixturesStr = vendor.selectedFixtures ? vendor.selectedFixtures.map(f => `${f.type} (x${f.quantity})`).join(', ') : '';
        const brandsStr = vendor.brands ? vendor.brands.map(b => b.brandName).join(', ') : vendor.name;
        
        // Define the row mapping (Ensure your Google Sheet columns match this order)
        // [Date, Contract ID, Company, Brands, Contact, Email, Booth Size, Fixtures, Base Amount, CC Fee, Total, Status]
        const rowData = [
            [
                new Date(contract.createdAt).toLocaleString(),
                contract.id,
                vendor.company || 'N/A',
                brandsStr || 'N/A',
                vendor.contacts?.[0]?.name || vendor.name || 'N/A',
                vendor.contacts?.[0]?.email || vendor.email || 'N/A',
                vendor.finalBoothSize || vendor.boothSize || 'N/A',
                fixturesStr || 'N/A',
                `$${vendor.baseAmount || 0}`,
                `$${vendor.ccFee || 0}`,
                `$${vendor.totalAmount || 0}`,
                contract.status || 'draft',
                JSON.stringify(contract) // Column M: Raw Data for perfect reconstruction
            ]
        ];

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:M', // Extended to M
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: rowData,
            },
        });

        console.log(`[SheetsService] ✅ Successfully appended row for contract ${contract.id}`);
        return response.data;
    } catch (error) {
        console.error('[SheetsService] ❌ Failed to append row to sheets:', error.message);
        throw error;
    }
}

/**
 * Updates a specific contract status in the Google Sheet (Tab 1: Sheet1)
 * @param {string} contractId - The unique ID of the contract to update
 * @param {string} newStatus - The new status (e.g., 'PAID', 'signed')
 */
async function syncPaymentStatus(contractId, newStatus) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) return;

    try {
        // 1. Fetch all Contract IDs from Column B to find the correct row
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!B2:B5000', // Assumes ID is in Col B
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === contractId);

        if (rowIndex === -1) {
            console.warn(`[SheetsService] ⚠️ Could not find Contract ID ${contractId} in Sheet1 to update status.`);
            return;
        }

        // 2. Update Column L (12th column) for that specific row
        // Sheet index is 1-based, plus 1 for the header row we skipped
        const actualSheetRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Sheet1!L${actualSheetRow}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newStatus.toUpperCase()]]
            }
        });

        console.log(`[SheetsService] ✅ Status updated in Sheets for ${contractId} -> ${newStatus}`);
    } catch (error) {
        console.error('[SheetsService] ❌ Failed to update status in sheets:', error.message);
    }
}

/**
 * Fetches all contract rows from the sheet
 * @returns {Promise<Array>}
 */
async function getAllRows() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) return [];

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Sheet1!A2:M1000', // Fetch up to 1000 rows
        });
        return response.data.values || [];
    } catch (error) {
        console.error('[SheetsService] Failed to fetch all rows:', error.message);
        return [];
    }
}

/**
 * Fetches a specific contract by its ID from the Spreadsheet
 * @param {string} contractId 
 * @returns {Promise<Object|null>}
 */
async function getContractById(contractId) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) return null;

    try {
        const rows = await getAllRows();
        const row = rows.find(r => r[1] === contractId);

        if (!row) return null;

        // Try to reconstruct from Column M (Raw JSON) if it exists
        if (row[12]) {
            try {
                const contract = JSON.parse(row[12]);
                // Ensure the status is synced with the Column L (Status) which might have been updated
                contract.status = row[11].toLowerCase();
                return contract;
            } catch (e) {
                console.warn('[SheetsService] Failed to parse raw data for', contractId, 'falling back to column mapping');
            }
        }

        // Fallback: Manual mapping if M is empty
        return {
            id: row[1],
            createdAt: new Date(row[0]).getTime(),
            status: row[11].toLowerCase(),
            vendorDetails: {
                company: row[2],
                email: row[5],
                finalBoothSize: row[6],
                totalAmount: parseFloat(row[10].replace('$', '')) || 0
            }
        };
    } catch (error) {
        console.error('[SheetsService] Error getting contract by ID:', error.message);
        return null;
    }
}

module.exports = {
    appendContractRow,
    syncPaymentStatus,
    getContractById,
    getAllRows
};
