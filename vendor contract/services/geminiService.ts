import Groq from "groq-sdk";
import { VendorFormData } from "../types";

const groq = new Groq({
  apiKey: process.env.VITE_GROQ_API_KEY || "",
  dangerouslyAllowBrowser: true // Required since we are running client-side
});

export const generateVendorContract = async (data: VendorFormData): Promise<string> => {
  // Use a capable model on Groq
  const modelId = "llama-3.3-70b-versatile";

  const brandsList = data.brands.map(b => `- ${b.brandName}${b.showroomName ? ` (${b.showroomName})` : ''}${b.website ? `, Website: ${b.website}` : ''}${b.instagram ? `, IG: ${b.instagram}` : ''}`).join('\n') || '- N/A';
  const contactsList = data.contacts.map(c => `- ${c.name}${c.title ? ` (${c.title})` : ''}, Email: ${c.email}`).join('\n') || `- ${data.email}`;
  const fixturesList = data.selectedFixtures.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n');
  const categoriesList = data.categories.join(', ') + (data.categories.includes('Other') && data.otherCategory ? ` (${data.otherCategory})` : '');

  const prompt = `
    Generate a professional, legally structured service contract for a trade show or exhibition vendor.
    
    Exhibitor Information:
    - Exhibitor Type: ${data.exhibitorType}
    - Company Name: ${data.companyName}
    - Brands:
${brandsList}
    
    Contact Details:
${contactsList}
    - Company Address: ${data.address}
    
    Categories Being Shown:
    - ${categoriesList}

    Booth & Fixture Selection:
    - Booth Size/Type: ${data.finalBoothSize || data.boothSize}
    - Selected Fixtures:
${fixturesList}
    - Payment Method: ${data.paymentMode}

    Requirements:
    1. Title: "Exhibition Service Agreement".
    2. Date: Use today's date (${new Date().toLocaleDateString()}).
    3. **Important:** Ensure the **Company Address** and **Company Name** are explicitly listed in the Agreement Parties section.
    4. Include sections for: Agreement Parties, Booth Allocation & Fixtures, Fees & Payment, Liability & Insurance, and Signatures.
    5. The tone should be formal, professional, and binding.
    6. Format the output in clean Markdown. Use bolding for keys and sections.
    7. Explicitly state the total estimated cost (make up a realistic price based on the booth type and fixtures).
  `;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: modelId,
    });

    return completion.choices[0]?.message?.content || "Error: No content generated.";
  } catch (error: any) {
    console.error("Groq API Error:", error);
    throw new Error(`Failed to generate contract: ${error.message || "Unknown error"} `);
  }
};