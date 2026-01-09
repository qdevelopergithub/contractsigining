import Groq from "groq-sdk";
import { VendorFormData } from "../types";

const groq = new Groq({
  apiKey: process.env.VITE_GROQ_API_KEY || "",
  dangerouslyAllowBrowser: true // Required since we are running client-side
});

export const generateVendorContract = async (data: VendorFormData): Promise<string> => {
  // Use a capable model on Groq
  const modelId = "llama-3.3-70b-versatile";

  // Filter and format Brands based on Exhibitor Type
  const brandsList = data.brands
    .filter(b => b.brandName && b.brandName.trim() !== '')
    .map(b => {
      let info = `- Brand: ${b.brandName}`;
      if (data.exhibitorType === 'Multi-line showroom' && b.showroomName) {
        info += `, Showroom: ${b.showroomName}`;
      }
      if (b.website) info += `, Website: ${b.website}`;
      if (b.instagram) info += `, IG: ${b.instagram}`;
      return info;
    })
    .join('\n');

  // Filter Contacts - only valid ones
  const validContacts = data.contacts.filter(c => c.name && c.name.trim() !== '' && c.name !== 'N/A');
  // Create a formatted list of ALL valid contacts for the contract body
  const validContactsList = validContacts.map(c =>
    `- Name: ${c.name}${c.title ? ` (${c.title})` : ''}\n  Email: ${c.email}${c.phone ? `\n  Phone: ${c.phone}` : ''}`
  ).join('\n\n');

  // Still identify primary for the "Parties" preamble
  const primaryContact = validContacts[0] || { name: data.email, title: '', email: data.email };

  const fixturesList = data.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n');
  const categoriesList = data.categories.join(', ') + (data.categories.includes('Other') && data.otherCategory ? ` (${data.otherCategory})` : '');

  const prompt = `
    Generate a formal, legally binding "Exhibition Service Agreement" between **[Organizer Name]** and **${data.companyName}**.

    **Contract Data:**
    - Date: ${new Date().toLocaleDateString()}
    - Exhibitor Type: ${data.exhibitorType}
    - Company Name: ${data.companyName}
    - Company Address: ${data.address}
    
    **Brands Displayed:**
${brandsList}

    **Authorized Contacts:**
${validContactsList}
    
    **Scope of Services / Booth Details:**
    - Booth Package: ${data.finalBoothSize || data.boothSize}
    - Fixtures Included:
${fixturesList}
    - Categories: ${categoriesList}
    - Payment Method: ${data.paymentMode || 'Not Specified'}

    **Instructions for Output:**
    1. **Parties Section**: Start with a formal declaration: "This Agreement is made on [Date] between [Organizer Name] ('Organizer') and ${data.companyName}, located at ${data.address} ('Vendor')."
    2. **Exhibitor Info Section**: Create a distinct section titled "Exhibitor Information". List the **Exhibitor Type**, **Company Name**, and **Brands/Showroom** details here.
    3. **Contact Details Section**: Create a distinct section titled "Contact Details". List **ALL** contacts provided in the "Authorized Contacts" data above. Do NOT include any "N/A" or empty placeholder fields. If multiple contacts are listed above, list all of them.
    4. **Scope Section**: Clearly list the Booth Package and Fixtures.
    5. **Standard Clauses**: Include standard sections for Payment, Cancellation Policy, Liability, and Insurance.
    6. **Signature Block**: Include space for signatures for clear identification.
    7. **Format**: Use clean Markdown.
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