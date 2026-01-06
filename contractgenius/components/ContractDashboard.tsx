/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useEffect, useState } from 'react';
import { Contract } from '../types';
import { getContracts } from '../services/storage';
import { FileText, CheckCircle, Clock, ExternalLink } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const ContractDashboard: React.FC<Props> = ({ navigate }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    // Reload contracts every time we visit the dashboard to ensure status is up to date
    setContracts(getContracts().reverse());
  }, []);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert("Magic Link copied to clipboard! In a real scenario, this link is emailed to the vendor.");
  };

  return (
    <div className="space-y-8">
      
      <div className="flex justify-between items-center pt-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">Contract Dashboard</h1>
            <p className="text-gray-500">Track status and manage agreements.</p>
        </div>
        <button
          onClick={() => navigate('#/new')}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition shadow-sm flex items-center space-x-2"
        >
          <FileText size={18} />
          <span>Draft New Contract</span>
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-gray-200">
          <div className="mx-auto bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <FileText className="text-gray-400 w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No contracts yet</h3>
          <p className="text-gray-500 mt-1 mb-6">Create your first AI-generated vendor contract.</p>
          <button
            onClick={() => navigate('#/new')}
            className="text-indigo-600 font-medium hover:text-indigo-700"
          >
            Get Started &rarr;
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-300 transition group">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition">{contract.vendorDetails.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border tracking-wide ${
                    contract.status === 'signed' 
                      ? 'bg-green-100 text-green-700 border-green-200' 
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                  }`}>
                    {contract.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{contract.vendorDetails.company} • {contract.vendorDetails.boothType} Booth</p>
                <div className="text-xs text-gray-400 mt-2 flex items-center space-x-4">
                  <span className="flex items-center space-x-1"><Clock size={12}/> <span>Created: {new Date(contract.createdAt).toLocaleDateString()}</span></span>
                  {contract.status === 'signed' && (
                    <span className="flex items-center space-x-1 text-green-600 font-medium"><CheckCircle size={12}/> <span>Signed on {contract.signedAt ? new Date(contract.signedAt).toLocaleDateString() : ''}</span></span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3 w-full md:w-auto">
                <button
                  onClick={() => navigate(`#/contract/${contract.id}`)}
                  className="flex-1 md:flex-none bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition border border-gray-200"
                >
                  View Document
                </button>
                <button
                  onClick={() => copyLink(contract.magicLink)}
                  className="flex-1 md:flex-none border border-indigo-100 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center space-x-2"
                  title="Copy Link to Send to Vendor"
                >
                  <ExternalLink size={16} />
                  <span>Copy Link</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};