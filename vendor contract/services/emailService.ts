import { VendorFormData } from '../types';

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
const rawAdminUrl = import.meta.env.VITE_ADMIN_APP_URL || "http://localhost:3004";
const APP_PUBLIC_URL = rawAdminUrl.startsWith('http') ? rawAdminUrl : `https://${rawAdminUrl}`;

/**
 * Sends the vendor data to Make.com Webhook.
 * This triggers the workflow to send the signing link to the vendor.
 */
export const sendVendorData = async (formData: VendorFormData): Promise<boolean> => {

  // 1. Construct the Signing Link
  // ContractGenius App expects ?data=... in the query string (see contractgenius/App.tsx)
  const jsonString = JSON.stringify(formData);
  const base64Data = btoa(encodeURIComponent(jsonString));

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
