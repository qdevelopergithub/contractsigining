/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import { VendorDetails, BrandInfo, ContactInfo } from '../types';
import { Sparkles, Send, Loader2, Settings, Copy, Check, Building2, FileCheck, ShoppingCart, Globe, Instagram, User, Mail, Phone, MapPin, FileText, Plus, LayoutGrid, Layers, Trash2, CheckSquare, Eye, X, CreditCard } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CreateContractForm: React.FC<Props> = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('gas_url') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewInfo, setPreviewInfo] = useState<{ url: string, name: string } | null>(null);
  const [inventory, setInventory] = useState<Array<{ fixtureName: string, available: number }>>([]);

  // Fetch Live Inventory on Mount
  React.useEffect(() => {
    const fetchInventory = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
        const res = await fetch(`${backendUrl}/api/inventory`);
        const data = await res.json();
        if (data.success) setInventory(data.inventory);
      } catch (e) {
        console.error('Failed to fetch inventory:', e);
      }
    };
    fetchInventory();
  }, []);

  const [formData, setFormData] = useState<VendorDetails & { baseAmount?: number; ccFee?: number; totalAmount?: number }>({
    exhibitorType: '',
    brands: [{ brandName: '', showroomName: '', website: '', instagram: '' }],
    company: '',
    contacts: [{ name: '', email: '', title: '' }],
    email: '',
    address: '',
    categories: [],
    otherCategory: '',
    boothSize: "1 Standard || (4 Fixtures)",
    finalBoothSize: "1 Standard || (4 Fixtures)",
    selectedFixtures: [{ type: 'Rolling Rack', quantity: 4 }],
    fixture: 'Rolling Rack',
    fixtureQuantity: 4,
    eventDate: new Date().toISOString().split('T')[0],
    specialRequirements: '',
    paymentMode: 'Credit Card',
    notes: '',
  });

  // PRICING CONFIGURATION (Editable placeholders)
  const PRICING = {
    BOOTH_BASE_PRICE: 1000, 
    CUSTOM_BOOTH_MULTIPLIER: 250, // Per custom fixture
    CC_FEE_PERCENTAGE: 0.0299 // 2.99%
  };

  const CATEGORY_OPTIONS = [
    'Resort', 'Men’s', 'Beauty / Body', 'Swim', 'Footwear',
    'Travel', 'Ready to Wear', 'Lounge', 'Accessories – Jewelry',
    'Accessories – Bags'
  ];

  const VALID_FIXTURES = [
    'Clothing Rail / Rack',
    'Rolling Rack',
    'Double Hang',
    'Rolling Rack with Shelves',
    'Accessory Table',
    'Accessory Shelf',
    '2 Accessory Shelves (Stacked)',
    'Fitting Screen'
  ];

  const FIXTURE_IMAGES: Record<string, string> = {
    'Rolling Rack': '/assets/fixtures/rolling_rack.png',
    'Double Hang': '/assets/fixtures/double_hang.png',
    'Rolling Rack with Shelves': '/assets/fixtures/rolling_rack_shelves.png',
    'Clothing Rail / Rack': '/assets/fixtures/rolling_rack.png',
    'Accessory Table': '/assets/fixtures/accessory_table.png',
    'Accessory Shelf': '/assets/fixtures/accessory_shelf.png',
    '2 Accessory Shelves (Stacked)': '/assets/fixtures/accessory_shelves_stacked.png',
    'Fitting Screen': '/assets/fixtures/fitting_screen.png',
  };

  const calculateTotalQuota = (size: string, customSize?: string): number => {
    if (size === "Custom Fixture" && customSize) {
      // Input is now treated as FIXTURE count
      return parseFloat(customSize) || 0;
    }
    const match = size.match(/\((\d+)\s+Fixtures\)/);
    if (match) return parseInt(match[1]);
    return 4;
  };

  const calculateFurniture = (fixtures: number) => {
    if (fixtures < 4) return { tables: 1, chairs: 2 };
    const tables = Math.floor(fixtures / 4);
    const chairs = tables * 3;
    return { tables, chairs };
  };

  const currentTotalFixtures = formData.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0);
  const totalQuota = calculateTotalQuota(formData.boothSize, formData.customBoothSize);

  // Live Pricing Calculation
  const getCalculatedPrices = () => {
    let base = 0;
    
    // Calculate Booth Base Cost
    if (formData.boothSize === "Custom Fixture") {
      base = totalQuota * PRICING.CUSTOM_BOOTH_MULTIPLIER;
    } else {
      // Estimate cost by parsing the standard booth multiplier
      const boothMatch = formData.boothSize.match(/([\d.]+)\s+Standard/);
      const multiplier = boothMatch ? parseFloat(boothMatch[1]) : 1;
      base = PRICING.BOOTH_BASE_PRICE * multiplier;
    }

    const ccFee = formData.paymentMode === 'Credit Card' ? base * PRICING.CC_FEE_PERCENTAGE : 0;
    const total = base + ccFee;

    return { base, ccFee, total };
  };
  
  const currentPrices = getCalculatedPrices();

  const handleBrandChange = (index: number, field: keyof BrandInfo, value: string) => {
    const newBrands = [...formData.brands];
    newBrands[index] = { ...newBrands[index], [field]: value };
    setFormData(prev => ({ ...prev, brands: newBrands }));

    const errorKey = field === 'brandName' ? `brandName_${index}` : field === 'website' ? `brandWebsite_${index}` : field === 'instagram' ? `brandInstagram_${index}` : '';
    if (errorKey && errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addBrandRow = () => {
    setFormData(prev => ({ ...prev, brands: [...prev.brands, { brandName: '', showroomName: '', website: '', instagram: '' }] }));
  };

  const removeBrandRow = (index: number) => {
    if (formData.brands.length > 1) {
      setFormData(prev => ({ ...prev, brands: prev.brands.filter((_, i) => i !== index) }));
    }
  };

  const handleContactChange = (index: number, field: keyof ContactInfo, value: string) => {
    const newContacts = [...formData.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };

    const updates: any = { contacts: newContacts };
    if (index === 0 && field === 'email') {
      updates.email = value;
    }
    setFormData(prev => ({ ...prev, ...updates }));

    const errorKey = field === 'phone' ? `contactPhone_${index}` : field === 'name' ? `contactName_${index}` : field === 'email' ? `contactEmail_${index}` : '';
    if (errorKey && errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addContactRow = () => {
    setFormData(prev => ({ ...prev, contacts: [...prev.contacts, { name: '', email: '', title: '' }] }));
  };

  const removeContactRow = (index: number) => {
    if (formData.contacts.length > 1) {
      setFormData(prev => ({ ...prev, contacts: prev.contacts.filter((_, i) => i !== index) }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newData: any = { ...formData, [name]: value };

    if (name === 'boothSize') {
      newData.finalBoothSize = value;
      newData.selectedFixtures = [{ type: 'Rolling Rack', quantity: 1 }];
    }

    setFormData(newData);
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const saveConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScriptUrl(e.target.value);
    localStorage.setItem('gas_url', e.target.value);
  }

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      alert("Link copied!");
    }
  }

  const handleFixtureChange = (index: number, field: string, value: any) => {
    const newFixtures = [...formData.selectedFixtures];
    if (field === 'type') {
      if (value === '2 Accessory Shelves (Stacked)') {
        newFixtures[index] = { ...newFixtures[index], type: value, quantity: 2 };
      } else {
        newFixtures[index] = { ...newFixtures[index], type: value, quantity: 1 };
      }
    } else if (field === 'quantity' && newFixtures[index].type === '2 Accessory Shelves (Stacked)') {
      newFixtures[index] = { ...newFixtures[index], [field]: Math.max(2, value) };
    } else {
      newFixtures[index] = { ...newFixtures[index], [field]: value };
    }
    setFormData(prev => ({ ...prev, selectedFixtures: newFixtures }));

    // Clear error
    const errorKey = field === 'quantity' || field === 'type' ? `fixtureQty_${index}` : '';
    if (errorKey && errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addFixtureRow = () => {
    setFormData(prev => ({
      ...prev,
      selectedFixtures: [...prev.selectedFixtures, { type: 'Rolling Rack', quantity: 1 }]
    }));
  };

  const removeFixtureRow = (index: number) => {
    if (formData.selectedFixtures.length > 1) {
      setFormData(prev => ({
        ...prev,
        selectedFixtures: prev.selectedFixtures.filter((_, i) => i !== index)
      }));
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter(c => c !== cat)
        : [...prev.categories, cat]
    }));
  };

  const validate = (): { isValid: boolean, currentErrors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.company?.trim()) newErrors.company = "Company Name is required";

    formData.brands.forEach((brand, idx) => {
      if (!brand.brandName?.trim()) newErrors[`brandName_${idx}`] = "Brand Name is required";
      if (!brand.website?.trim()) {
        newErrors[`brandWebsite_${idx}`] = "Website is required";
      } else if (!/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(brand.website)) {
        newErrors[`brandWebsite_${idx}`] = "Invalid Website URL";
      }
      if (!brand.instagram?.trim()) {
        newErrors[`brandInstagram_${idx}`] = "Instagram handle is required";
      } else if (!brand.instagram.startsWith('@')) {
        newErrors[`brandInstagram_${idx}`] = "Instagram handle must start with @";
      }
    });

    formData.contacts.forEach((contact, idx) => {
      const isPrimary = idx === 0;
      if (!contact.name?.trim()) newErrors[`contactName_${idx}`] = isPrimary ? "Primary Contact Name is required" : "Contact Name is required";

      // New Contact # validation: Required for primary, only digits, max 15
      if (isPrimary) {
        if (!contact.phone?.trim()) {
          newErrors[`contactPhone_${idx}`] = "Contact Number is required";
        } else {
          const digitsOnly = contact.phone.replace(/\D/g, '');
          if (!/^\d+$/.test(digitsOnly)) {
            newErrors[`contactPhone_${idx}`] = "Contact Number must contain only digits";
          } else if (digitsOnly.length > 15) {
            newErrors[`contactPhone_${idx}`] = "Contact must be up to 15 digits";
          }
        }
      }

      if (!contact.email?.trim()) {
        newErrors[`contactEmail_${idx}`] = "Email is required";
      } else if (!emailRegex.test(contact.email)) {
        newErrors[`contactEmail_${idx}`] = "Invalid email format";
      }
    });

    formData.selectedFixtures.forEach((fixture, idx) => {
      if (fixture.quantity < 0) {
        newErrors[`fixtureQty_${idx}`] = "Quantity cannot be negative";
      }
      // Check for leading zeros via input raw value check
      const input = document.getElementById(`fixtureQty_${idx}`) as HTMLInputElement;
      if (input && input.value.length > 1 && input.value.startsWith('0')) {
        newErrors[`fixtureQty_${idx}`] = "Leading zeros are not allowed. Please enter a valid number.";
      }
    });

    if (!formData.address?.trim()) newErrors.address = "Address is required";
    if (!formData.eventDate) newErrors.eventDate = "Event Date is required";

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, currentErrors: newErrors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, currentErrors } = validate();
    if (!isValid) {
      const firstError = Object.keys(currentErrors)[0];
      if (firstError) {
        // Try getting by ID first (for dynamic rows), then by name
        const element = document.getElementById(firstError) || document.getElementsByName(firstError)[0];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Short delay to ensure scroll finishes before focus
          setTimeout(() => element.focus(), 100);
        }
      }
      return;
    }

    setLoading(true);
    setGeneratedLink(null);

    try {
      // 1. Prepare contract data for backend
      const contractPayload = {
        // Exhibitor Info
        exhibitorType: formData.exhibitorType,
        brands: formData.brands,
        company: formData.company,

        // Contacts
        contacts: formData.contacts,
        name: formData.contacts[0]?.name || '', // Explicitly set name
        email: formData.contacts[0]?.email || formData.email,

        // Address & Categories
        address: formData.address,
        categories: formData.categories,
        otherCategory: formData.otherCategory,

        // Booth & Fixtures
        boothSize: formData.boothSize,
        finalBoothSize: formData.finalBoothSize,
        customBoothSize: formData.customBoothSize,
        customBoothRequirements: formData.customBoothRequirements,
        selectedFixtures: formData.selectedFixtures,
        fixture: formData.selectedFixtures[0]?.type || 'Display Counter (Large)',
        fixtureQuantity: currentTotalFixtures,

        // Event Details
        eventDate: formData.eventDate,
        specialRequirements: formData.specialRequirements,
        notes: formData.notes,
        paymentMode: formData.paymentMode,

        // Live Pricing Fields mapping to Contract
        baseAmount: currentPrices.base,
        ccFee: currentPrices.ccFee,
        totalAmount: currentPrices.total,
        depositAmount: 0 // Default 0 for now until deposit logic is required
      };

      // 2. Call backend to create contract and get ID
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://contract-genius-backend-93t6.onrender.com';
      const response = await fetch(`${backendUrl}/api/contracts/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contractPayload)
      });

      if (!response.ok) {
        throw new Error('Failed to create contract on server');
      }

      const result = await response.json();
      const contractId = result.contractId;
      const magicLink = result.magicLink;

      console.log(`[Frontend] ✅ Contract created: ${contractId}`);
      setGeneratedLink(magicLink);

      // 3. Trigger Email via Make.com Webhook (FIRE AND FORGET - Don't wait for it)
      const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";
      fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: "submit_vendor_data",
          submissionLink: magicLink,
          email: formData.email,
          contractId: contractId
        })
      }).catch(webhookError => console.error("Make.com Webhook Background Error:", webhookError));

      // 4. Navigate INSTANTLY to contract view
      navigate(`#/contract/${contractId}`);

    } catch (error) {
      console.error(error);
      alert("Failed to generate contract. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const inputClass = "w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all";
  const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400";
  const helperClass = "text-[10px] text-slate-400 mt-1 ml-1";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Vendor Contract</h1>
          <p className="text-gray-500">Fill in the details below and AI will draft the legal agreement.</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-gray-400 hover:text-indigo-600 transition"
          title="Configure Email Backend"
        >
          <Settings size={20} />
        </button>
      </div>

      {showConfig && (
        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 text-sm">
          <h3 className="font-semibold text-indigo-900 mb-2">Backend Configuration</h3>
          <label className="block text-indigo-800 mb-1">Google Apps Script Web App URL</label>
          <input
            type="text"
            value={scriptUrl}
            onChange={saveConfig}
            className="w-full px-3 py-2 border border-indigo-200 rounded text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 pb-20">
        {/* Exhibitor Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Exhibitor Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full">
              <label className={labelClass}>Exhibitor Type <span className="text-red-500">*</span></label>
              <div className="flex gap-6">
                {!formData.exhibitorType ? (
                  ['Brand', 'Multi-line showroom'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, exhibitorType: type }))}
                      className="flex-1 py-8 px-6 rounded-xl border-2 border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-3 group bg-white shadow-sm hover:shadow-md"
                    >
                      <div className="p-3 bg-slate-100 rounded-full group-hover:bg-indigo-100 transition-colors">
                        {type === 'Brand' ? (
                          <FileCheck className="w-8 h-8 text-slate-500 group-hover:text-indigo-600" />
                        ) : (
                          <Layers className="w-8 h-8 text-slate-500 group-hover:text-indigo-600" />
                        )}
                      </div>
                      <span className="font-bold text-lg text-slate-700 group-hover:text-indigo-600">{type}</span>
                    </button>
                  ))
                ) : (
                  <div className="flex items-center justify-between w-full p-6 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        {formData.exhibitorType === 'Brand' ? (
                          <FileCheck className="w-6 h-6 text-indigo-600" />
                        ) : (
                          <Layers className="w-6 h-6 text-indigo-600" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Selected Type</span>
                        <p className="text-lg font-bold text-gray-900">{formData.exhibitorType}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, exhibitorType: '' }))}
                      className="text-sm font-semibold text-gray-500 hover:text-red-500 px-4 py-2 hover:bg-white/50 rounded-lg transition-all"
                    >
                      Change Selection
                    </button>
                  </div>
                )}
              </div>
            </div>

            {formData.exhibitorType && (
              <>
                <div className="md:col-span-2">
                  <label className={labelClass}>
                    {formData.exhibitorType === 'Multi-line showroom' ? 'Showroom Name' : 'Company Name'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className={iconClass} />
                    <input
                      name="company"
                      className={`${inputClass} ${errors.company ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                      value={formData.company}
                      onChange={(e) => {
                        handleChange(e);
                        if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                      }}
                      placeholder={formData.exhibitorType === 'Multi-line showroom' ? "Showroom Name" : "Acme Corp"}
                      id="company"
                    />
                  </div>
                  {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
                </div>

                <div className="col-span-full space-y-6">
                  {formData.brands.map((brand, idx) => (
                    <div key={idx} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 space-y-4 relative group">
                      {formData.brands.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBrandRow(idx)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Brand Details {formData.brands.length > 1 ? `#${idx + 1}` : ''}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={formData.exhibitorType === 'Multi-line showroom' ? 'col-span-2' : ''}>
                          <label className={labelClass}>Brand Name <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <FileCheck className={iconClass} />
                            <input
                              type="text"
                              value={brand.brandName}
                              onChange={(e) => {
                                handleBrandChange(idx, 'brandName', e.target.value);
                                if (errors[`brandName_${idx}`]) setErrors(prev => ({ ...prev, [`brandName_${idx}`]: '' }));
                              }}
                              className={`${inputClass} ${errors[`brandName_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                              placeholder="Brand Identity"
                              id={`brandName_${idx}`}
                            />
                          </div>
                          {errors[`brandName_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`brandName_${idx}`]}</p>}
                        </div>

                        {formData.exhibitorType !== 'Multi-line showroom' && (
                          <div>
                            <label className={labelClass}>Showroom Name</label>
                            <div className="relative">
                              <ShoppingCart className={iconClass} />
                              <input
                                type="text"
                                value={brand.showroomName}
                                onChange={(e) => handleBrandChange(idx, 'showroomName', e.target.value)}
                                className={inputClass}
                                placeholder="Showroom 123"
                              />
                            </div>
                          </div>
                        )}
                        <div>
                          <label className={labelClass}>Website <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Globe className={iconClass} />
                            <input
                              type="url"
                              value={brand.website}
                              onChange={(e) => {
                                handleBrandChange(idx, 'website', e.target.value);
                                if (errors[`brandWebsite_${idx}`]) setErrors(prev => ({ ...prev, [`brandWebsite_${idx}`]: '' }));
                              }}
                              className={`${inputClass} ${errors[`brandWebsite_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                              placeholder="https://www.company.com"
                              id={`brandWebsite_${idx}`}
                            />
                          </div>
                          {errors[`brandWebsite_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`brandWebsite_${idx}`]}</p>}
                        </div>
                        <div>
                          <label className={labelClass}>Instagram <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Instagram className={iconClass} />
                            <input
                              type="text"
                              value={brand.instagram}
                              onChange={(e) => {
                                handleBrandChange(idx, 'instagram', e.target.value);
                                if (errors[`brandInstagram_${idx}`]) setErrors(prev => ({ ...prev, [`brandInstagram_${idx}`]: '' }));
                              }}
                              className={`${inputClass} ${errors[`brandInstagram_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                              placeholder="@username"
                              id={`brandInstagram_${idx}`}
                            />
                          </div>
                          {errors[`brandInstagram_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`brandInstagram_${idx}`]}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addBrandRow}
                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs font-medium hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Add Another Brand
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {formData.exhibitorType && (
          <>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Contact Details</h2>
              <div className="space-y-6">
                {formData.contacts.map((contact, idx) => (
                  <div key={idx} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 space-y-4 relative group">
                    {formData.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContactRow(idx)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contact {formData.contacts.length > 1 ? `#${idx + 1}` : ''}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={idx === 0 ? "" : "md:col-span-2"}>
                        <label className={labelClass}>{idx === 0 ? 'Primary Contact Name' : 'Contact Name'} <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <User className={iconClass} />
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => {
                              handleContactChange(idx, 'name', e.target.value);
                              if (errors[`contactName_${idx}`]) setErrors(prev => ({ ...prev, [`contactName_${idx}`]: '' }));
                            }}
                            className={`${inputClass} ${errors[`contactName_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                            placeholder="John Doe"
                            id={`contactName_${idx}`}
                          />
                        </div>
                        {errors[`contactName_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`contactName_${idx}`]}</p>}
                      </div>

                      {idx === 0 && (
                        <div>
                          <label className={labelClass}>Contact # <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <Phone className={iconClass} />
                            <input
                              type="text"
                              maxLength={15}
                              value={contact.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val !== '' && !/^\d+$/.test(val)) return; // Strictly only allow digits
                                handleContactChange(idx, 'phone', val);
                                if (errors[`contactPhone_${idx}`]) setErrors(prev => ({ ...prev, [`contactPhone_${idx}`]: '' }));
                              }}
                              className={`${inputClass} ${errors[`contactPhone_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                              placeholder="1234567890"
                              id={`contactPhone_${idx}`}
                            />
                          </div>
                          {errors[`contactPhone_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`contactPhone_${idx}`]}</p>}
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className={labelClass}>Title</label>
                        <div className="relative">
                          <FileText className={iconClass} />
                          <input
                            type="text"
                            value={contact.title}
                            onChange={(e) => handleContactChange(idx, 'title', e.target.value)}
                            className={inputClass}
                            placeholder="Managing Director"
                          />
                        </div>
                      </div>

                      <div className="col-span-full">
                        <label className={labelClass}>Email Address <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <Mail className={iconClass} />
                          <input
                            type="email"
                            value={contact.email}
                            onChange={(e) => {
                              handleContactChange(idx, 'email', e.target.value);
                              if (errors[`contactEmail_${idx}`]) setErrors(prev => ({ ...prev, [`contactEmail_${idx}`]: '' }));
                            }}
                            className={`${inputClass} ${errors[`contactEmail_${idx}`] ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                            placeholder="john@company.com"
                            id={`contactEmail_${idx}`}
                          />
                        </div>
                        {errors[`contactEmail_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`contactEmail_${idx}`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addContactRow}
                  className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-xs font-medium hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-3 h-3" />
                  Add Another Contact
                </button>

                <div className="col-span-full">
                  <label className={labelClass}>Company Address <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea
                      name="address"
                      rows={2}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${errors.address ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'}`}
                      value={formData.address}
                      onChange={(e) => {
                        handleChange(e);
                        if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                      }}
                      placeholder="Street Address, City, State, ZIP, Country"
                      id="address"
                    />
                  </div>
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {CATEGORY_OPTIONS.map(cat => (
                  <label key={cat} className="flex items-center space-x-2 text-sm p-2 border rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.categories.includes(cat)} onChange={() => toggleCategory(cat)} />
                    <span>{cat}</span>
                  </label>
                ))}
                <div className="col-span-full mt-2">
                  <label className="flex items-center space-x-2 text-sm">
                    <input type="checkbox" checked={formData.categories.includes('Other')} onChange={() => toggleCategory('Other')} />
                    <span>Other:</span>
                    {formData.categories.includes('Other') && (
                      <input name="otherCategory" className="flex-1 border-b outline-none focus:border-indigo-500 text-sm" value={formData.otherCategory} onChange={handleChange} />
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Booth & Fixtures */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
              <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Booth & Fixture Selection</h2>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Booth Size</label>
                  <div className="relative">
                    <LayoutGrid className={iconClass} />
                    <select
                      name="boothSize"
                      className={inputClass + " appearance-none"}
                      value={formData.boothSize}
                      onChange={(e) => {
                        const size = e.target.value;
                        const qty = calculateTotalQuota(size, formData.customBoothSize);
                        let finalDesc = size;
                        let customSize = formData.customBoothSize;

                        if (size === "Custom Fixture") {
                          const boothCount = customSize || '0';
                          finalDesc = `${boothCount} Booth || (${qty} Fixtures)`;
                        } else {
                          // Reset custom size when switching to predefined
                          customSize = '';
                        }

                        // Reset fixtures to default state when booth size changes
                        const defaultFixture = { type: 'Rolling Rack', quantity: 4 }; // Default baseline
                        const newFixtures = [defaultFixture];

                        setFormData({ ...formData, boothSize: size, customBoothSize: customSize, finalBoothSize: finalDesc, selectedFixtures: newFixtures });
                      }}
                    >
                      {[
                        "1 Standard || (4 Fixtures)",
                        "1.5 Standard || (6 Fixtures)",
                        "2 Standard || (8 Fixtures)",
                        "2.5 Standard || (10 Fixtures)",
                        "3 Standard || (12 Fixtures)",
                        "Accessory Booth (2 Fixtures)",
                        "Accessory Booth (3 Fixtures)",
                        "Custom Fixture"
                      ].map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>

                  {formData.boothSize === "Custom Fixture" && (
                    <div className="grid grid-cols-1 gap-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className={labelClass}>Fixture Count</label>
                        <div className="relative">
                          <LayoutGrid className={iconClass} />
                          <input
                            name="customBoothSize"
                            className={inputClass}
                            maxLength={4}
                            value={formData.customBoothSize || ''}
                            onChange={(e) => {
                              const units = e.target.value.replace(/[^0-9.]/g, '');
                              const fixtureCount = parseFloat(units || '0') || 0;
                              const boothCount = fixtureCount / 4;
                              const finalDesc = `${boothCount} Booth || (${fixtureCount} Fixtures)`;
                              const newFixtures = [...formData.selectedFixtures];
                              if (newFixtures.length === 1) newFixtures[0].quantity = 1;
                              setFormData({ ...formData, customBoothSize: units, finalBoothSize: finalDesc, selectedFixtures: newFixtures });
                            }}
                            placeholder="e.g. 4"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-gray-500">
                    <span>Fixtures ({currentTotalFixtures} / {totalQuota})</span>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between text-indigo-700">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Standard Furniture Allotment:</span>
                    </div>
                    <div className="text-xs font-mono font-bold bg-white px-2 py-1 rounded shadow-sm">
                      {calculateFurniture(totalQuota).tables} Table(s) & {calculateFurniture(totalQuota).chairs} Chairs
                    </div>
                  </div>
                  {formData.selectedFixtures.map((fix, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1 relative">
                        <select
                          className="w-full px-3 pr-14 py-1.5 border rounded text-sm appearance-none"
                          value={fix.type}
                          onChange={(e) => handleFixtureChange(idx, 'type', e.target.value)}
                        >
                          {VALID_FIXTURES
                            .map(type => {
                              const invItem = inventory.find(i => i.fixtureName.toLowerCase() === type.toLowerCase());
                              const isSoldOut = invItem && invItem.available <= 0;
                              return (
                                <option 
                                  key={type} 
                                  value={type} 
                                  disabled={isSoldOut && fix.type !== type}
                                >
                                  {type} {isSoldOut ? '(SOLD OUT)' : invItem ? `(${invItem.available} left)` : ''}
                                </option>
                              );
                            })}
                        </select>
                        {FIXTURE_IMAGES[fix.type] && (
                          <button
                            type="button"
                            onClick={() => setPreviewInfo({ url: FIXTURE_IMAGES[fix.type], name: fix.type })}
                            className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                            title="Preview Image"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <input
                          type="number"
                          id={`fixtureQty_${idx}`}
                          className="w-20 px-3 py-1.5 border rounded text-sm"
                          value={fix.quantity}
                          max={999}
                          min={fix.type === '2 Accessory Shelves (Stacked)' ? 2 : 0}
                          onInput={(e) => {
                            if (e.currentTarget.value.length > 3) {
                              e.currentTarget.value = e.currentTarget.value.slice(0, 3);
                            }
                          }}
                          onChange={(e) => handleFixtureChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                        />
                        {errors[`fixtureQty_${idx}`] && <p className="text-red-500 text-[10px] mt-0.5 whitespace-nowrap">{errors[`fixtureQty_${idx}`]}</p>}
                      </div>
                      {formData.selectedFixtures.length > 1 && (
                        <button type="button" onClick={() => removeFixtureRow(idx)} className="text-red-500 p-1">×</button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addFixtureRow}
                    className="w-full py-1.5 border-2 border-dashed rounded text-xs text-gray-400 hover:text-indigo-500 hover:border-indigo-500 transition"
                  >
                    + Add Another Fixture Type
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Event Date <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <FileText className={iconClass} />
                      <input
                        type="date"
                        name="eventDate"
                        className={`${inputClass} ${errors.eventDate ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                        value={formData.eventDate}
                        onChange={(e) => {
                          handleChange(e);
                          if (errors.eventDate) setErrors(prev => ({ ...prev, eventDate: '' }));
                        }}
                        id="eventDate"
                      />
                    </div>
                    {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Final Confirmation (Editable)</label>
                    <div className="relative">
                      <Check className={iconClass} />
                      <input name="finalBoothSize" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-slate-50" value={formData.finalBoothSize} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                {/* Additional Notes moved here */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Additional Requests
                  </h3>
                  <textarea
                    name="notes"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                    value={formData.notes || ''}
                    onChange={handleChange}
                    placeholder="PLEASE NOTE ANY REQUESTS YOU MAY HAVE FOR YOUR BOOTH (ADJACENCIES, FIXTURES, ETC.) LIST ANY SHOWROOMS/ OR AGENCIES YOU NEED TO BE PLACED NEAR. WE WILL TRY OUR BEST TO ACCOMODATE :"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Payment Mode</label>
                    <div className="relative">
                      <CreditCard className={iconClass} />
                      <select
                        name="paymentMode"
                        className={inputClass + " appearance-none"}
                        value={formData.paymentMode}
                        onChange={handleChange}
                      >
                        {['Credit Card', 'Wire Transfer', 'Check', 'Other'].map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Pricing Order Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <h2 className="text-lg font-bold text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Live Order Summary
              </h2>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <span>Booth Allocation ({formData.finalBoothSize})</span>
                  <span className="font-medium">${currentPrices.base.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
                
                {formData.paymentMode === 'Credit Card' && (
                  <div className="flex justify-between items-center text-sm text-amber-600">
                    <span>Credit Card Processing Fee (2.99%)</span>
                    <span className="font-medium">${currentPrices.ccFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                
                <div className="pt-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 -mx-6 px-6 py-4 mt-2">
                  <span className="text-base font-bold text-gray-900">Total Estimated Cost</span>
                  <span className="text-xl font-bold text-indigo-700">
                    ${currentPrices.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  *This total will be reflected directly on your final contract draft.
                </p>
              </div>
            </div>

            <div className="pt-4 sticky bottom-6 z-10">
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex items-center justify-center space-x-2 py-4 rounded-xl text-white font-bold transition shadow-xl ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {loading ? <Loader2 className="animate-spin" /> : <Send />}
                <span>{loading ? 'Processing...' : 'GENERATE & SEND CONTRACT'}</span>
              </button>
            </div>
          </>
        )}
      </form>
      {/* Fixture Preview Modal */}
      {
        previewInfo && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPreviewInfo(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative animate-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewInfo(null)}
                className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-white rounded-full text-slate-500 hover:text-red-500 shadow-sm transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="p-1 bg-slate-50">
                <img src={previewInfo.url} alt={previewInfo.name} className="w-full h-auto object-contain max-h-[70vh] rounded-xl" />
              </div>
              <div className="p-4 text-center border-t">
                <p className="text-sm font-bold text-slate-900">{previewInfo.name}</p>
                <p className="text-xs text-slate-500">Standard design configuration</p>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};