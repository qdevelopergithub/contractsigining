import React, { useState, useEffect } from 'react';
import VendorForm from './components/VendorForm';
import ContractPreview from './components/ContractPreview';
import { VendorFormData, INITIAL_FORM_DATA, AppStatus, BoothSize, PaymentMode } from './types';
import { generateVendorContract } from './services/geminiService';
import { sendVendorData } from './services/emailService';
import { Sparkles, FileCheck, CheckCircle, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [formData, setFormData] = useState<VendorFormData>(INITIAL_FORM_DATA);
  const [contractText, setContractText] = useState<string | null>(null);
  const [appStatus, setAppStatus] = useState<AppStatus>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState<'SUCCESS' | 'FAILED' | null>(null);
  const [currentContractId, setCurrentContractId] = useState<string | null>(null);
  const [qbInvoice, setQbInvoice] = useState<{ id: string; invoiceNumber: string; customerName: string } | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{ contractId: string; totalAmount: number } | null>(null);

  // Keep legacy hash checking if needed, but primary flow is now direct submission
  useEffect(() => {
    const hash = window.location.hash;

    // 1. Handle NEW Magic Links (#/contract/ID)
    if (hash && hash.startsWith('#/contract/')) {
      const contractId = hash.slice('#/contract/'.length);
      setCurrentContractId(contractId);
      console.log(`[App] Loading contract from server: ${contractId}`);

      setAppStatus('GENERATING');
      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
      const backendUrl = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

      fetch(`${backendUrl}/api/contracts/${contractId}`)
        .then(res => {
          if (res.status === 410) {
            setAppStatus('EXPIRED');
            setError("This secure signing link has expired because the contract is already signed.");
            return null;
          }
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
            const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
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
  const calcBasePrice = (boothSize: BoothSize | string, customBoothSize?: string): number => {
    const fixtureMatch = boothSize.match(/\((\d+)\s+Fixtures\)/i);
    const totalFixtures = boothSize === BoothSize.CUSTOM_LARGE
      ? (parseFloat(customBoothSize || '0') || 0)
      : (fixtureMatch ? parseInt(fixtureMatch[1]) : 4);

    if (boothSize === BoothSize.ACCESSORY_TWO)     return 4500;
    if (boothSize === BoothSize.ACCESSORY_THREE)   return 6500;
    if (boothSize === BoothSize.ONE_STANDARD)      return 8000;
    if (boothSize === BoothSize.ONE_HALF_STANDARD) return 12000;
    if (boothSize === BoothSize.TWO_STANDARD)      return 16000;
    if (boothSize === BoothSize.TWO_HALF_STANDARD) return 20000;
    if (totalFixtures > 10) return 20000 + (Math.floor((totalFixtures - 10) / 2) * 4000);
    if (boothSize === BoothSize.CUSTOM_LARGE)      return totalFixtures * 2000;
    return 0;
  };

  const handleSubmit = async () => {
    setAppStatus('GENERATING');
    setError(null);
    setContractText(null);

    try {
      setAppStatus('SENDING');

      // Calculate pricing amounts to save to sheet
      const baseAmount = calcBasePrice(formData.boothSize, formData.customBoothSize);
      const ccFee = formData.paymentMode === PaymentMode.CREDIT_CARD
        ? parseFloat((baseAmount * 0.0299).toFixed(2))
        : 0;
      const totalAmount = parseFloat((baseAmount + ccFee).toFixed(2));

      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "https://contract-genius-backend-93t6.onrender.com";
      const BACKEND_URL = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

      const response = await fetch(`${BACKEND_URL}/api/contracts/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          companyName: formData.companyName,
          contacts: formData.contacts,
          brands: formData.brands,
          address: formData.address,
          boothSize: formData.boothSize,
          customBoothSize: formData.customBoothSize,
          customBoothRequirements: formData.customBoothRequirements,
          selectedFixtures: formData.selectedFixtures,
          categories: formData.categories,
          otherCategory: formData.otherCategory,
          paymentMode: formData.paymentMode,
          notes: formData.notes,
          baseAmount,
          ccFee,
          totalAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      const result = await response.json();
      setSubmissionResult({
        contractId: result.contractId,
        totalAmount: result.totalAmount ?? totalAmount
      });
      setCurrentContractId(result.contractId);
      setEmailDeliveryStatus('SUCCESS');
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
      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
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
    <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500 max-w-2xl mx-auto">
      <div className="bg-green-50 p-6 rounded-full mb-8 ring-8 ring-green-50/50">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>

      <h2 className="text-4xl font-black text-slate-900 mb-2">Submission Successful!</h2>
      <p className="text-slate-500 mb-8 font-medium">Your contract has been generated and inventory secured.</p>

      <div className="w-full bg-slate-50 rounded-2xl p-6 border border-slate-200 text-left space-y-4 mb-8">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contract ID</span>
          <span className="text-sm font-mono font-bold text-accent bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{submissionResult?.contractId}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Booth Size</span>
            <p className="text-slate-700 font-bold text-sm leading-tight">{formData.boothSize}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Payment Mode</span>
            <p className="text-slate-700 font-bold text-sm">{formData.paymentMode}</p>
          </div>
        </div>

        <div className="pt-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fixtures Booked</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {formData.selectedFixtures.map((f, i) => (
              <span key={i} className="text-[11px] font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-600">
                {f.type} ×{f.quantity}
              </span>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
          <span className="font-bold text-slate-900">Total Charged</span>
          <span className="text-2xl font-black text-slate-900">${(submissionResult?.totalAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <button
          onClick={handleReset}
          className="px-8 py-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold shadow-lg hover:shadow-xl active:scale-95"
        >
          Submit Another Response
        </button>
      </div>
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
        {appStatus === 'GENERATING' || appStatus === 'SENDING' ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-14 h-14 text-accent animate-spin" />
            <p className="text-slate-600 font-medium text-lg">Submitting your details...</p>
          </div>
        ) : appStatus === 'EXPIRED' ? renderExpiredScreen() :
          appStatus === 'SENT' ? renderSentScreen() : (
            appStatus === 'IDLE' ? (
              <div className="max-w-3xl mx-auto">
                <VendorForm
                  data={formData}
                  onChange={setFormData}
                  onSubmit={handleSubmit}
                  isProcessing={false}
                  processingText={getProcessingText()}
                />
                
                {/* Error Popup Modal */}
                {error && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-8 relative animate-in zoom-in slide-in-from-bottom-4 duration-300">
                      <button 
                        onClick={() => setError(null)}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-red-50">
                          <X className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Submission Failed</h3>
                        <p className="text-slate-600 mb-6">{error}</p>
                        <button
                          onClick={() => setError(null)}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98]"
                        >
                          I Understand
                        </button>
                      </div>
                    </div>
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