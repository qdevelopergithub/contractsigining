import { VendorDetails } from "../types";

export const generateContractDraft = async (details: VendorDetails): Promise<string> => {
  // 1. Format Brands
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
    .join('\n') || '- N/A';

  // 2. Format All Contacts
  const validContactsList = details.contacts
    .filter(c => c.name && c.name.trim() !== '')
    .map(c =>
      `- Name: ${c.name}\n  Title: ${c.title || 'N/A'}\n  Email: ${c.email}\n  Phone: ${c.phone || 'N/A'}`
    ).join('\n\n') || '- N/A';

  // 3. Format Fixtures
  const fixturesList = details.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || `- ${details.fixture} (Qty: ${details.fixtureQuantity})`;

  // 4. Categories & Other
  const categoriesList = details.categories?.map(c => c === 'Other' ? `Other: ${details.otherCategory || 'Miscellaneous'}` : c).join(', ') || 'N/A';

  // 5. Furniture
  const calculateFurniture = (fixtures: number) => {
    if (fixtures < 4) return { tables: 1, chairs: 2 };
    const tables = Math.floor(fixtures / 4);
    const chairs = tables * 3;
    return { tables, chairs };
  };
  const totalFixtures = details.selectedFixtures ? details.selectedFixtures.reduce((sum, f) =>
    sum + (f.type === '2 Accessory Shelves (Stacked)' ? f.quantity * 2 : f.quantity), 0
  ) : details.fixtureQuantity;
  const furniture = calculateFurniture(totalFixtures);
  const furnitureText = `${furniture.tables} Table(s) and ${furniture.chairs} Chair(s)`;

  // Construct the static template
  const contractText = `
EXHIBITION SERVICE AGREEMENT
Date: ${new Date().toLocaleDateString()}

1. AGREEMENT PARTIES
This agreement is between CABANA Exhibition Organizing ("Organizer") and ${details.company} (hereinafter referred to as "Vendor").

Exhibitor Info:
Company: ${details.company}
Brands:
${brandsList}
Address: ${details.address}

Authorized Contacts:
${validContactsList}

2. BOOTH ALLOCATION & FIXTURES
The Vendor is allocated the following:
Booth Size/Type: ${details.finalBoothSize || details.boothSize || "Standard"}${details.customBoothSize ? ` (Custom Size: ${details.customBoothSize})` : ''}
Categories: ${categoriesList}

Standard Furniture Allotment:
${furnitureText}

Selected Fixtures:
${fixturesList}

3. SPECIAL REQUIREMENTS & LOGISTICS
Booth Customizations: ${details.customBoothRequirements || "None"}
Special Requirements: ${details.specialRequirements || "None"}
Additional Notes: ${details.notes || "None"}
Payment Method: ${details.paymentMode || "Credit Card"}

4. TERMS
Standard terms and conditions apply. The Vendor agrees to maintain appropriate insurance and indemnifies the Organizer against all claims, damages, or losses arising from their participation in the exhibition. This agreement is governed by the laws of New York State.

*End of Document Text*
  `.trim();

  return Promise.resolve(contractText);
};