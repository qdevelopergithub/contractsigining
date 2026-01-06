export enum BoothSize {
  ONE_STANDARD = "1 Standard || 13' x 8' || (4 Fixtures)",
  ONE_HALF_STANDARD = "1.5 Standard || 20' x 8' || (6 Fixtures)",
  TWO_STANDARD = "2 Standard || (8 Fixtures)",
  TWO_HALF_STANDARD = "2.5 Standard || (10 Fixtures)",
  THREE_STANDARD = "3 Standard || (12 Fixtures)",
  ACCESSORY_TWO = "Accessory Booth (2 Fixtures)",
  ACCESSORY_THREE = "Accessory Booth (3 Fixtures)",
  CUSTOM_LARGE = "Custom Fixture"
}

export interface SelectedFixture {
  type: FixtureType;
  quantity: number;
}

export interface AdditionalContact {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
}

export enum FixtureType {
  DISPLAY_COUNTER_L = 'Display Counter (Large)',
  DISPLAY_COUNTER_S = 'Display Counter (Small)',
  SHELVING_UNIT_4FT = 'Shelving Unit (4ft)',
  SHELVING_UNIT_6FT = 'Shelving Unit (6ft)',
  TABLE_6FT = 'Rectangular Table (6ft)',
  TABLE_4FT = 'Rectangular Table (4ft)',
  CHAIR_STANDARD = 'Standard Exhibition Chair',
  CLOTHING_RAIL = 'Clothing Rail / Rack',
  SHOWCASE_CABINET = 'Showcase Cabinet (Glass)',
  BROCHURE_RACK = 'Brochure Rack (Floor Stand)',
  POWER_DROP = 'Power Drop (15 Amp)'
}

export enum PaymentMode {
  CREDIT_CARD = 'Credit Card',
  BANK_TRANSFER = 'Bank Transfer',
  CHECK = 'Check',
  CASH = 'Cash'
}

export type AppStatus = 'IDLE' | 'GENERATING' | 'SENDING' | 'SENT' | 'SIGNING' | 'SIGNED';

export interface VendorFormData {
  // Exhibitor Info
  companyName: string;
  brandName: string;
  showroomName?: string;
  website?: string;
  instagram?: string;

  // Primary Contact
  contactName: string;
  title?: string;
  email: string;
  phone: string;
  countryCode: string;
  address: string;

  // Categories
  categories: string[];
  otherCategory?: string;

  // Booth & Fixtures
  boothSize: BoothSize;
  finalBoothSize?: string;
  customBoothSize?: string;
  customBoothRequirements?: string;

  // Multi-Fixture Support
  selectedFixtures: SelectedFixture[];

  // Additional Contact (Included in contract but not used for sending)
  additionalContact: AdditionalContact;

  // Legacy fields (kept for compatibility in some logic, but will map to selectedFixtures)
  fixture: FixtureType;
  fixtureQuantity: number;

  paymentMode: PaymentMode;
}

export const INITIAL_FORM_DATA: VendorFormData = {
  companyName: '',
  brandName: '',
  showroomName: '',
  website: '',
  instagram: '',
  contactName: '',
  title: '',
  email: '',
  phone: '',
  countryCode: '+1',
  address: '',
  categories: [],
  otherCategory: '',
  boothSize: BoothSize.ONE_STANDARD,
  selectedFixtures: [{ type: FixtureType.DISPLAY_COUNTER_L, quantity: 4 }],
  additionalContact: {
    name: '',
    email: '',
    phone: '',
    countryCode: '+1'
  },
  fixture: FixtureType.DISPLAY_COUNTER_L,
  fixtureQuantity: 4,
  paymentMode: PaymentMode.CREDIT_CARD,
};