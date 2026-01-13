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

  const calculateFurniture = (fixtures: number) => {
    if (fixtures < 4) return { tables: 1, chairs: 2 };
    const tables = Math.floor(fixtures / 4);
    const chairs = tables * 3;
    return { tables, chairs };
  };
  const furniture = calculateFurniture(details.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0));
  const furnitureText = `${furniture.tables} Table(s) and ${furniture.chairs} Chair(s)`;

  const categoriesList = details.categories?.map(c => c === 'Other' ? `Other [SPECIFIC CATEGORY: ${details.otherCategory || 'Miscellaneous'}]` : c).join(', ') || 'N/A';

  const prompt = `
    TASK: GENERATE A PROFESSIONAL EXHIBITION SERVICE AGREEMENT.
    
    CRITICAL RULES (NON-NEGOTIABLE):
    1. NEVER OUTPUT UNDERSCORES IN THE TEXT (E.G., NO "______").
    2. NEVER OUTPUT WORDS LIKE "Signature:", "Signed:", or "Date:" IN A SIGNATORY CONTEXT.
    3. THE TEXT MUST END WITH THE STATEMENT "*End of Document Text*". NOTHING FOLLOWS THIS.
    4. PRESERVE THE FULL CATEGORY DESCRIPTION: If a category says "Other [SPECIFIC CATEGORY: ...]", output the entire bracketed text.
    5. NO PLACEHOLDERS: Do not use square brackets like "[Insert Date]".

    ORGANIZER (CABANA):
    - Company: CABANA Exhibition Organizing
    - Address: One World Trade Center, Suite 85, New York, NY 10007, USA

    EXHIBITOR DATA:
    - Company: ${details.company}
    - Address: ${details.address}
    - Type: ${details.exhibitorType}
    - Primary Contact: ${primaryContact.name} (${primaryContact.title || 'Representative'})
    - Contact Email: ${primaryContact.email}
    - Categories: ${categoriesList}
    
    MANDATORY LIST OF BRANDS:
    ${brandsList || "- No specific brands listed"}

    MANDATORY LIST OF AUTHORIZED CONTACTS:
    ${validContactsList || "- No additional contacts listed"}
    
    LOGISTICS:
    - Booth Size: ${details.finalBoothSize || details.boothSize || "Standard"}
    - Fixtures Allocated: ${fixturesList}
    - Furniture Package: ${furnitureText}
    - Special Notes: ${details.notes || 'None'}
    - Payment Method: ${details.paymentMode || 'Credit Card'}

    CONTRACT STRUCTURE:
    
    # EXHIBITION SERVICE AGREEMENT
    
    This Agreement is formalized on ${new Date().toLocaleDateString()} between CABANA Exhibition Organizing ("Organizer") and ${details.company} ("Exhibitor").

    ## ARTICLE 1: EXHIBITOR PROFILE
    - **Exhibitor Name**: ${details.company}
    - **Address**: ${details.address}
    - **Exhibitor Type**: ${details.exhibitorType}
    - **Display Categories**: ${categoriesList}

    ## ARTICLE 2: AUTHORIZED REPRESENTATIVES
    The following individuals are registered as authorized representatives for this exhibition:
    ${validContactsList}

    ## ARTICLE 3: BRANDS DISPLAYED
    The Exhibitor represents and warrants they are authorized to display the following brands:
    ${brandsList}

    ## ARTICLE 4: ALLOCATION OF SPACE & LOGISTICS
    - **Booth Package**: ${details.finalBoothSize || details.boothSize}
    - **Fixtures Requested**:
    ${fixturesList}
    - **Standard Furniture**: ${furnitureText}
    
    ## ARTICLE 5: SPECIAL NOTES & REQUESTS
    ${details.notes || "No special requirements or notes have been submitted."}

    ## ARTICLE 6: BILLING & TERMS
    - **Payment Selection**: ${details.paymentMode || 'Credit Card'}
    - **Liability**: The Exhibitor agrees to the standard liability and insurance terms provided in the Cabana Exhibitor Handbook.
    - **Governing Law**: This agreement is governed by the laws of New York State.

    *End of Document Text*
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

    let content = completion.choices[0]?.message?.content || "Error: Could not generate contract text.";

    // Post-processing to strip hallucinated signature blocks
    // This regex looks for patterns like --- followed by "Exhibitor's Signature" and underscores
    content = content.replace(/---[\s\S]*?(Exhibitor|Signature|Date):?\s*_{3,}/gi, '');
    // Also remove any stray signature lines at the end
    content = content.replace(/(Signature|Date|Signed|Name):?\s*_{3,}/gi, '');
    // Remove triple dashes at the end if they preceded a signature block
    content = content.replace(/\s*---\s*$/g, '');

    return content;
  } catch (error) {
    console.error("GROQ API Error:", error);
    return "Error: Failed to connect to AI service. Please check your API key.";
  }
};