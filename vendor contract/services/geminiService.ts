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

  const calculateFurniture = (fixtures: number) => {
    if (fixtures < 4) return { tables: 1, chairs: 2 };
    const tables = Math.floor(fixtures / 4);
    const chairs = tables * 3;
    return { tables, chairs };
  };
  const furniture = calculateFurniture(data.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0));
  const furnitureText = `${furniture.tables} Table(s) and ${furniture.chairs} Chair(s)`;

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
    - Standard Furniture Allotment: ${furnitureText}
    - Categories: ${categoriesList}
    - Payment Method: ${data.paymentMode || 'Not Specified'}
    - Additional Notes/Requests: ${data.notes || 'None'}

    **Instructions for Output:**
    1. **Parties Section**: Start with a formal declaration: "This Agreement is made on [Date] between [Organizer Name] ('Organizer') and ${data.companyName}, located at ${data.address} ('Vendor')."
    2. **Exhibitor Info Section**: Create a distinct section titled "Exhibitor Information". List the **Exhibitor Type**, **Company Name**, and **Brands/Showroom** details here.
    3. **Contact Details Section**: Create a distinct section titled "Contact Details". List **ALL** contacts provided in the "Authorized Contacts" data above. Do NOT include any "N/A" or empty placeholder fields. If multiple contacts are listed above, list all of them.
    4. **Scope Section**: Clearly list the Booth Package, Fixtures, and the **Standard Furniture Allotment** (${furnitureText}).
    5. **Special Requests & Billing**: If there are any **Additional Notes/Requests**, include them in a separate section titled "Special Requests & Adjacencies". Clearly state the **Payment Method** (${data.paymentMode || 'Not Specified'}) as well.
    6. **Standard Clauses**: Include standard sections for Cancellation Policy, Liability, and Insurance.
    7. **Signature Block**: Include space for signatures for clear identification.
    8. **Format**: Use clean Markdown.
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