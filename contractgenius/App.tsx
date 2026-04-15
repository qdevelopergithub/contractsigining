
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

    // Check for contract ID in hash route
    if (window.location.hash.startsWith('#/contract/')) {
      const contractId = window.location.hash.slice('#/contract/'.length);
      console.log(`[App] Loading contract from server: ${contractId}`);

      try {
        // Fetch contract from server
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
        const response = await fetch(`${backendUrl}/api/contracts/${contractId}`);

        if (response.status === 410) {
          // Contract is already signed - link expired
          const data = await response.json();
          console.log(`[App] 🔒 Contract ${contractId} is already signed - Link EXPIRED`);

          // Save minimal contract data to show "Already Signed" screen
          const expiredContract: Contract = {
            id: contractId,
            status: 'signed' as const,
            vendorDetails: {
              exhibitorType: '',
              brands: [],
              company: 'Vendor',
              contacts: [{ name: 'Vendor', email: '' }],
              email: '',
              address: '',
              categories: [],
              boothSize: '',
              selectedFixtures: [],
              fixture: '',
              fixtureQuantity: 0,
              eventDates: [],
              specialRequirements: ''
            },
            content: 'This contract has been signed.',
            createdAt: Date.now(),
            magicLink: window.location.href
          };
          saveContract(expiredContract);

          if (mountedRef.current) {
            setCurrentContractId(contractId);
            setIsInitializing(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const contractData = await response.json();
        console.log(`[App] ✅ Contract ${contractId} loaded from server - Status: ${contractData.status}`);

        // Save to local storage for offline access
        saveContract(contractData);

        if (mountedRef.current) {
          setCurrentContractId(contractId);
          setIsInitializing(false);
        }
      } catch (error) {
        console.error(`[App] ❌ Failed to load contract from server:`, error);

        // Fallback: Try loading from local storage
        const localContract = getContractById(contractId);
        if (localContract) {
          console.log(`[App] ⚠️ Using local cached contract`);
          if (mountedRef.current) {
            setCurrentContractId(contractId);
            setIsInitializing(false);
          }
        } else {
          if (mountedRef.current) {
            setError("Unable to load contract. Please check your connection and try again.");
            setConnectionFailed(true);
            setIsInitializing(false);
          }
        }
      }
    }
    // No contract ID in URL
    else {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
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