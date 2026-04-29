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

const BOOKING_HEADERS = [
    'Date', 'Contract ID', 'Exhibitor Type', 'Company / Address', 'Brand(s)', 
    'Brand Websites', 'Brand Instagram', 'Contact Name', 'Contact Title', 
    'Contact Email', 'Contact Phone', 'Extra Contacts', 'Categories', 
    'Booth Size', 'Custom Booth Size', 'Custom Booth Requirements', 
    'Fixtures', 'Event Date(s)', 'Special Requirements', 'Payment Mode', 
    'Notes', 'Base Amount', 'CC Fee', 'Total Amount', 'Status'
];

async function ensureHeaders(spreadsheetId, sheetName = 'Booking Summary') {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:Y1`,
        });
        const firstRow = response.data.values?.[0];
        if (!firstRow || firstRow.length === 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1:Y1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [BOOKING_HEADERS] },
            });
            console.log(`[SheetsService] ✅ Headers added to ${sheetName}`);
        }
    } catch (e) {
        console.error(`[SheetsService] ⚠️ Could not ensure headers for ${sheetName}:`, e.message);
    }
}

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
        await ensureHeaders(spreadsheetId);

        const vendor = contract.vendorDetails || contract.vendor;

        // Brands
        const brandsStr = vendor.brands?.filter(b => b.brandName).map(b => b.brandName).join(', ') || vendor.name || 'N/A';
        const brandWebsites = vendor.brands?.filter(b => b.website).map(b => b.website).join(', ') || 'N/A';
        const brandInstagrams = vendor.brands?.filter(b => b.instagram).map(b => b.instagram).join(', ') || 'N/A';

        // Contacts
        const primaryContact = vendor.contacts?.[0] || {};
        const extraContacts = vendor.contacts?.slice(1).filter(c => c.name)
            .map(c => `${c.name} (${c.title || ''}) ${c.email}`).join(' | ') || 'N/A';

        // Fixtures
        const fixturesStr = vendor.selectedFixtures?.map(f => `${f.type} x${f.quantity}`).join(', ') || 'N/A';

        // Categories
        const categoriesStr = vendor.categories?.map(c => c === 'Other' ? `Other: ${vendor.otherCategory || ''}` : c).join(', ') || 'N/A';

        // Event Dates
        const eventDatesStr = Array.isArray(vendor.eventDates) ? vendor.eventDates.join(', ') : (vendor.eventDates || vendor.eventDate || 'N/A');

        const rowData = [
            [
                new Date(contract.createdAt).toLocaleString(), // A: Date
                contract.id,                                    // B: Contract ID
                vendor.exhibitorType || 'N/A',                 // C: Exhibitor Type
                vendor.company || 'N/A',                       // D: Company
                vendor.address || 'N/A',                       // E: Address
                brandsStr,                                      // F: Brand(s)
                brandWebsites,                                  // G: Brand Websites
                brandInstagrams,                                // H: Brand Instagram
                primaryContact.name || vendor.name || 'N/A',  // I: Contact Name
                primaryContact.title || 'N/A',                 // J: Contact Title
                primaryContact.email || vendor.email || 'N/A',// K: Contact Email
                primaryContact.phone || vendor.phone || 'N/A',// L: Contact Phone
                extraContacts,                                  // M: Extra Contacts
                categoriesStr,                                  // N: Categories
                vendor.finalBoothSize || vendor.boothSize || 'N/A', // O: Booth Size
                vendor.customBoothSize || 'N/A',               // P: Custom Booth Size
                vendor.customBoothRequirements || 'N/A',       // Q: Custom Booth Requirements
                fixturesStr,                                    // R: Fixtures
                eventDatesStr,                                  // S: Event Date(s)
                vendor.specialRequirements || 'N/A',           // T: Special Requirements
                vendor.paymentMode || 'N/A',                   // U: Payment Mode
                vendor.notes || 'N/A',                         // V: Notes
                `$${vendor.baseAmount || 0}`,                  // W: Base Amount
                `$${vendor.ccFee || 0}`,                       // X: CC Fee
                `$${vendor.totalAmount || 0}`,                 // Y: Total Amount
                contract.status || 'draft'                     // Z: Status
            ]
        ];

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Booking Summary!A:Y',
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
    const sheetName = 'Booking Summary';
    if (!spreadsheetId) return;

    try {
        // 1. Fetch all Contract IDs from Column B to find the correct row
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!B2:B5000`, 
        });

        const rows = response.data.values || [];
        const rowIndex = rows.findIndex(row => row[0] === contractId);

        if (rowIndex === -1) {
            console.warn(`[SheetsService] ⚠️ Could not find Contract ID ${contractId} in ${sheetName} to update status.`);
            return;
        }

        // 2. Update Column Y (25th column = Status) for that specific row
        const actualSheetRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!Y${actualSheetRow}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase()]]
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
            range: 'Booking Summary!A2:Y5000', 
        });
        return response.data.values || [];
    } catch (error) {
        console.error('[SheetsService] Failed to fetch all rows from Booking Summary:', error.message);
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

        // Column index reference for Booking Summary (0-based):
        // A=0:Date, B=1:ContractID, C=2:ExhibitorType, D=3:Co/Add, E=4:Brands,
        // F=5:Websites, G=6:Instagram, H=7:Name, I=8:Title, J=9:Email, K=10:Phone,
        // L=11:Extra, M=12:Categories, N=13:BoothSize, O=14:CustomSize, 
        // P=15:CustomReqs, Q=16:Fixtures, R=17:Date(s), S=18:SpecialReqs,
        // T=19:PayMode, U=20:Notes, V=21:Base, W=22:CCFee, X=23:Total, Y=24:Status

        const vendorDetails = {
            exhibitorType: row[2] || '',
            company: (row[3] || '').split(' / ')[0],
            address: (row[3] || '').split(' / ')[1] || '',
            brands: (row[4] && row[4] !== 'N/A') ? row[4].split(', ').map((name, i) => ({
                brandName: name,
                website: (row[5] && row[5] !== 'N/A') ? row[5].split(', ')[i] || '' : '',
                instagram: (row[6] && row[6] !== 'N/A') ? row[6].split(', ')[i] || '' : ''
            })) : [],
            name: row[7] || '',
            contacts: [{ name: row[7] || '', title: row[8] || '', email: row[9] || '', phone: row[10] || '' }],
            email: row[9] || '',
            categories: (row[12] && row[12] !== 'N/A') ? row[12].split(', ') : [],
            boothSize: row[13] || '',
            finalBoothSize: row[13] || '',
            customBoothSize: row[14] || '',
            customBoothRequirements: row[15] || '',
            selectedFixtures: (row[16] && row[16] !== 'N/A') ? row[16].split(', ').map(f => {
                const m = f.match(/^(.+) ×(\d+)$/) || f.match(/^(.+) x(\d+)$/);
                return m ? { type: m[1], quantity: parseInt(m[2]) } : { type: f, quantity: 1 };
            }) : [],
            eventDates: (row[17] && row[17] !== 'N/A') ? row[17].split(', ') : [],
            specialRequirements: row[18] || '',
            paymentMode: row[19] || 'Credit Card',
            notes: row[20] || '',
            baseAmount: parseFloat((row[21] || '0').toString().replace(/[$,]/g, '')) || 0,
            ccFee: parseFloat((row[22] || '0').toString().replace(/[$,]/g, '')) || 0,
            totalAmount: parseFloat((row[23] || '0').toString().replace(/[$,]/g, '')) || 0,
        };

        // Regenerate contract text from stored fields
        const brandsList = vendorDetails.brands.length > 0
            ? vendorDetails.brands.map(b => `- Brand: ${b.brandName}${b.website ? ` (Website: ${b.website})` : ''}${b.instagram ? ` (Instagram: ${b.instagram})` : ''}`).join('\n')
            : `- Brand: ${vendorDetails.company}`;

        const contactsList = vendorDetails.contacts
            .filter(c => c.name)
            .map(c => `- Name: ${c.name}\n  Title: ${c.title || 'N/A'}\n  Email: ${c.email}\n  Phone: ${c.phone || 'N/A'}`)
            .join('\n\n');

        const fixturesList = vendorDetails.selectedFixtures.length > 0
            ? vendorDetails.selectedFixtures.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n')
            : 'N/A';

        const categoriesStr = vendorDetails.categories.length > 0
            ? vendorDetails.categories.join(', ')
            : 'N/A';

        const eventDatesStr = vendorDetails.eventDates.length > 0
            ? vendorDetails.eventDates.join(', ')
            : 'TBD';

        // Fix date parsing — locale strings like "4/16/2026, 10:47 AM" can fail in Node
        const parsedDate = Date.parse(row[0]);
        const createdAt = (!isNaN(parsedDate) && parsedDate > 0) ? parsedDate : Date.now();
        const dateStr = new Date(createdAt).toLocaleDateString();

        const contractText = `EXHIBITION SERVICE AGREEMENT
Date: ${dateStr}

1. AGREEMENT PARTIES
This agreement is between CABANA Exhibition Organizing ("Organizer") and ${vendorDetails.company || 'Vendor'} (hereinafter referred to as "Vendor").

Exhibitor Info:
${vendorDetails.exhibitorType === 'Multi-line showroom' ? 'Showroom Name' : 'Company'}: ${vendorDetails.company || 'Vendor'}
Brands:
${brandsList}
Address: ${vendorDetails.address}

Authorized Contacts:
${contactsList}

2. BOOTH ALLOCATION & FIXTURES
The Vendor is allocated the following:
Booth Size/Type: ${vendorDetails.finalBoothSize || vendorDetails.boothSize || 'Standard'}${vendorDetails.customBoothSize ? ` (Custom Size: ${vendorDetails.customBoothSize})` : ''}
Categories: ${categoriesStr}

Selected Fixtures:
${fixturesList}

3. SPECIAL REQUIREMENTS & LOGISTICS
Event Dates: ${eventDatesStr}
Booth Customizations: ${vendorDetails.customBoothRequirements || 'None'}
Special Requirements: ${vendorDetails.specialRequirements || 'None'}
Additional Notes: ${vendorDetails.notes || 'None'}
Payment Method: ${vendorDetails.paymentMode || 'Credit Card'}

4. TERMS
Standard terms and conditions apply. The Vendor agrees to maintain appropriate insurance and indemnifies the Organizer against all claims, damages, or losses arising from participation. This agreement is governed by the laws of New York State.

*End of Document Text*`.trim();

        return {
            id: row[1],
            createdAt,
            status: (row[25] || 'draft').toLowerCase(),
            text: contractText,
            content: contractText,
            vendorDetails
        };
    } catch (error) {
        console.error('[SheetsService] Error getting contract by ID:', error.message);
        return null;
    }
}

/**
 * Reads inventory data from the Fixture Inventory sheet
 */
async function getFixtureInventory() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Fixture Inventory!A4:I11',
        });
        const rows = response.data.values || [];
        console.log(`[SheetsService] 🔍 Read ${rows.length} rows from Fixture Inventory.`);
        if (rows.length > 0) console.log(`[SheetsService] 📄 First row sample:`, JSON.stringify(rows[0]));
        return rows.map((row, index) => {
            const available = parseInt(row[5]) || 0;
            const statusColSoldOut = (row[7] || '').toString().toLowerCase().includes('sold out');
            const adminToggleSoldOut = (row[8] || '').toString().trim().toUpperCase() === 'YES';
            const isSoldOut = adminToggleSoldOut || statusColSoldOut || available <= 0;
            return {
                rowIndex: index + 4,
                name: row[0],
                totalStock: parseInt(row[3]) || 0,
                bookedCount: parseInt(row[4]) || 0,
                availableCount: available,
                isSoldOut,
                status: isSoldOut ? 'soldout' : (available <= 2 ? 'low' : 'ok') // Alert threshold at 2
            };
        });
    } catch (error) {
        console.error('[SheetsService] Error getting inventory:', error.message);
        throw error;
    }
}

/**
 * Reads booth configuration data
 */
async function getBoothConfig() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Booth Configuration!A4:E11', // rows 4-11 = exactly the 8 booth data rows
        });
        const rows = response.data.values || [];
        return rows
            .filter(row => row[0] && row[0].trim())
            .map(row => {
                const isCustom = row[0].toLowerCase().includes('custom');
                return {
                    name: row[0].trim(),
                    maxFixtures: isCustom ? 0 : (parseInt(row[1]) || 0),
                    basePrice: isCustom ? 0 : (parseFloat((row[4] || '0').replace(/[$,]/g, '')) || 0),
                    isCustom
                };
            });
    } catch (error) {
        console.error('[SheetsService] Error getting booth config:', error.message);
        throw error;
    }
}

/**
 * Generates the next sequential Contract ID
 */
async function generateContractId() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Booking Summary!B4:B5000',
        });
        const rows = response.data.values || [];
        let maxId = 0;
        rows.forEach(row => {
            const match = row[0]?.match(/contract_(\d+)/);
            if (match) {
                const id = parseInt(match[1]);
                if (id > maxId) maxId = id;
            }
        });
        return `contract_${(maxId + 1).toString().padStart(3, '0')}`;
    } catch (error) {
        console.error('[SheetsService] Error generating contract ID:', error.message);
        return `contract_${Date.now().toString(36)}`; // Fallback
    }
}

/**
 * Appends a row to the Booking Summary sheet
 */
async function appendBookingRow(data) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = 'Booking Summary';
    try {
        await ensureHeaders(spreadsheetId, sheetName);
        
        // 1. Get all A values to find TOTALS row
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`,
        });
        const rows = response.data.values || [];
        const totalsIndex = rows.findIndex(row => row[0]?.toString().trim() === 'TOTALS');

        if (totalsIndex !== -1) {
            // Found TOTALS row
            // 2. Get Sheet ID for insertDimension
            const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
            const sheet = sheetMeta.data.sheets.find(s => s.properties.title === sheetName);
            const sheetId = sheet.properties.sheetId;

            // 3. Insert Row at totalsIndex (this pushes the TOTALS row down)
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        insertDimension: {
                            range: {
                                sheetId,
                                dimension: 'ROWS',
                                startIndex: totalsIndex,
                                endIndex: totalsIndex + 1
                            },
                            inheritFromBefore: true
                        }
                    }]
                }
            });

            // 4. Set the values for the new row
            const newRowNumber = totalsIndex + 1;
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${newRowNumber}:Y${newRowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [data] },
            });
            console.log(`[SheetsService] ✅ Inserted row above TOTALS at row ${newRowNumber}`);
        } else {
            // Fallback: Append at the end if TOTALS row not found
            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:Y`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [data] },
            });
            console.log(`[SheetsService] ✅ Appended row at the end (TOTALS not found)`);
        }
    } catch (error) {
        console.error('[SheetsService] Error appending booking row:', error.message);
        throw error;
    }
}

/**
 * Updates fixture booked counts in batch
 */
async function updateFixtureBookedCounts(updates) {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    try {
        const data = updates.map(u => ({
            range: `Fixture Inventory!E${u.rowIndex}:F${u.rowIndex}`,
            values: [[u.newBookedCount, Math.max(0, u.totalStock - u.newBookedCount)]]
        }));
        
        // Also update Last Updated By in Col J
        updates.forEach(u => {
            data.push({
                range: `Fixture Inventory!J${u.rowIndex}`,
                values: [['System']]
            });
        });

        console.log(`[SheetsService] 📤 Sending batchUpdate to Sheets:`, JSON.stringify(data, null, 2));
        const result = await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data
            }
        });
        console.log(`[SheetsService] 📥 Sheets API Response:`, result.statusText || result.status);
    } catch (error) {
        console.error('[SheetsService] Error updating inventory counts:', error.message);
        throw error;
    }
}

/**
 * Initializes the Dashboard tab with formulas for Sales and Payment summaries
 */
async function initializeDashboard() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    const sheetName = 'Dashboard';
    if (!spreadsheetId) return;

    try {
        // 1. Check if Dashboard sheet exists
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        let dashboardSheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);

        if (!dashboardSheet) {
            console.log(`[SheetsService] 📊 Creating ${sheetName} tab...`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: [{
                        addSheet: { properties: { title: sheetName } }
                    }]
                }
            });
        }

        // 2. Set up the Dashboard Layout and Formulas
        // A=Sales Progress, C=Payment Status
        const values = [
            ['SALES PROGRESS', '', 'PAYMENT STATUS', ''],
            ['Total Contracts', '=COUNTA(\'Booking Summary\'!B4:B5000)', 'Total Billed', '=SUM(\'Booking Summary\'!X4:X5000)'],
            ['Signed', '=COUNTIF(\'Booking Summary\'!Y4:Y5000, "Signed") + COUNTIF(\'Booking Summary\'!Y4:Y5000, "Paid")', 'Total Collected', '=SUMIF(\'Booking Summary\'!Y4:Y5000, "Paid", \'Booking Summary\'!X4:X5000)'],
            ['Draft', '=COUNTIF(\'Booking Summary\'!Y4:Y5000, "Draft")', 'Balance Due', '=D2-D3'],
            ['', '', '', ''],
            ['Last Updated', new Date().toLocaleString(), '', '']
        ];

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1:D6`,
            valueInputOption: 'USER_ENTERED',
            resource: { values },
        });

        console.log(`[SheetsService] ✅ Dashboard initialized with real-time formulas.`);
    } catch (error) {
        console.error('[SheetsService] ❌ Failed to initialize dashboard:', error.message);
    }
}

/**
 * Reads the calculated metrics from the Dashboard tab
 * @returns {Promise<Object>}
 */
async function getDashboardMetrics() {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    if (!spreadsheetId) return null;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Dashboard!B2:D4', // Read the formula results
        });
        const rows = response.data.values || [];
        
        return {
            sales: {
                total: rows[0]?.[0] || 0,
                signed: rows[1]?.[0] || 0,
                draft: rows[2]?.[0] || 0
            },
            payments: {
                totalBilled: rows[0]?.[2] || 0,
                totalCollected: rows[1]?.[2] || 0,
                balanceDue: rows[2]?.[2] || 0
            }
        };
    } catch (error) {
        console.error('[SheetsService] Failed to read dashboard metrics:', error.message);
        return null;
    }
}

module.exports = {
    appendContractRow,
    syncPaymentStatus,
    getContractById,
    getAllRows,
    getFixtureInventory,
    getBoothConfig,
    generateContractId,
    appendBookingRow,
    updateFixtureBookedCounts,
    initializeDashboard,
    getDashboardMetrics
};
