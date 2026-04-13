/**
 * CONTRACT GENIUS BACKEND API
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { uploadToDrive } = require('./driveService');
const qbService = require('./quickbooksService');
const sheetsService = require('./sheetsService');
const stripeService = require('./stripeService');
const inventoryService = require('./inventoryService');
const emailService = require('./emailService');
const reminderService = require('./reminderService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3004',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const cleanOrigin = origin.replace(/\/$/, "");
    const isAllowed = allowedOrigins.some(o => o.replace(/\/$/, "") === cleanOrigin) ||
      origin.includes("vercel.app") ||
      origin.includes("onrender.com");

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
// Stripe webhook needs raw body - must be before express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// External persistence is now handled by Google Sheets Service


// Root Health Check
app.get('/', (req, res) => {
  res.send('✅ Contract Genius API is running gracefully in the cloud!');
});

// --- QuickBooks OAuth Routes ---
app.get('/auth/authUri', (req, res) => {
  const uri = qbService.getAuthUri();
  res.redirect(uri);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const authResponse = await qbService.createToken(req.url);
    res.send('✅ QuickBooks Authentication Successful! You can close this window.');
  } catch (e) {
    console.error('QB Auth Callback Error:', e);
    res.status(500).send('❌ QuickBooks Authentication Failed.');
  }
});

// POST /api/contracts/draft
app.post('/api/contracts/draft', async (req, res) => {
  try {
    const { name, email, address, company, exhibitorType, boothSize, finalBoothSize, customBoothSize, customBoothRequirements, fixture, fixtureQuantity, eventDates, eventDate, specialRequirements, brandName, phone, selectedFixtures, categories, otherCategory, additionalContact } = req.body;
    console.log(`[Server] Draft Request - Company: ${company || req.body.companyName}, Categories: ${categories?.join(', ')}, OtherCategory: ${otherCategory}`);

    // 1. Generate Static Contract Template (NO AI)
    const fixturesList = (selectedFixtures || req.body.selectedFixtures)?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || `- ${fixture || req.body.fixture} (Qty: ${fixtureQuantity || req.body.fixtureQuantity})`;
    const categoriesList = (categories || req.body.categories)?.map(c => c === 'Other' ? `Other: ${otherCategory || req.body.otherCategory || 'Miscellaneous'}` : c).join(', ') || 'N/A';

    // Formatting Brands
    const brandsList = (req.body.brands || [])
      .filter(b => b.brandName && b.brandName.trim() !== '')
      .map(b => `- Brand: ${b.brandName}${b.website ? ` (Website: ${b.website})` : ''}${b.instagram ? ` (Instagram: ${b.instagram})` : ''}`)
      .join('\n') || `- Brand: ${req.body.brandName || 'N/A'}`;

    // Formatting Contacts
    const contactsList = (req.body.contacts || [])
      .filter(c => c.name && c.name.trim() !== '')
      .map(c => `- Name: ${c.name}\n  Title: ${c.title || 'N/A'}\n  Email: ${c.email}\n  Phone: ${c.phone || 'N/A'}`)
      .join('\n\n') || `- Name: ${req.body.name}\n  Email: ${req.body.email}\n  Phone: ${req.body.phone || 'N/A'}`;

    const contractText = `
EXHIBITION SERVICE AGREEMENT
Date: ${new Date().toLocaleDateString()}

1. AGREEMENT PARTIES
This agreement is between CABANA Exhibition Organizing ("Organizer") and ${company || req.body.companyName || 'Vendor'} (hereinafter referred to as "Vendor").

Exhibitor Info:
${(exhibitorType || req.body.exhibitorType) === 'Multi-line showroom' ? 'Showroom Name' : 'Company'}: ${company || req.body.companyName || 'Vendor'}
Brands:
${brandsList}
Address: ${req.body.address}

Authorized Contacts:
${contactsList}

2. BOOTH ALLOCATION & FIXTURES
The Vendor is allocated the following:
Booth Size/Type: ${finalBoothSize || boothSize || "Standard"}${customBoothSize ? ` (Custom Size: ${customBoothSize})` : ''}
Categories: ${categoriesList}

Selected Fixtures:
${fixturesList}

3. SPECIAL REQUIREMENTS & LOGISTICS
Event Dates: ${eventDates ? (Array.isArray(eventDates) ? eventDates.join(', ') : eventDates) : (eventDate || "TBD")}
Booth Customizations: ${customBoothRequirements || "None"}
Special Requirements: ${specialRequirements || "None"}
Additional Notes: ${req.body.notes || "None"}
Payment Method: ${req.body.paymentMode || "Credit Card"}

4. TERMS
Standard terms and conditions apply. The Vendor agrees to maintain appropriate insurance and indemnifies the Organizer against all claims, damages, or losses arising from participation. This agreement is governed by the laws of New York State.

*End of Document Text*
    `.trim();

    // 2. Create Contract ID and Save Full Contract Data to Database
    const contractId = 'contract_' + Date.now().toString(36);
    const contractData = {
      id: contractId,
      // Store complete vendor details for contract preview
      vendorDetails: {
        exhibitorType: req.body.exhibitorType,
        brands: req.body.brands || [],
        company: req.body.company || req.body.companyName, // Fallback for VendorForm
        contacts: req.body.contacts || [],
        email: req.body.email,
        address: req.body.address,
        categories: req.body.categories || [],
        otherCategory: req.body.otherCategory || '',
        boothSize: req.body.boothSize,
        finalBoothSize: req.body.finalBoothSize,
        customBoothSize: req.body.customBoothSize,
        customBoothRequirements: req.body.customBoothRequirements,
        selectedFixtures: req.body.selectedFixtures || [],
        fixture: req.body.fixture,
        fixtureQuantity: req.body.fixtureQuantity,
        eventDates: req.body.eventDates || (req.body.eventDate ? [req.body.eventDate] : []),
        specialRequirements: req.body.specialRequirements || ''
      },
      vendor: { name, email, company }, // Legacy field for compatibility
      content: contractText,
      text: contractText, // Legacy field for compatibility
      status: 'draft',
      createdAt: Date.now()
    };
    console.log(`[Server] ✅ Contract ${contractId} created successfully`);

    // 2.5 Aggregate Data to Google Sheets (Non-blocking)
    sheetsService.appendContractRow(contractData).catch(err => {
      console.error(`[Server] Non-fatal error aggregating to Google Sheets:`, err.message);
    });

    // 3. Define Magic Link for the vendor
    const signingAppUrl = process.env.SIGNING_APP_URL || "https://contractsigining-9kgu.vercel.app";
    const magicLink = `${signingAppUrl.replace(/\/$/, "")}/#/contract/${contractId}`;

    // 4. Trigger Make.com Webhook (Automation Flow)
    const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";
    fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "submit_vendor_data",
        submissionLink: magicLink,
        email: contractData.vendorDetails.email,
        contractId: contractId,
        company: contractData.vendorDetails.company
      })
    }).catch(err => console.error("[Server] Make.com Webhook Error (Draft):", err.message));

    res.json({
      success: true,
      message: "Contract created successfully",
      contractId,
      magicLink
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id
app.get('/api/contracts/:id', async (req, res) => {
  const contractId = req.params.id;
  
  console.log(`[Server] GET /api/contracts/${contractId}`);

  try {
    const contract = await sheetsService.getContractById(contractId);

    if (!contract) {
      console.log(`[Server] ❌ Contract ${contractId} not found in Sheets`);
      return res.status(404).json({ success: false, message: "Contract not found" });
    }

    console.log(`[Server] ✅ Contract ${contractId} found - Status: ${contract.status}`);

    // Check if contract is already signed - reject access to prevent re-signing
    if (contract.status === 'signed') {
      console.log(`[Server] 🔒 Contract ${contractId} is already SIGNED - Link EXPIRED`);
      return res.status(410).json({
        success: false,
        message: "This contract has already been signed. The link has expired.",
        status: 'signed',
        contractId: contractId
      });
    }

    res.json(contract);
  } catch (error) {
    console.error(`[Server] Error fetching contract ${contractId}:`, error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// POST /api/contracts/sign
app.post('/api/contracts/sign', async (req, res) => {
  try {
    const { contractId, signatureImageBase64, contractData } = req.body;

    // CRITICAL: Fetch existing contract from Google Sheets to ensure status update persists
    let contract = await sheetsService.getContractById(contractId);

    if (!contract && contractData) {
      console.log(`[Server] ⚠️ Contract ${contractId} not found in Sheets, using provided session data`);
      contract = contractData;
      contract.id = contractId;
    }

    if (!contract) return res.status(404).json({ message: "Contract not found" });

    // Normalize vendor data (handle both 'vendor' and 'vendorDetails')
    const vendor = contract.vendor || contract.vendorDetails;
    if (!vendor) return res.status(400).json({ message: "Invalid contract data: Missing vendor details" });

    // 1. Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 50;
    const maxWidth = width - (margin * 2);
    let yPosition = height - margin;

    // Helper to add a new page
    const addNewPage = () => {
      page = pdfDoc.addPage();
      yPosition = height - margin;
    };

    // Helper to draw text with wrapping
    const drawWrappedText = (text, size, isBold = false) => {
      const currentFont = isBold ? boldFont : font;
      const paragraphs = text.split('\n');

      for (const para of paragraphs) {
        const words = para.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = currentFont.widthOfTextAtSize(testLine, size);

          if (testWidth > maxWidth) {
            if (yPosition < margin + size) addNewPage();
            page.drawText(currentLine, { x: margin, y: yPosition, size, font: currentFont });
            yPosition -= size * 1.5;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          if (yPosition < margin + size) addNewPage();
          page.drawText(currentLine, { x: margin, y: yPosition, size, font: currentFont });
          yPosition -= size * 1.5;
        }

        // Paragraph spacing
        yPosition -= size * 0.5;
      }
    };

    // Header
    page.drawText('CONTRACT AGREEMENT', { x: margin, y: yPosition, size: 20, font: boldFont });
    yPosition -= 40;

    // Metadata
    drawWrappedText(`Vendor: ${vendor.name}`, 12, true);
    drawWrappedText(`Company: ${vendor.company}`, 12);
    drawWrappedText(`Email: ${vendor.email}`, 12);
    yPosition -= 20;

    // Full Contract Text
    if (contract.text || contract.content) {
      drawWrappedText(contract.text || contract.content, 10);
    }

    // 2. Embed Signature
    if (signatureImageBase64) {
      if (yPosition < 150) addNewPage();

      yPosition -= 20;
      page.drawText('SIGNED BY VENDOR:', { x: margin, y: yPosition, size: 12, font: boldFont });
      yPosition -= 110;

      const pngImage = await pdfDoc.embedPng(signatureImageBase64);
      page.drawImage(pngImage, {
        x: margin,
        y: yPosition,
        width: 200,
        height: 100,
      });

      yPosition -= 20;
      page.drawText(`Signed on: ${new Date().toLocaleString()}`, {
        x: margin,
        y: yPosition,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }

    const pdfBytes = await pdfDoc.save();

    // 3. Render and other cloud environments should handling signing notifications 
    // via the submit_vendor_data action. Removing redundant send_final_contract call.

    // 4. Upload to Google Drive
    try {
      const folderId = process.env.DRIVE_FOLDER_ID || '128nIyVuoTQh1i1ZLO4Mrpc4RF7ylK0w3';
      const safeName = (vendor.name || vendor.company || 'Unknown_Vendor').replace(/\s+/g, '_');
      const fileName = `Signed_Contract_${safeName}_${Date.now()}.pdf`;
      console.log(`[Server] Attempting Google Drive upload to folder: ${folderId}`);
      await uploadToDrive(Buffer.from(pdfBytes), fileName, folderId);
      console.log('Contract uploaded to Google Drive successfully.');
    } catch (driveError) {
      console.error('Failed to upload to Google Drive:', driveError);
      // We don't fail the whole request if Drive upload fails, but we log it
    }

    // Update Status in Sheets
    console.log(`[Server] 📝 Marking contract ${contractId} as SIGNED`);
    contract.status = contract.vendorDetails?.depositAmount > 0 ? 'pending_deposit' : (contract.vendorDetails?.totalAmount > 0 ? 'pending_balance' : 'signed');
    
    await sheetsService.syncPaymentStatus(contractId, contract.status);
    console.log(`[Server] ✅ Contract ${contractId} updated in Sheets - Status: ${contract.status}`);

    // 5. QuickBooks Integration (Create Customer & Invoice)
    try {
      console.log(`[Server] Triggering QuickBooks Invoice Creation for ${contractId}`);
      await qbService.processContractSignatureForQB(contract);
    } catch (qbErr) {
      console.error("[Server] QB processing failed, but contract is signed:", qbErr);
    }

    // 6. Deduct Inventory Stock in Google Sheets
    const fixturesBooked = contract.vendorDetails?.selectedFixtures || [];
    inventoryService.deductInventory(fixturesBooked).catch(e =>
      console.error('[Server] Non-fatal inventory deduction error:', e.message)
    );

    // 7. Send Team Email Alert for New Signed Contract
    emailService.sendContractSignedAlert(contract).catch(e =>
      console.error('[Server] Non-fatal email alert error:', e.message)
    );

    // 8. Trigger Make.com Webhook for Signing Completion
    const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";
    fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: "contract_signed",
        contractId: contractId,
        company: vendor.company,
        status: contract.status,
        signedAt: new Date().toISOString()
      })
    }).catch(err => console.error("[Server] Make.com Webhook Error (Sign):", err.message));

    res.json({ success: true, message: "Contract signed and finalized" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/contracts/create-payment-session
app.post('/api/contracts/create-payment-session', async (req, res) => {
  try {
    const { contractId, paymentType } = req.body;
    const contract = contractsDb.get(contractId);
    if (!contract) return res.status(404).json({ message: 'Contract not found' });

    const sessionUrl = await stripeService.createPaymentSession(contract, paymentType || 'full');
    if (!sessionUrl) return res.status(400).json({ message: 'Could not create payment session. Check STRIPE_SECRET_KEY.' });
    
    res.json({ success: true, paymentUrl: sessionUrl });
  } catch (error) {
    console.error('[Server] Stripe session error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/webhooks/stripe — Listens for payment confirmations from Stripe
app.post('/api/webhooks/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = stripeService.handleStripeWebhook(req.body, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const contractId = session.metadata?.contractId;

      if (contractId) {
        // Update status to signed (fully paid)
        await sheetsService.syncPaymentStatus(contractId, 'signed');
        emailService.sendPaymentConfirmedAlert(contractId, session.metadata?.company || 'N/A', session.amount_total / 100).catch(e =>
          console.error('[Server] Payment email alert error:', e.message)
        );
        console.log(`[Server] ✅ Stripe payment confirmed for ${contractId}`);
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error('[Server] Stripe webhook error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET /api/inventory - Returns all fixture availability for the frontend form
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await inventoryService.getInventory();
    res.json({ success: true, inventory });
  } catch (error) {
    console.error('[Server] Failed to load inventory:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start Automated Reminders
  reminderService.initReminders();
});
