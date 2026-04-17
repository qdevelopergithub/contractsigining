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

const HEADERS = [
    'Date',           // A
    'Contract ID',    // B
    'Exhibitor Type', // C
    'Company',        // D
    'Address',        // E
    'Brand(s)',       // F
    'Brand Websites', // G
    'Brand Instagram',// H
    'Contact Name',   // I
    'Contact Title',  // J
    'Contact Email',  // K
    'Contact Phone',  // L
    'Extra Contacts', // M
    'Categories',     // N
    'Booth Size',     // O
    'Custom Booth Size', // P
    'Custom Booth Requirements', // Q
    'Fixtures',       // R
    'Event Date(s)',  // S
    'Special Requirements', // T
    'Payment Mode',   // U
    'Notes',          // V
    'Base Amount',    // W
    'CC Fee',         // X
    'Total Amount',   // Y
    'Status'          // Z
];

async function ensureHeaders(spreadsheetId) {
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Sheet1!A1:Z1',
    });
    const firstRow = response.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1!A1:Z1',
            valueInputOption: 'USER_ENTERED',
            resource: { values: [HEADERS] },
        });
        console.log('[SheetsService] ✅ Headers added to Sheet1');
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
            range: 'Sheet1!A:Z',
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

        // 2. Update Column Z (26th column = Status) for that specific row
        const actualSheetRow = rowIndex + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Sheet1!Z${actualSheetRow}`,
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
            range: 'Sheet1!A2:Z1000', // Fetch up to 1000 rows
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

        // Column index reference (0-based):
        // A=0:Date, B=1:ContractID, C=2:ExhibitorType, D=3:Company, E=4:Address,
        // F=5:Brands, G=6:BrandWebsites, H=7:BrandInstagram,
        // I=8:ContactName, J=9:ContactTitle, K=10:ContactEmail, L=11:ContactPhone,
        // M=12:ExtraContacts, N=13:Categories, O=14:BoothSize, P=15:CustomBoothSize,
        // Q=16:CustomBoothReqs, R=17:Fixtures, S=18:EventDates, T=19:SpecialReqs,
        // U=20:PaymentMode, V=21:Notes, W=22:BaseAmount, X=23:CCFee, Y=24:Total, Z=25:Status

        const vendorDetails = {
            exhibitorType: row[2] || '',
            brands: (row[5] && row[5] !== 'N/A') ? row[5].split(', ').map((name, i) => ({
                brandName: name,
                website: (row[6] && row[6] !== 'N/A') ? row[6].split(', ')[i] || '' : '',
                instagram: (row[7] && row[7] !== 'N/A') ? row[7].split(', ')[i] || '' : ''
            })) : [],
            company: row[3] || '',
            name: row[8] || '',
            contacts: [{ name: row[8] || '', title: row[9] || '', email: row[10] || '', phone: row[11] || '' }],
            email: row[10] || '',
            address: row[4] || '',
            categories: (row[13] && row[13] !== 'N/A') ? row[13].split(', ') : [],
            finalBoothSize: row[14] || '',
            boothSize: row[14] || '',
            customBoothSize: row[15] || '',
            customBoothRequirements: row[16] || '',
            selectedFixtures: (row[17] && row[17] !== 'N/A') ? row[17].split(', ').map(f => {
                const m = f.match(/^(.+) x(\d+)$/);
                return m ? { type: m[1], quantity: parseInt(m[2]) } : { type: f, quantity: 1 };
            }) : [],
            eventDates: (row[18] && row[18] !== 'N/A') ? row[18].split(', ') : [],
            specialRequirements: row[19] || '',
            paymentMode: row[20] || 'Credit Card',
            notes: row[21] || '',
            baseAmount: parseFloat((row[22] || '0').replace('$', '')) || 0,
            ccFee: parseFloat((row[23] || '0').replace('$', '')) || 0,
            totalAmount: parseFloat((row[24] || '0').replace('$', '')) || 0,
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

module.exports = {
    appendContractRow,
    syncPaymentStatus,
    getContractById,
    getAllRows
};
