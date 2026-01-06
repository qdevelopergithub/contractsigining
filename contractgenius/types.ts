export interface SelectedFixture {
  type: string;
  quantity: number;
}

export interface AdditionalContact {
  name: string;
  email: string;
  phone: string;
  countryCode: string;
}

export interface VendorDetails {
  // Exhibitor Info
  company: string;
  brandName: string;
  showroomName?: string;
  website?: string;
  instagram?: string;

  // Primary Contact
  name: string;
  title?: string;
  email: string;
  phone: string;
  countryCode: string;
  address: string;

  // Categories
  categories: string[];
  otherCategory?: string;

  // Booth & Fixtures
  boothSize: string;
  finalBoothSize?: string;
  customBoothSize?: string;
  customBoothRequirements?: string;

  // Multi-Fixture Support
  selectedFixtures: SelectedFixture[];

  // Additional Contact
  additionalContact?: AdditionalContact;

  // Legacy
  fixture: string;
  fixtureQuantity: number;

  eventDate: string;
  specialRequirements: string;
}

export interface Contract {
  id: string;
  vendorDetails: VendorDetails;
  status: 'draft' | 'sent' | 'signed';
  content: string; // Markdown content
  createdAt: number;
  signedAt?: number;
  signatureBase64?: string;
  magicLink: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}