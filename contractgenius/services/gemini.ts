import Groq from "groq-sdk";
import { VendorDetails } from "../types";

// Initialize Groq Client
const getClient = () => {
  const apiKey = process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_GROQ_API_KEY environment variable is missing.");
  }
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true
  });
};

export const generateContractDraft = async (details: VendorDetails): Promise<string> => {
  const client = getClient();

  // Filter and format Brands based on Exhibitor Type
  const brandsList = details.brands
    .filter(b => b.brandName && b.brandName.trim() !== '')
    .map(b => {
      let info = `- Brand: ${b.brandName}`;
      if (details.exhibitorType === 'Multi-line showroom' && b.showroomName) {
        info += `, Showroom: ${b.showroomName}`;
      }
      if (b.website) info += `, Website: ${b.website}`;
      if (b.instagram) info += `, IG: ${b.instagram}`;
      return info;
    })
    .join('\n');

  // Filter Contacts - only valid ones
  const validContacts = details.contacts.filter(c => c.name && c.name.trim() !== '' && c.name !== 'N/A');
  // Create a formatted list of ALL valid contacts
  const validContactsList = validContacts.map(c =>
    `- Name: ${c.name}${c.title ? ` (${c.title})` : ''}\n  Email: ${c.email}${c.phone ? `\n  Phone: ${c.phone}` : ''}`
  ).join('\n\n');

  const primaryContact = validContacts[0] || { name: details.email, title: '', email: details.email };

  // Format Fixtures
  const fixturesList = details.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || `- ${details.fixture} (Qty: ${details.fixtureQuantity})`;

  const prompt = `
    Generate a formal, legally binding "Exhibition Service Agreement" between **[Organizer Name]** and **${details.company}**.

    **Contract Data:**
    - Date: ${new Date().toLocaleDateString()}
    - Exhibitor Type: ${details.exhibitorType}
    - Company Name: ${details.company}
    - Company Address: ${details.address}

    **Brands Displayed:**
${brandsList}

    **Authorized Contacts:**
${validContactsList}
    
    **Scope of Services / Booth Details:**
    - Booth Package: ${details.finalBoothSize || details.boothSize}
    - Fixtures Included:
${fixturesList}
    - Categories: ${details.categories?.join(', ') || 'General'}
    - Special Requirements: ${details.specialRequirements || 'None'}

    **Instructions for Output:**
    1. **Parties Section**: Start with a formal declaration: "This Agreement is made on [Date] between [Organizer Name] ('Organizer') and ${details.company}, located at ${details.address} ('Vendor')."
    2. **Exhibitor Info Section**: Create a distinct section titled "Exhibitor Information". List the **Exhibitor Type**, **Company Name**, and **Brands/Showroom** details here.
    3. **Contact Details Section**: Create a distinct section titled "Contact Details". List **ALL** contacts provided in the "Authorized Contacts" data above. Do NOT include any "N/A" or empty placeholder fields.
    4. **Scope Section**: Clearly list the Booth Package and Fixtures. List the allocated Brands under "Permitted Merchandise" or "Brands On Display".
    5. **Standard Clauses**: Include standard sections for Payment (100% due on invoice), Cancellation Policy, Liability, and Insurance.
    6. **Signature Block**: Include space for signatures for clear identification.
    7. **Format**: Use clean Markdown.
  `;

  try {
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    return completion.choices[0]?.message?.content || "Error: Could not generate contract text.";
  } catch (error) {
    console.error("GROQ API Error:", error);
    return "Error: Failed to connect to AI service. Please check your API key.";
  }
};