import { VendorFormData } from '../types';
import { jsPDF } from 'jspdf';

/**
 * CONFIGURATION:
 * Replace with your Make.com (formerly Integromat) Webhook URL.
 */
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";

/**
 * CONFIGURATION:
 * The public URL where the ContractGenius (Signing App) is hosted.
 * We assume it's running on port 3001 if the Vendor App is on 3000.
 */
const APP_PUBLIC_URL = process.env.VITE_ADMIN_APP_URL || "http://localhost:3004";

/**
 * Sends the vendor data to Make.com Webhook.
 * This triggers the workflow to send the signing link to the vendor.
 */
export const sendVendorData = async (formData: VendorFormData): Promise<boolean> => {

  // 1. Construct the Signing Link
  // ContractGenius App expects ?data=... in the query string (see contractgenius/App.tsx)
  const jsonString = JSON.stringify(formData);
  const base64Data = btoa(jsonString);

  // Construct the full link to the OTHER app
  const submissionLink = `${APP_PUBLIC_URL}/?data=${base64Data}`;

  // 2. Prepare Payload for Webhook
  // Sending formData as a nested object 'data' to keep top-level clean
  const payload = {
    action: "submit_vendor_data",
    submissionLink: submissionLink,
    email: formData.email, // Explicitly sending email at top level for easy mapping
    data: formData
  };

  console.log("Sending data to Make.com:", payload);

  if (!MAKE_WEBHOOK_URL || MAKE_WEBHOOK_URL.includes("INSERT_MAKE_WEBHOOK_URL_HERE")) {
    console.warn("--- MAKE.COM WEBHOOK SIMULATION ---");
    console.warn("Reason: Webhook URL not configured in services/emailService.ts");
    console.warn("Generated Link:", submissionLink);
    console.warn("Payload:", payload);
    console.warn("-----------------------------------");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1000));
    return true;
  }

  try {
    // 3. Send POST request to Make.com
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("Data sent to Make.com successfully.");
    return true;
  } catch (error) {
    console.error("Failed to send data to Make.com:", error);
    throw new Error("Failed to send vendor data.");
  }
};

/**
 * Generates a PDF of the contract with the signature embedded.
 */
export const generateSignedPDF = (contractText: string, signatureDataUrl: string): Blob => {
  const doc = new jsPDF();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Exhibition Service Agreement", 20, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const splitText = doc.splitTextToSize(contractText.replace(/#/g, ''), 170);
  doc.text(splitText, 20, 35);

  let yPos = 35 + (splitText.length * 5);

  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  doc.text("Signed By Vendor:", 20, yPos + 10);
  doc.addImage(signatureDataUrl, 'PNG', 20, yPos + 15, 60, 30);
  doc.line(20, yPos + 45, 80, yPos + 45);

  doc.text("Date: " + new Date().toLocaleDateString(), 20, yPos + 55);

  return doc.output('blob');
};

/**
 * Sends the final signed PDF to the Make.com Webhook.
 * This triggers the workflow to notify the organizer.
 */
export const sendFinalContractEmail = async (toEmail: string, pdfBlob: Blob): Promise<boolean> => {
  console.log("Generating and sending final PDF...");

  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      // Get Base64 content (remove "data:application/pdf;base64," prefix if present, 
      // though readAsDataURL includes it, splitting by comma handles it safe)
      const base64data = (reader.result as string).split(',')[1];

      const payload = {
        action: "send_final_contract",
        email: toEmail,
        pdfBase64: base64data,
        fileName: `Signed_Contract_${Date.now()}.pdf`
      };

      if (!MAKE_WEBHOOK_URL || MAKE_WEBHOOK_URL.includes("INSERT_MAKE_WEBHOOK_URL_HERE")) {
        console.warn("--- MAKE.COM PDF SIMULATION ---");
        console.warn("Payload size:", base64data.length);
        resolve(true);
        return;
      }

      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        console.log("Signed contract sent to Make.com successfully.");
        resolve(true);
      } catch (error) {
        console.error("Make.com Error:", error);
        reject(error);
      }
    };
    reader.readAsDataURL(pdfBlob);
  });
};