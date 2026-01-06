import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Contract } from '../types';

export const generateSignedPDF = async (contract: Contract): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 10;
  const margin = 50;
  let yPosition = height - margin;

  // Title
  page.drawText('VENDOR AGREEMENT', {
    x: margin,
    y: yPosition,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  yPosition -= 40;

  // Metadata
  const drawLine = (text: string, isBold: boolean = false) => {
    if (yPosition < margin + fontSize) { // Check if there's enough space for the next line
      page = pdfDoc.addPage(); // Assign new page to 'page'
      yPosition = page.getSize().height - margin; // Use the new page's height
    }
    page.drawText(text, {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;
  };

  drawLine(`Contract ID: ${contract.id}`, true);
  drawLine(`Date: ${new Date(contract.createdAt).toLocaleDateString()}`);
  drawLine(`Vendor: ${contract.vendorDetails.name} (${contract.vendorDetails.company})`);
  drawLine(`Email: ${contract.vendorDetails.email}`);
  yPosition -= 20;

  // Content (Stripping markdown for plain text rendering in PDF)
  const paragraphs = (contract.content || '').split('\n');

  for (const para of paragraphs) {
    const words = para.split(' ');
    let currentLine = '';

    for (const word of words) {
      const cleanWord = word.replace(/[#*]/g, ''); // Basic Markdown cleaning
      const testLine = currentLine ? `${currentLine} ${cleanWord}` : cleanWord;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > width - (margin * 2)) { // Check if line exceeds page width
        drawLine(currentLine);
        currentLine = cleanWord;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      drawLine(currentLine);
    }
    yPosition -= 5; // Paragraph spacing
  }

  // Signature Section
  yPosition -= 40;
  if (yPosition < 150) {
    page = pdfDoc.addPage();
    yPosition = page.getSize().height - margin - 40;
  }

  page.drawText('SIGNED BY VENDOR:', {
    x: margin,
    y: yPosition,
    size: 12,
    font: boldFont,
  });

  yPosition -= 10;

  if (contract.signatureBase64) {
    try {
      const pngImage = await pdfDoc.embedPng(contract.signatureBase64);
      const pngDims = pngImage.scale(0.5);

      page.drawImage(pngImage, {
        x: margin,
        y: yPosition - pngDims.height,
        width: pngDims.width,
        height: pngDims.height,
      });

      yPosition -= (pngDims.height + 10);

      page.drawText(`Signed digitally on: ${new Date(contract.signedAt || Date.now()).toLocaleString()}`, {
        x: margin,
        y: yPosition,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
    } catch (e) {
      console.error("Error embedding signature image", e);
      page.drawText('(Signature Image Error)', { x: margin, y: yPosition - 20, size: 10, font });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};