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

  const categoriesList = details.categories?.map(c => c === 'Other' ? `Other (${details.otherCategory})` : c).join(', ') || 'General';

  const prompt = `
    TASK: GENERATE A FORMAL, LEGALLY BINDING "EXHIBITION SERVICE AGREEMENT".
    STRICT RULE: DO NOT USE ANY PLACEHOLDERS LIKE [DATE], [CITY], [CONTACT NAME], OR [Organizing Company Name]. 
    USE THE PROVIDED DATA EXACTLY. IF DATA IS MISSING (LIKE INDIVIDUAL'S NAME IN HEADER), USE THE COMPANY NAME "${details.company}".
    
    ORGANIZER DETAILS (HARDCODED):
    - Name: CABANA Exhibition Organizing
    - Address: One World Trade Center, Suite 85, New York, NY 10007, USA
    - Authorized Representative: Licensing Department

    VENDOR/EXHIBITOR DATA:
    - Company: ${details.company}
    - Address: ${details.address}
    - Exhibitor Type: ${details.exhibitorType}
    - Primary Representative: ${primaryContact.name} (${primaryContact.title || 'Director'})
    - Contact Email: ${primaryContact.email}
    
    DISPLAY DATA (MANDATORY INCLUSION):
    - Brands Displayed: ${brandsList}
    - Categories: ${categoriesList}
    
    BOOTH & LOGISTICS DATA:
    - Package: ${details.finalBoothSize || details.boothSize}
    - Allocated Fixtures: ${fixturesList}
    - Furniture Package: ${furnitureText}
    - Special Notes: ${details.notes || 'None'}
    - Payment Method: ${details.paymentMode || 'Credit Card'}

    OUTPUT STRUCTURE (USE THIS EXACTLY):
    
    # EXHIBITION SERVICE AGREEMENT
    
    This Agreement is made on ${new Date().toLocaleDateString()} by and between **CABANA Exhibition Organizing**, with its principal office at One World Trade Center, Suite 85, New York, NY 10007 ("Organizer") and **${details.company}**, located at ${details.address} ("Exhibitor").

    ## 1. EXHIBITOR INFORMATION & BRANDS
    The Exhibitor (${details.exhibitorType}) shall display the following authorized brands:
    ${brandsList}
    Categorization: ${categoriesList}

    ## 2. AUTHORIZED REPRESENTATIVES
    Authorized personnel for the duration of the event:
    ${validContactsList}

    ## 3. BOOTH ALLOCATION & FIXTURES
    The Organizer grants the Exhibitor use of the following Booth Package:
    - **Size**: ${details.finalBoothSize || details.boothSize}
    - **Fixtures**: ${fixturesList}
    - **Standard Furniture**: ${furnitureText}
    
    ## 4. SPECIAL REQUIREMENTS & BILLING
    - **Additional Notes**: ${details.notes || "No additional requirements provided."}
    - **Payment Mode**: The Exhibitor has selected "${details.paymentMode || 'Credit Card'}" for all billing associated with this agreement.

    ## 5. STANDARD TERMS & CONDITIONS
    - **Liability**: The Exhibitor agrees to maintain appropriate insurance and indemnifies the Organizer against any damages to the booth or venue caused by their installation.
    - **Cancellation**: Cancellation policies apply as per the standard Cabana Exhibitor Guide.
    - **Governing Law**: This Agreement shall be governed by the laws of the State of New York.

    ## 6. EXECUTION
    By signing this document electronically, the parties agree to be bound by its terms.

    **FOR ORGANIZER:**
    CABANA Exhibition Organizing
    Authorized Signatory: Licensing Department
    
    **FOR EXHIBITOR:**
    ${details.company}
    Authorized Signatory: ${primaryContact.name}
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