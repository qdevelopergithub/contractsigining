import React, { useState, useEffect } from 'react';
import VendorForm from './components/VendorForm';
import ContractPreview from './components/ContractPreview';
import { VendorFormData, INITIAL_FORM_DATA, AppStatus } from './types';
import { generateVendorContract } from './services/geminiService';
import { sendVendorData } from './services/emailService';
import { Sparkles, FileCheck, CheckCircle } from 'lucide-react';

const App: React.FC = () => {
  const [formData, setFormData] = useState<VendorFormData>(INITIAL_FORM_DATA);
  const [contractText, setContractText] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [qbInvoice, setQbInvoice] = useState<{ invoiceId: string; invoiceNumber: string; customerName: string } | null>(null);

  // Keep legacy hash checking if needed, but primary flow is now direct submission
  useEffect(() => {
    const hash = window.location.hash;

    // 1. Handle NEW Magic Links (#/contract/ID)
    if (hash && hash.startsWith('#/contract/')) {
      const contractId = hash.slice('#/contract/'.length);
      setCurrentContractId(contractId);
      console.log(`[App] Loading contract from server: ${contractId}`);

      setAppStatus('GENERATING');
      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contractsigining.onrender.com';
      const backendUrl = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

      fetch(`${backendUrl}/api/contracts/${contractId}`)
        .then(res => {
          if (res.status === 410) {
            setAppStatus('EXPIRED');
            setError("This secure signing link has expired because the contract is already signed.");
            return null;
          }https://${rawBackendUrl}
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (!data) return;
          console.log(`[App] ✅ Contract ${contractId} loaded - Status: ${data.status}`);

          // Map backend data to frontend state
          setFormData(data.vendorDetails || data.vendor || INITIAL_FORM_DATA);
          setContractText(data.content || data.text);

          if (data.status === 'signed') {
            setAppStatus('EXPIRED');
          } else {
            setAppStatus('SIGNING');
          }
        })
        .catch(err => {
          console.error("Failed to load contract", err);
          setError("Failed to load contract details. Please check the link or try again.");
          setAppStatus('IDLE');
        });
      return;
    }

    // 2. Handle LEGACY Links (#data=...)
    if (hash && hash.startsWith('#data=')) {
      const encodedData = hash.replace('#data=', '');
      if (encodedData) {
        try {
          const decodedJson = decodeURIComponent(atob(encodedData));
          const parsedData = JSON.parse(decodedJson) as VendorFormData & { id?: string };

          setFormData(parsedData);

          // Check if expired
          if (parsedData.id) {
            const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contractsigining.onrender.com';
            const backendUrl = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

            fetch(`${backendUrl}/api/contracts/${parsedData.id}`)
              .then(res => {
                if (res.status === 410) {
                  setAppStatus('EXPIRED');
                  setError("This secure signing link has expired because the contract is already signed.");
                  return null;
                }
                return res.json();
              })
              .then(serverData => {
                if (!serverData) return; // Handled by 410 status

                if (serverData.status === 'signed') {
                  setAppStatus('EXPIRED');
                  setError("This secure signing link has expired because the contract is already signed.");
                } else {
                  // Only generate if not expired
                  setAppStatus('GENERATING');
                  generateVendorContract(parsedData).then(text => {
                    setContractText(text);
                    setAppStatus('SIGNING');
                  });
                }
              })
              .catch(() => {
                // If 404 or error, assume valid new link
                setAppStatus('GENERATING');
                generateVendorContract(parsedData).then(text => {
                  setContractText(text);
                  setAppStatus('SIGNING');
                });
              });
          } else {
            // Legacy links without ID
            setAppStatus('GENERATING');
            generateVendorContract(parsedData).then(text => {
              setContractText(text);
              setAppStatus('SIGNING');
            });
          }
        } catch (e) {
          console.error("Invalid data", e);
        }
      }
    }
  }, []);

  const handleSubmit = async () => {
    setAppStatus('GENERATING');
    setError(null);
    setContractText(null);

    try {
      // 1. Generate Contract Text
      const result = await generateVendorContract(formData);
      setContractText(result);

      // 2. Send Data to Backend (creates contract in Google Sheets + triggers email)
      setAppStatus('SENDING');
      try {
        await sendVendorData(formData);
        setEmailDeliveryStatus('SUCCESS');
      } catch (emailErr) {
        console.warn("Webhook send failed", emailErr);
        setEmailDeliveryStatus('FAILED');
      }

      setAppStatus('SENT');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong.");
      setAppStatus('IDLE');
    }
  };

  const handleReset = () => {
    window.history.pushState({}, '', window.location.pathname);
    setContractText(null);
    setFormData(INITIAL_FORM_DATA);
    setAppStatus('IDLE');
    setEmailDeliveryStatus(null);
  };

  const handleSignStart = () => {
    setAppStatus('SIGNING');
  };

  const handleSignComplete = async (signature: string) => {
    if (!contractText) return;

    try {
      setAppStatus('SENDING');

      const activeContractId = currentContractId || ("vendor_sub_" + Date.now().toString(36));
      console.log(`[App] 📝 Signing contract with ID: ${activeContractId}`);

      // Call Backend to handle everything (PDF, Drive, Email)
      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contractsigining.onrender.com';
      const backendUrl = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

      const response = await fetch(`${backendUrl}/api/contracts/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: activeContractId,
          signatureImageBase64: signature,
          contractData: {
            vendorDetails: formData,
            text: contractText,
            content: contractText
          }
        })
      });

      const result = await response.json();

      if (result.quickbooks) {
        console.log(`[App] 🎉 QuickBooks Invoice Created: ${result.quickbooks.invoiceNumber}`);
        setQbInvoice(result.quickbooks);
      }

      setAppStatus('SIGNED');
    } catch (e) {
      console.error("Failed to process signed contract", e);
      setError("Failed to save signed contract on server.");
      setAppStatus('SIGNED');
    }
  };

  const getProcessingText = () => "Submitting...";

  const renderSentScreen = () => (
    <div className="bg-white p-12 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 min-h-[400px]">
      <div className="bg-green-50 p-6 rounded-full mb-6">
        <CheckCircle className="w-20 h-20 text-green-500" />
      </div>

      <h2 className="text-3xl font-bold text-slate-900 mb-4">Thank You!</h2>

      <p className="text-slate-600 text-lg max-w-lg mx-auto">
        Your vendor details have been submitted successfully.
      </p>
      <p className="text-slate-500 mt-2">
        We have received your information for <strong>{formData.companyName}</strong>.
      </p>

      <button
        onClick={handleReset}
        className="mt-8 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
      >
        Submit Another Response
      </button>
    </div>
  );

  const renderExpiredScreen = () => (
    <div className="bg-white p-12 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 min-h-[400px]">
      <div className="bg-red-50 p-6 rounded-full mb-6">
        <FileCheck className="w-20 h-20 text-red-500" />
      </div>

      <h2 className="text-3xl font-bold text-slate-900 mb-4">Link Expired</h2>

      <p className="text-slate-600 text-lg max-w-lg mx-auto">
        This secure signing link is no longer valid because the contract has already been signed or the session has expired.
      </p>
      <p className="text-slate-500 mt-2">
        If you need to make changes or sign a new agreement, please contact the organizer.
      </p>

      <button
        onClick={handleReset}
        className="mt-8 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
      >
        Return to Home
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-accent p-1.5 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Vendor Details</h1>
          </div>
          <div className="flex items-center gap-4">
            {appStatus === 'SIGNED' && (
              <span className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-200 text-xs font-medium">
                <FileCheck className="w-3 h-3" /> Contract Secured
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {appStatus === 'EXPIRED' ? renderExpiredScreen() :
          appStatus === 'SENT' ? renderSentScreen() : (
            appStatus === 'IDLE' || (appStatus === 'GENERATING' && !contractText) ? (
              <div className="max-w-3xl mx-auto">
                <VendorForm
                  data={formData}
                  onChange={setFormData}
                  onSubmit={handleSubmit}
                  isProcessing={appStatus === 'GENERATING'}
                  processingText={getProcessingText()}
                />
                {error && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                    <strong>Error:</strong> {error}
                  </div>
                )}
              </div>
            ) : (
              <ContractPreview
                contractText={contractText}
                status={appStatus}
                userEmail={formData.email}
                emailDeliveryStatus={emailDeliveryStatus}
                qbInvoice={qbInvoice}
                onSignStart={handleSignStart}
                onSignComplete={handleSignComplete}
                onReset={handleReset}
              />
            )
          )}
      </main>
    </div>
  );
};

export default App;