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
    - Brands:
${brandsList}
    
    Contact Details:
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
    3. **Important:** Explicitly include the **Company Address** and **Company Name** in the Parties section.
    4. Include sections for: Agreement Parties, Booth Allocation & Fixtures, Fees & Payment, Liability & Insurance, and Signatures.
    5. The tone should be formal and binding.
    6. Format in Markdown.
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