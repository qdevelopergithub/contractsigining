import { VendorFormData } from "../types";

export const generateVendorContract = async (data: VendorFormData): Promise<string> => {
  // 1. Format Brands
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
    .join('\n') || '- N/A';

  // 2. Format All Contacts
  const validContactsList = data.contacts
    .filter(c => c.name && c.name.trim() !== '')
    .map(c =>
      `- Name: ${c.name}\n  Title: ${c.title || 'N/A'}\n  Email: ${c.email}\n  Phone: ${c.phone || 'N/A'}`
    ).join('\n\n') || '- N/A';

  // 3. Format Fixtures
  const fixturesList = data.selectedFixtures?.map(f => `- ${f.type} (Qty: ${f.quantity})`).join('\n') || '- No specifics provided';

  // 4. Categories & Other
  const categoriesList = data.categories.join(', ') +
    (data.categories.includes('Other') && data.otherCategory ? ` (Other: ${data.otherCategory})` : '');

  // 5. Furniture
  const calculateFurniture = (fixtures: number) => {
    if (fixtures < 4) return { tables: 1, chairs: 2 };
    const tables = Math.floor(fixtures / 4);
    const chairs = tables * 3;
    return { tables, chairs };
  };
  const totalFixtures = data.selectedFixtures ? data.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0) : 0;
  const furniture = calculateFurniture(totalFixtures);
  const furnitureText = `${furniture.tables} Table(s) and ${furniture.chairs} Chair(s)`;

  // Construct the static template
  const contractText = `
VENDOR AGREEMENT
Contract ID: (Generated upon submission)
Date: ${new Date().toLocaleDateString()}

1. AGREEMENT PARTIES
This agreement is between CABANA Exhibition Organizing ("Organizer") and ${data.companyName} (hereinafter referred to as "Vendor").

Exhibitor Info:
Company: ${data.companyName}
Brands:
${brandsList}
Address: ${data.address}

Authorized Contacts:
${validContactsList}

2. BOOTH ALLOCATION & FIXTURES
The Vendor is allocated the following:
Booth Size/Type: ${data.finalBoothSize || data.boothSize || "Standard"}${data.customBoothSize ? ` (Custom Size: ${data.customBoothSize})` : ''}
Categories: ${categoriesList || 'General'}

Standard Furniture Allotment:
${furnitureText}

Selected Fixtures:
${fixturesList}

3. SPECIAL REQUIREMENTS & LOGISTICS
Booth Customizations: ${data.customBoothRequirements || "None"}
Special Requirements (Logistics): ${data.specialRequirements || "None"}
Additional Notes: ${data.notes || "None"}
Payment Method: ${data.paymentMode || "Credit Card"}

4. TERMS
Standard terms and conditions apply. The Vendor agrees to maintain appropriate insurance and indemnifies the Organizer against all claims, damages, or losses arising from their participation in the exhibition. This agreement is governed by the laws of New York State.

*End of Document Text*
  `.trim();

  return Promise.resolve(contractText);
};