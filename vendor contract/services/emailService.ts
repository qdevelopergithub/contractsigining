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
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "https://contract-genius-backend-93t6.onrender.com";
const BACKEND_URL = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

/**
 * Sends the vendor data to Make.com Webhook via the backend.
 * This triggers the workflow to send the signing link to the vendor.
 */
export const sendVendorData = async (formData: VendorFormData): Promise<boolean> => {

  console.log("[VendorApp] Step 1: Creating contract on server...");

  try {
    // 1. Create the contract PRECISELY on the server first
    // This ensures we get a unique contractId and a link that will EXPIRE
    const response = await fetch(`${BACKEND_URL}/api/contracts/draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        company: formData.companyName, // Map companyName to company for backend consistency
        name: formData.contacts[0]?.name || 'Vendor',
        email: formData.contacts[0]?.email || formData.email
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const { contractId, magicLink } = await response.json();
    console.log(`[VendorApp] ✅ Contract created: ${contractId}`);

    // 2. Prepare Payload for Webhook with the REAL server link
    const payload = {
      action: "submit_vendor_data",
      submissionLink: magicLink, // This is the server-side link: /#/contract/ID
      email: formData.email,
      contractId: contractId,
      data: formData
    };

    console.log("[VendorApp] Step 2: Sending REAL link to Make.com:", payload);

    if (!MAKE_WEBHOOK_URL || MAKE_WEBHOOK_URL.includes("INSERT_MAKE_WEBHOOK_URL_HERE")) {
      console.warn("--- MAKE.COM WEBHOOK SIMULATION ---");
      console.warn("Generated Link:", magicLink);
      console.warn("Payload:", payload);
      await new Promise(r => setTimeout(r, 1000));
      return true;
    }

    // 3. Send POST request to Make.com
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[VendorApp] SUCCESS: Webhook triggered.");
    return true;
  } catch (error) {
    console.error("[VendorApp] ❌ Failed to create contract or trigger webhook:", error);
    throw new Error("Failed to send vendor data.");
  }
};
