import { Contract, VendorDetails } from "../types";

const STORAGE_KEY = 'contract_genius_db';

export const getContracts = (): Contract[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const getContractById = (id: string): Contract | undefined => {
  const contracts = getContracts();
  return contracts.find(c => c.id === id);
};

export const saveContract = (contract: Contract): void => {
  const contracts = getContracts();
  const existingIndex = contracts.findIndex(c => c.id === contract.id);
  
  if (existingIndex >= 0) {
    contracts[existingIndex] = contract;
  } else {
    contracts.push(contract);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
};

export const createContract = (details: VendorDetails, content: string): Contract => {
  const id = 'contract_' + Math.random().toString(36).substr(2, 9);
  const newContract: Contract = {
    id,
    vendorDetails: details,
    status: 'sent', // Automatically "sent" in this demo flow
    content,
    createdAt: Date.now(),
    magicLink: `${window.location.origin}${window.location.pathname}#/contract/${id}`
  };
  
  saveContract(newContract);
  return newContract;
};

export const signContract = (id: string, signatureBase64: string): Contract | null => {
  const contract = getContractById(id);
  if (!contract) return null;

  const updatedContract: Contract = {
    ...contract,
    status: 'signed',
    signedAt: Date.now(),
    signatureBase64
  };
  
  saveContract(updatedContract);
  return updatedContract;
};