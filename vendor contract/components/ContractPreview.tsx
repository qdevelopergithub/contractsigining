import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, CheckCircle, Mail, PenTool, ExternalLink } from 'lucide-react';
import { AppStatus } from '../types';
import SignatureCanvas from './SignatureCanvas';

interface ContractPreviewProps {
  contractText: string | null;
  status: AppStatus;
  userEmail: string;
  emailDeliveryStatus?: 'SUCCESS' | 'FAILED' | null;
  onSignStart: () => void;
  onSignComplete: (signature: string) => void;
  onReset: () => void;
}

const ContractPreview: React.FC<ContractPreviewProps> = ({ 
  contractText, 
  status, 
  userEmail,
  emailDeliveryStatus,
  onSignStart, 
  onSignComplete,
  onReset 
}) => {
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);

  const handleDownload = () => {
    if (!contractText) return;
    
    const blob = new Blob([contractText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Exhibition_Service_Agreement.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSignSubmit = () => {
    if (currentSignature) {
      setSignatureImage(currentSignature);
      onSignComplete(currentSignature);
    }
  };

  // 1. Email Sent View (Thank You Screen)
  if (status === 'SENT') {
    return (
      <div className="bg-white p-12 rounded-xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 min-h-[400px]">
        
        <div className="bg-green-50 p-6 rounded-full mb-6">
          <CheckCircle className="w-20 h-20 text-green-500" />
        </div>
        
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Thank You!</h2>
        
        <p className="text-slate-600 text-lg max-w-lg mx-auto">
          Your details have been submitted successfully.
        </p>
        <p className="text-slate-500 mt-2">
          An email has been sent to <strong>{userEmail}</strong> with the agreement for your signature.
        </p>
      </div>
    );
  }

  // 2. Signing Interface (User View)
  if (status === 'SIGNING') {
    return (
      <div className="flex flex-col h-full bg-slate-100 rounded-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md z-10">
           <h3 className="font-semibold flex items-center gap-2">
             <PenTool className="w-4 h-4" />
             Review & Sign
           </h3>
           <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">Secure Document</span>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-grow p-4 md:p-8 overflow-y-auto">
           <div className="max-w-3xl mx-auto bg-white shadow-xl border border-slate-200 min-h-[800px] p-8 md:p-12 relative">
              
              {/* Document Content */}
              <div className="prose prose-slate max-w-none">
                 <ReactMarkdown>{contractText || ''}</ReactMarkdown>
              </div>

              {/* Signature Area (Editable) */}
              <div className="mt-12 p-6 bg-blue-50 border-2 border-dashed border-blue-200 rounded-lg break-inside-avoid">
                 <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                   <PenTool className="w-5 h-5 text-accent" />
                   Sign Here
                 </h4>
                 <p className="text-sm text-slate-600 mb-4">Please draw your signature in the box below to execute this agreement.</p>
                 
                 <div className="bg-white shadow-sm rounded-lg">
                    <SignatureCanvas onEnd={setCurrentSignature} />
                 </div>
                 
                 <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleSignSubmit}
                      disabled={!currentSignature}
                      className={`py-2 px-6 rounded-lg font-bold shadow-sm transition-all text-sm
                        ${currentSignature 
                          ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md transform active:scale-95' 
                          : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                      Apply Signature
                    </button>
                 </div>
              </div>
              
              {/* Footer Mockup */}
              <div className="mt-16 pt-8 border-t border-slate-100 text-center text-xs text-slate-300 font-mono">
                DOCUMENT ID: {Math.random().toString(36).substr(2, 9).toUpperCase()} • PAGE 1 OF 1
              </div>
           </div>
        </div>
      </div>
    );
  }

  // 3. Signed & Completed View
  if (status === 'SIGNED') {
    return (
      <div className="h-full flex flex-col bg-white rounded-xl shadow-lg border border-slate-200 animate-in fade-in duration-500">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-green-50 rounded-t-xl">
           <div className="flex items-center gap-2 text-green-800 font-bold">
              <CheckCircle className="w-5 h-5" />
              Contract Signed Successfully
           </div>
        </div>

        <div className="flex-grow p-8 overflow-y-auto bg-slate-50">
           <div className="max-w-3xl prose prose-slate bg-white p-8 md:p-12 shadow-sm border border-slate-100 mx-auto">
              <ReactMarkdown>{contractText || ''}</ReactMarkdown>
              
              {/* Render Signature on Document */}
              <div className="mt-12 pt-8 border-t-2 border-slate-800 grid grid-cols-2 gap-8">
                 <div>
                    <p className="font-bold text-sm uppercase tracking-wider mb-4">Vendor Signature</p>
                    {signatureImage && (
                      <div className="relative w-48 h-24">
                        <img src={signatureImage} alt="Vendor Signature" className="absolute -top-6 left-0 w-full h-full object-contain mix-blend-multiply" />
                        <div className="absolute bottom-0 left-0 w-full h-px bg-black"></div>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-2">Signed Digitally: {new Date().toLocaleString()}</p>
                 </div>
                 <div>
                    <p className="font-bold text-sm uppercase tracking-wider mb-4">Organizer Signature</p>
                    <div className="h-24 w-48 border-b border-slate-300 flex items-end">
                       <span className="text-slate-300 text-sm pb-2 italic">Pending Counter-Signature</span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ContractPreview;