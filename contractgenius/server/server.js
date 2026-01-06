/**
 * CONTRACT GENIUS BACKEND API
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Groq = require('groq-sdk');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { uploadToDrive } = require('./driveService');

dotenv.config();

const app = express();
const PORT = 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3004',
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json({ limit: '10mb' }));

// In-memory storage (Replace with Database for production)
const contractsDb = new Map();

// Initialize AI
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Root Health Check
app.get('/', (req, res) => {
  res.send('✅ Contract Genius API is running gracefully in the cloud!');
});

// POST /api/contracts/draft
app.post('/api/contracts/draft', async (req, res) => {
  try {
    const { name, email, address, company, boothSize, finalBoothSize, customBoothSize, customBoothRequirements, fixture, fixtureQuantity, eventDate, specialRequirements, brandName, phone, selectedFixtures, categories, additionalContact } = req.body;

    // 1. Generate Contract with Gemini
    const fixturesList = req.body.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || `- ${req.body.fixture} (Qty: ${req.body.fixtureQuantity})`;
    const categoriesList = req.body.categories?.join(', ') || 'N/A';

    const prompt = `
      Draft a professional "Exhibition Service Agreement" for:
      
      Exhibitor Info:
      - Company Name: ${req.body.company}
      - Brand Name: ${req.body.brandName || 'N/A'}
      
      Primary Contact:
      - Name: ${req.body.name}
      - Email: ${req.body.email}
      - Phone: ${req.body.countryCode} ${req.body.phone || 'N/A'}
      - Company Address: ${req.body.address}
      
      Additional Contact (For Reference):
      - Name: ${additionalContact?.name || 'N/A'}
      - Email: ${additionalContact?.email || 'N/A'}
      - Phone: ${additionalContact?.phone ? (additionalContact.countryCode + ' ' + additionalContact.phone) : 'N/A'}
      
      Categories:
      - ${categoriesList}

      Booth Allocation:
      - Size/Type: ${req.body.finalBoothSize || req.body.boothSize}
      - Selected Fixtures:
${fixturesList}
      
      Requirements:
      1. Include sections for Parties, Booth & Fixtures, Payment (realistic pricing), and Liability.
      2. **Important:** Explicitly state the **Company Address** and **Company Name** in the Agreement Parties section.
      3. Format in clean Markdown.
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    const contractText = completion.choices[0]?.message?.content || "Error: No content generated.";

    // 2. Save Draft
    const contractId = 'contract_' + Date.now().toString(36);
    const contractData = {
      id: contractId,
      vendor: { name, email, company },
      text: contractText,
      status: 'draft',
      createdAt: new Date()
    };
    contractsDb.set(contractId, contractData);

    // 3. (Optional) Production URL for UI response
    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:3004";
    const magicLink = `${frontendBaseUrl}/#/contract/${contractId}`;

    res.json({ success: true, message: "Draft created and email sent", contractId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/contracts/:id
app.get('/api/contracts/:id', (req, res) => {
  const contract = contractsDb.get(req.params.id);
  if (!contract) {
    return res.status(404).json({ success: false, message: "Contract not found" });
  }
  res.json(contract);
});

// POST /api/contracts/sign
app.post('/api/contracts/sign', async (req, res) => {
  try {
    const { contractId, signatureImageBase64, contractData } = req.body;
    let contract = contractsDb.get(contractId) || contractData;

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

    // 3. Send Final Signed Contract via Make.com Webhook
    try {
      const webhookPayload = {
        action: "send_final_contract",
        email: vendor.email,
        pdfBase64: Buffer.from(pdfBytes).toString('base64'),
        fileName: `Signed_Contract_${vendor.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      };

      const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";

      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });
      console.log('Signed contract sent to Make.com successfully.');
    } catch (webhookError) {
      console.error('Failed to send to Make.com:', webhookError);
      // We log but don't fail the whole request
    }

    // 4. Upload to Google Drive
    try {
      const folderId = process.env.DRIVE_FOLDER_ID || '128nIyVuoTQh1i1ZLO4Mrpc4RF7ylK0w3';
      const fileName = `Signed_Contract_${vendor.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      console.log(`[Server] Attempting Google Drive upload to folder: ${folderId}`);
      await uploadToDrive(Buffer.from(pdfBytes), fileName, folderId);
      console.log('Contract uploaded to Google Drive successfully.');
    } catch (driveError) {
      console.error('Failed to upload to Google Drive:', driveError);
      // We don't fail the whole request if Drive upload fails, but we log it
    }

    // Update Status
    contract.status = 'signed';
    contractsDb.set(contractId, contract);

    res.json({ success: true, message: "Contract signed and finalized" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});