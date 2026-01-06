
import React from 'react';
import { ScrollText } from 'lucide-react';

interface NavbarProps {
  currentRoute: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, navigate }) => {
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-center md:justify-start items-center h-16">
          <div className="flex items-center space-x-2">
            <ScrollText className="w-8 h-8 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">ContractGenius</span>
          </div>
          {/* No Navigation Menu - Vendor Portal Mode */}
        </div>
      </div>
    </nav>
  );
};