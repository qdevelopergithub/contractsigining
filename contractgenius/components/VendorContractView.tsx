
import React, { useEffect, useState, useRef } from 'react';
import { Contract } from '../types';
import { getContractById, signContract } from '../services/storage';
import { generateSignedPDF } from '../utils/pdfGenerator';
import { Check, Download, PenTool, Loader2, AlertCircle, Lock } from 'lucide-react';

interface Props {
    contractId: string;
    navigate: (path: string) => void;
}

export const VendorContractView: React.FC<Props> = ({ contractId, navigate }) => {
    const [contract, setContract] = useState<Contract | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [justSigned, setJustSigned] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // 1. Load Contract Data
    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => {
            const data = getContractById(contractId);
            if (data) {
                setContract(data);
            }
            setLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [contractId]);

    // 2. Generate PDF Preview when contract loads or updates
    useEffect(() => {
        const genPdf = async () => {
            if (!contract) return;
            try {
                // Generate PDF (unsigned or signed)
                const pdfBytes = await generateSignedPDF(contract);
                const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                setPdfPreviewUrl(url);
            } catch (e) {
                console.error("Failed to generate PDF preview", e);
            }
        };
        genPdf();

        // Cleanup blob URL to avoid leaks
        return () => {
            if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        };
    }, [contract]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSign = async () => {
        if (!canvasRef.current || !contract) return;
        setProcessing(true);
        try {
            const signatureBase64 = canvasRef.current.toDataURL('image/png');

            // Call the backend API for signing, PDF generation, and Drive upload
            const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const response = await fetch(`${backendUrl}/api/contracts/sign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contractId: contractId,
                    signatureImageBase64: signatureBase64,
                    contractData: contract // Send the contract data in case server doesn't have it
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to sign contract on server');
            }

            const result = await response.json();
            console.log("Server response:", result);

            // Update local state
            const updated = signContract(contractId, signatureBase64);
            if (updated) {
                setContract(updated);
                setJustSigned(true);
            }
        } catch (e: any) {
            console.error(e);
            alert("Error saving signature: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const downloadPdf = () => {
        if (!pdfPreviewUrl) return;
        const link = document.createElement('a');
        link.href = pdfPreviewUrl;
        link.download = `Signed_Contract_${contractId}.pdf`;
        link.click();
    }

    if (loading) {
        return <div className="min-h-screen flex flex-col items-center justify-center text-gray-500"><Loader2 className="animate-spin mb-4 text-indigo-600 w-10 h-10" />Fetching document secure data...</div>;
    }

    if (!contract) {
        return (
            <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-red-100 text-center">
                <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-red-500 w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Document Unavailable</h2>
                <p className="text-gray-500 mb-6">
                    We could not load the contract (ID: <span className="font-mono text-xs">{contractId}</span>).
                </p>
            </div>
        );
    }

    // --- SUCCESS SCREEN ---
    if (justSigned || (contract.status === 'signed' && !loading && !processing)) {
        return (
            <div className="max-w-xl mx-auto mt-12 bg-white p-12 rounded-2xl shadow-xl border border-indigo-50 text-center animate-fade-in">
                <div className="bg-green-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-green-50">
                    <Check className="text-green-600 w-12 h-12" strokeWidth={3} />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">Contract Signed Successfully</h1>
                <p className="text-gray-500 mb-10 text-lg leading-relaxed">
                    Thank you, <span className="font-semibold text-gray-900">{contract.vendorDetails.name}</span>. <br />
                    The document has been finalized.
                </p>

                <div className="space-y-4 max-w-xs mx-auto">
                    <button
                        onClick={downloadPdf}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center justify-center group"
                    >
                        <Download className="mr-3 group-hover:scale-110 transition-transform" />
                        Download PDF
                    </button>
                    <p className="text-xs text-gray-400 mt-4">
                        Your copy is ready for download.
                    </p>
                </div>
            </div>
        )
    }

    // --- MAIN VIEW WITH PDF PREVIEW ---
    return (
        <div className="max-w-6xl mx-auto pb-20">

            {/* Header */}
            <div className="mb-6 flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl shadow-md">
                <div className="flex items-center font-medium">
                    <Lock size={18} className="mr-2 text-green-400" />
                    <span>Secure Signing Session</span>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                    {new Date().toLocaleDateString()}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-[85vh]">

                {/* PDF Previewer */}
                <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-300 relative">
                    {!pdfPreviewUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <Loader2 className="animate-spin mr-2" /> Generating PDF Preview...
                        </div>
                    ) : (
                        <iframe
                            src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                            className="w-full h-full"
                            title="Contract Preview"
                        />
                    )}
                </div>

                {/* Sidebar Controls */}
                <div className="w-full lg:w-96 flex flex-col gap-6">

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xl flex-shrink-0">
                        <h3 className="text-lg font-bold mb-2 flex items-center text-gray-900">
                            <PenTool className="mr-2 text-indigo-600" />
                            Sign Here
                        </h3>
                        <p className="text-sm mb-6 text-gray-600">
                            Review the PDF on the left. Draw your signature below to accept the agreement.
                        </p>

                        <div className="space-y-3">
                            <div className="bg-white border-2 border-dashed border-indigo-200 rounded-lg overflow-hidden touch-none relative hover:border-indigo-400 transition-colors">
                                <canvas
                                    ref={canvasRef}
                                    width={320}
                                    height={180}
                                    className="w-full h-44 cursor-crosshair bg-white"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                                {!isDrawing && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                                        <span className="text-gray-300 text-sm font-handwriting">Draw Signature</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={clearSignature}
                                    className="px-4 py-3 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 text-xs font-medium transition"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={handleSign}
                                    disabled={processing}
                                    className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 shadow-md flex justify-center items-center space-x-2 text-sm font-bold transition-all active:scale-95"
                                >
                                    {processing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    <span>Confirm & Sign</span>
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center leading-tight pt-2">
                                By signing, you agree to be bound by the terms in the PDF document.
                            </p>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800">
                        <strong>Tip:</strong> You can scroll through the document preview on the left to read all terms before signing.
                    </div>
                </div>

            </div>
        </div>
    );
};