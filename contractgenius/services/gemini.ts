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

  const brandsList = details.brands.map(b => `- ${b.brandName}${b.showroomName ? ` (${b.showroomName})` : ''}${b.website ? `, Website: ${b.website}` : ''}${b.instagram ? `, IG: ${b.instagram}` : ''}`).join('\n') || '- N/A';
  const contactsList = details.contacts.map(c => `- ${c.name}${c.title ? ` (${c.title})` : ''}, Email: ${c.email}`).join('\n') || `- ${details.email}`;
  const fixturesList = details.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || `- ${details.fixture} (Qty: ${details.fixtureQuantity})`;
  const categoriesList = details.categories?.join(', ') || 'N/A';

  const prompt = `
    Generate a professional, legally structured service contract for a trade show or exhibition vendor.
    
    Exhibitor Info:
    - Exhibitor Type: ${details.exhibitorType}
    - Company Name: ${details.company}
    - Brands/Showroom Details:
${brandsList}
    
    Contact Information (For "Parties" section):
${contactsList}
    - Company Address: ${details.address}

    Categories:
    - ${categoriesList}

    Booth & Fixtures:
    - Booth Size/Type: ${details.finalBoothSize || details.boothSize}
    - Selected Fixtures:
${fixturesList}
    - Special Requirements: ${details.specialRequirements}

    Requirements:
    1. Title: "Exhibition Service Agreement".
    2. Date: Use today's date (${new Date().toLocaleDateString()}).
    3. **Parties Section:** 
       - Explicitly state the Agreement is between [Organizer Name] and **${details.company}**. 
       - Include the **Company Address** and the **Primary Contact Name** as the authorized representative in this section.
    4. **Contact Details:** Do NOT create a separate "Contact Details" section in the contract body. The contact info in the Parties section is sufficient.
    5. **Exhibitor Specifics:** Only include Brand/Showroom details that are relevant to the selected Exhibitor Type (${details.exhibitorType}).
    6. Include sections for: Agreement Parties, Booth Allocation & Fixtures, Fees & Payment, Liability & Insurance, and Signatures.
    7. The tone should be formal and binding.
    8. Format in Markdown.
    Do not include any conversational filler at the beginning or end.
    Use placeholders like [Organizer Name] for the event organizer details.
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
    console.error("Gemini API Error:", error);
    return "Error: Failed to connect to AI service. Please check your API key.";
  }
};