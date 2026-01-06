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

  // Keep legacy hash checking if needed, but primary flow is now direct submission
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#data=')) {
      const encodedData = hash.replace('#data=', '');
      if (encodedData) {
        try {
          const decodedJson = atob(encodedData);
          const parsedData = JSON.parse(decodedJson) as VendorFormData;
          setFormData(parsedData);
          setAppStatus('GENERATING');
          generateVendorContract(parsedData).then(text => {
            setContractText(text);
            setAppStatus('SIGNING');
          });
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
      // 1. Generate Contract Text (Optional: keep if you want to ensure validity)
      const result = await generateVendorContract(formData);
      setContractText(result);

      // 2. Send Data to Make.com Webhook
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

      // Call Backend to handle everything (PDF, Drive, Email)
      const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const backendUrl = rawBackendUrl.startsWith('http') ? rawBackendUrl : `https://${rawBackendUrl}`;

      await fetch(`${backendUrl}/api/contracts/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: "vendor_sub_" + Date.now().toString(36), // Temporary ID for direct submissions
          signatureImageBase64: signature,
          contractData: {
            vendorDetails: formData,
            text: contractText,
            content: contractText
          }
        })
      });

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
        {appStatus === 'SENT' ? renderSentScreen() : (
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