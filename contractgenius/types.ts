export interface SelectedFixture {
  type: string;
  quantity: number;
}

export interface ContactInfo {
  name: string;
  email: string;
  title?: string;
  phone?: string;
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
  name?: string;

  // Contacts
  contacts: ContactInfo[];

  // Primary Contact
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

  eventDates: string[]; // Changed from eventDate: string
  specialRequirements: string;
  notes?: string;
  paymentMode?: string;
  
  // Billing Fields
  baseAmount?: number;
  ccFee?: number;
  totalAmount?: number;
  depositAmount?: number;
}

export type ContractStatus = 'Draft' | 'sent' | 'signed' | 'Pending deposit' | 'Pending balance' | 'paid' | 'void';

export interface Contract {
  id: string;
  vendorDetails: VendorDetails;
  status: ContractStatus;
  content: string; // Markdown content
  createdAt: number;
  signedAt?: number;
  signatureBase64?: string;
  magicLink: string;
  
  // Deadlines
  depositDeadline?: number;
  finalBalanceDeadline?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}