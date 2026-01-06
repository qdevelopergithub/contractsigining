
import React, { useState, useEffect, useRef } from 'react';
import { VendorContractView } from './components/VendorContractView';
import { Navbar } from './components/Navbar';
import { saveContract, getContractById } from './services/storage';
import { VendorDetails, Contract } from './types';
import { Loader2, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';


const App: React.FC = () => {
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Verifying secure link...");
  const [connectionFailed, setConnectionFailed] = useState(false);

  // Ref to track component mount status for async operations
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    init();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const init = async () => {
    if (!mountedRef.current) return;

    setIsInitializing(true);
    setConnectionFailed(false);
    setError(null);

    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');
    const idParam = params.get('id');

    // OPTION 1: Embedded Data in URL (Primary)
    if (dataParam) {
      try {
        const cleanBase64 = decodeURIComponent(dataParam);
        const jsonString = atob(cleanBase64);
        const data = JSON.parse(jsonString);
        const importedId = data.id || 'import_' + Math.random().toString(36).substr(2, 9);
        processContractData(data, importedId);
      } catch (e) {
        console.error("Failed to parse magic link data", e);
        if (mountedRef.current) {
          setError("Invalid Secure Link Data.");
          setIsInitializing(false);
        }
      }
    }
    // OPTION 2: Hash Route (Local Refresh/History)
    else if (window.location.hash.startsWith('#/contract/')) {
      const id = window.location.hash.slice('#/contract/'.length);
      const local = getContractById(id);
      if (local) {
        if (mountedRef.current) {
          setCurrentContractId(id);
          setIsInitializing(false);
        }
      } else {
        if (mountedRef.current) {
          setError("Contract not found locally.");
          setIsInitializing(false);
        }
      }
    }
    // OPTION 3: Idle / No Params
    else {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  };


  const processContractData = (data: any, id: string) => {
    if (!mountedRef.current) return;

    const vendorDetails: VendorDetails = {
      // Exhibitor Info
      company: data.companyName || data.company || 'Vendor Co',
      brandName: data.brandName || '',
      showroomName: data.showroomName || '',
      website: data.website || '',
      instagram: data.instagram || '',

      // Primary Contact
      name: data.fullName || data.name || data.contactName || 'Valued Vendor',
      title: data.title || '',
      email: data.email || 'vendor@example.com',
      phone: data.phone || '',
      countryCode: data.countryCode || data.countryCodePrimary || '+1',
      address: data.address || '',

      // Categories
      categories: Array.isArray(data.categories) ? data.categories : [],
      otherCategory: data.otherCategory || '',

      // Booth & Fixtures
      boothSize: data.finalBoothSize || data.boothSize || data.boothType || "1 Standard || 13' x 8' || (4 Fixtures)",
      finalBoothSize: data.finalBoothSize,
      customBoothSize: data.customBoothSize,
      customBoothRequirements: data.customBoothRequirements,

      // Multi-Fixture Support
      selectedFixtures: data.selectedFixtures || [{ type: data.fixture || 'Display Counter (Large)', quantity: parseInt(data.fixtureQuantity) || 4 }],

      // Legacy
      fixture: data.fixture || 'Display Counter (Large)',
      fixtureQuantity: parseInt(data.fixtureQuantity) || 4,

      eventDate: data.eventDate || new Date().toISOString().split('T')[0],
      specialRequirements: data.specialRequirements || 'None',
      additionalContact: data.additionalContact || {
        name: data.altName || '',
        email: data.altEmail || '',
        phone: data.altPhone || '',
        countryCode: data.altCountryCode || '+1'
      }
    };

    const existingContract = getContractById(id);

    // Generate content if not exists
    let content = existingContract?.content || '';
    if (!content) {
      const fixturesList = vendorDetails.selectedFixtures.map(f => `* ${f.type} (Qty: ${f.quantity})`).join('\n');
      const cats = vendorDetails.categories.join(', ') + (vendorDetails.otherCategory ? ` (${vendorDetails.otherCategory})` : '');

      content = `
# EXHIBITION SERVICE AGREEMENT

**Date:** ${new Date().toLocaleDateString()}

## 1. AGREEMENT PARTIES
This agreement is between **Event Organizer** and **${vendorDetails.company}** (hereinafter referred to as "Vendor").

**Exhibitor Info:**
* **Company:** ${vendorDetails.company}
* **Brand:** ${vendorDetails.brandName}
* **Address:** ${vendorDetails.address}

**Primary Contact:**
* **Name:** ${vendorDetails.name}
* **Title:** ${vendorDetails.title}
* **Email:** ${vendorDetails.email}
* **Phone:** ${vendorDetails.countryCode} ${vendorDetails.phone}

**Additional Contact (For Reference):**
* **Name:** ${vendorDetails.additionalContact?.name || 'N/A'}
* **Email:** ${vendorDetails.additionalContact?.email || 'N/A'}
* **Phone:** ${vendorDetails.additionalContact?.phone ? (vendorDetails.additionalContact.countryCode + ' ' + vendorDetails.additionalContact.phone) : 'N/A'}

## 2. BOOTH ALLOCATION & FIXTURES
The Vendor is allocated the following:
* **Booth Size/Type:** ${vendorDetails.boothSize}
${vendorDetails.customBoothRequirements ? `* **Custom Requirements:** ${vendorDetails.customBoothRequirements}\n` : ''}
* **Categories:** ${cats}

**Selected Fixtures:**
${fixturesList}

## 3. SPECIAL REQUIREMENTS
${vendorDetails.specialRequirements}

## 4. TERMS
Standard terms and conditions apply. The Vendor agrees to indemnify the Organizer against all claims.
          `.trim();
    }

    const newContract: Contract = {
      id: id,
      vendorDetails,
      status: existingContract?.status || 'sent',
      content,
      createdAt: existingContract?.createdAt || Date.now(),
      magicLink: window.location.href,
      signedAt: existingContract?.signedAt,
      signatureBase64: existingContract?.signatureBase64
    };

    saveContract(newContract);
    setCurrentContractId(id);

    if (!window.location.hash.includes(id)) {
      window.history.replaceState({}, '', `?id=${id}#/contract/${id}`);
    }
    setIsInitializing(false);
  };

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const handleRetry = () => {
    setLoadingMessage("Retrying connection...");
    setConnectionFailed(false);
    setError(null);
    init();
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-6" />
        <h2 className="text-gray-700 font-medium text-lg">{loadingMessage}</h2>
        <p className="text-gray-400 text-sm mt-2">Establishing secure connection...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navbar currentRoute="" navigate={navigate} />
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="text-red-500 w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentContractId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
        <Navbar currentRoute={`#/contract/${currentContractId}`} navigate={navigate} />
        <main className="flex-grow container mx-auto px-4 py-8 max-w-7xl">
          <VendorContractView contractId={currentContractId} navigate={navigate} />
        </main>
        <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
          <p>© 2024 ContractGenius. Secure Document Signing Portal.</p>
        </footer>
      </div>
    );
  }

  // Fallback Landing
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navbar currentRoute="" navigate={navigate} />
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white p-10 rounded-2xl shadow-xl border border-indigo-50 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="text-indigo-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Secure Vendor Portal</h1>
          <p className="text-gray-500 leading-relaxed mb-6">
            {connectionFailed
              ? "We couldn't automatically load your contract details. Please click retry or use the specific link from your email."
              : "This portal is restricted to authorized vendors. Please use the specific link provided in your email to access your agreement."
            }
          </p>

          {connectionFailed && (
            <button
              onClick={handleRetry}
              className="flex items-center justify-center space-x-2 w-full py-3 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition border border-indigo-200"
            >
              <RefreshCw size={18} />
              <span>Retry Connection</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;