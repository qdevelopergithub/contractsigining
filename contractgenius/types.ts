export interface SelectedFixture {
  type: string;
  quantity: number;
}

export interface ContactInfo {
  name: string;
  email: string;
  title?: string;
}

export interface BrandInfo {
  brandName: string;
  showroomName?: string;
  website?: string;
  instagram?: string;
}

export interface VendorDetails {
  // Exhibitor Info
  exhibitorType: string;
  brands: BrandInfo[];
  company: string;

  // Contacts
  contacts: ContactInfo[];

  // Primary Contact (Legacy fields for single contact access if needed)
  email: string;
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