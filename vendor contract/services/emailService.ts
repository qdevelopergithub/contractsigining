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
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "https://contractsigining.onrender.com";
const BACKEND_URL = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

/**
 * Sends the vendor data to Make.com Webhook via the backend.
 * This triggers the workflow to send the signing link to the vendor.
 */
export const sendVendorData = async (formData: VendorFormData, contractId?: string): Promise<boolean> => {

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

    const result = await response.json();
    const finalContractId = contractId || result.contractId;
    const magicLink = result.magicLink;

    console.log(`[VendorApp] ✅ Contract created: ${finalContractId}`);

    // Email is stored in contacts[0].email — formData.email may be undefined
    const vendorName = formData.contacts?.[0]?.name || formData.companyName || 'Vendor';
    const vendorEmailRaw =
      formData?.contacts?.[0]?.email ??
      (formData as any)?.email ??
      "";

    const vendorEmail = vendorEmailRaw.trim().toLowerCase();

    if (!vendorEmail) {
      console.error("[VendorApp] ❌ Email missing in formData:", formData);
      throw new Error("Vendor email is required");
    }

    if (!vendorEmail.includes("@")) {
      throw new Error("Invalid email format");
    }
    // 2. Prepare Payload for Webhook with the REAL server link
    const payload = {
      action: "submit_vendor_data",
      submissionLink: magicLink, // This is the server-side link: /#/contract/ID
      email: formData.email,
      contractId: contractId,
      data: formData
    };
    console.log("[VendorApp] Step 2: Sending REAL link to Make.com:", payload);

    // 3. Mark as SENT in backend
    try {
      await fetch(`${BACKEND_URL}/api/contracts/${finalContractId}/sent`, { method: 'POST' });
      console.log(`[VendorApp] Status updated to SENT for ${finalContractId}`);
    } catch (sentErr) {
      console.warn("[VendorApp] Failed to update status to SENT", sentErr);
    }

    return true;
  } catch (error) {
    console.error("[VendorApp] ❌ Failed to create contract or trigger webhook:", error);
    throw new Error("Failed to send vendor data.");
  }
};
