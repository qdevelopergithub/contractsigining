/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import { VendorDetails, BrandInfo, ContactInfo } from '../types';
import { generateContractDraft } from '../services/gemini';
import { createContract } from '../services/storage';
import { Sparkles, Send, Loader2, Settings, Copy, Check, Building2, FileCheck, ShoppingCart, Globe, Instagram, User, Mail, Phone, MapPin, FileText, Plus, LayoutGrid, Layers, Trash2 } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CreateContractForm: React.FC<Props> = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('gas_url') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<VendorDetails>({
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
    selectedFixtures: [{ type: 'Display Counter (Large)', quantity: 4 }],
    fixture: 'Display Counter (Large)',
    fixtureQuantity: 4,
    eventDate: new Date().toISOString().split('T')[0],
    specialRequirements: '',
  });

  const COUNTRY_CODES = [
    { code: '+1', label: 'US (+1)', length: 10 },
    { code: '+44', label: 'UK (+44)', length: 10 },
    { code: '+91', label: 'IN (+91)', length: 10 },
    { code: '+61', label: 'AU (+61)', length: 9 },
    { code: '+971', label: 'UAE (+971)', length: 9 },
    { code: '+33', label: 'FR (+33)', length: 9 },
    { code: '+49', label: 'DE (+49)', length: 10 },
    { code: '+81', label: 'JP (+81)', length: 10 },
    { code: '+86', label: 'CN (+86)', length: 11 },
  ];

  const CATEGORY_OPTIONS = [
    'Resort', 'Men’s', 'Beauty / Body', 'Swim', 'Footwear',
    'Travel', 'Ready to Wear', 'Lounge', 'Accessories – Jewelry',
    'Accessories – Bags'
  ];

  const VALID_FIXTURES = [
    'Display Counter (Large)',
    'Display Counter (Small)',
    'Shelving Unit (4ft)',
    'Shelving Unit (6ft)',
    'Clothing Rail / Rack',
    'Showcase Cabinet (Glass)',
    'Brochure Rack (Floor Stand)',
    'Power Drop (15 Amp)'
  ];

  const calculateTotalQuota = (size: string, customUnits?: string): number => {
    if (size === "Custom Fixture" && customUnits) {
      const num = parseFloat(customUnits) || 0;
      return Math.ceil(num * 4);
    }
    const match = size.match(/\((\d+)\s+Fixtures\)/);
    if (match) return parseInt(match[1]);
    return 4;
  };

  const currentTotalFixtures = formData.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0);
  const totalQuota = calculateTotalQuota(formData.boothSize, formData.customBoothSize);

  const handleBrandChange = (index: number, field: keyof BrandInfo, value: string) => {
    const newBrands = [...formData.brands];
    newBrands[index] = { ...newBrands[index], [field]: value };
    setFormData(prev => ({ ...prev, brands: newBrands }));
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
    setFormData(prev => ({ ...prev, [name]: value }));
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
    newFixtures[index] = { ...newFixtures[index], [field]: value };
    setFormData(prev => ({ ...prev, selectedFixtures: newFixtures }));
  };

  const addFixtureRow = () => {
    const remaining = Math.max(0, totalQuota - currentTotalFixtures);
    setFormData(prev => ({
      ...prev,
      selectedFixtures: [...prev.selectedFixtures, { type: 'Display Counter (Large)', quantity: remaining || 1 }]
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
    });

    formData.contacts.forEach((contact, idx) => {
      if (!contact.name?.trim()) newErrors[`contactName_${idx}`] = "Contact Name is required";
      if (!contact.email?.trim()) {
        newErrors[`contactEmail_${idx}`] = "Email is required";
      } else if (!emailRegex.test(contact.email)) {
        newErrors[`contactEmail_${idx}`] = "Invalid email format";
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
        const element = document.getElementsByName(firstError)[0];
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus();
      }
      return;
    }

    setLoading(true);
    setGeneratedLink(null);

    try {
      // mapping correctly for legal consistency
      const finalDetails = {
        ...formData,
        fixture: formData.selectedFixtures[0].type,
        fixtureQuantity: currentTotalFixtures
      };

      // 1. Generate Contract Text with Gemini
      const draftText = await generateContractDraft(finalDetails);

      // 2. Generate the Magic Link Payload
      const payload = {
        id: "cont_" + Date.now().toString(36),
        // Mapping fields for the "vendor contract" app to pick up
        exhibitorType: formData.exhibitorType,
        brands: formData.brands,
        companyName: formData.company,
        contacts: formData.contacts,
        email: formData.email,
        address: formData.address,
        categories: formData.categories,
        otherCategory: formData.otherCategory,
        boothSize: formData.boothSize,
        finalBoothSize: formData.finalBoothSize,
        customBoothSize: formData.customBoothSize,
        selectedFixtures: formData.selectedFixtures,
        fixture: finalDetails.fixture,
        fixtureQuantity: finalDetails.fixtureQuantity,
        eventDate: formData.eventDate,
        specialRequirements: formData.specialRequirements,
      };

      // Create secure Base64 link
      const base64Data = btoa(JSON.stringify(payload));
      const magicLink = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(base64Data)}`;

      // 3. Save to Local Storage
      const newContract = createContract(finalDetails, draftText);
      setGeneratedLink(magicLink);

      // 4. Send Email via Make.com Webhook (Unified Flow)
      const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/ihncxlrp5nekfz7h2kmy5hni4lv0ct6w";

      try {
        await fetch(MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: "submit_vendor_data",
            submissionLink: magicLink,
            email: formData.email,
            data: payload
          })
        });
        alert(`Contract Generated!\n\nEmail for signing link triggered via Make.com.`);
      } catch (webhookError) {
        console.error("Make.com Webhook Error:", webhookError);
        alert("Contract generated, but failed to trigger Make.com email. Check the console.");
      }

      navigate(`#/contract/${newContract.id}`);

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
                          <label className={labelClass}>Website</label>
                          <div className="relative">
                            <Globe className={iconClass} />
                            <input
                              type="url"
                              value={brand.website}
                              onChange={(e) => handleBrandChange(idx, 'website', e.target.value)}
                              className={inputClass}
                              placeholder="https://www.company.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass}>Instagram</label>
                          <div className="relative">
                            <Instagram className={iconClass} />
                            <input
                              type="text"
                              value={brand.instagram}
                              onChange={(e) => handleBrandChange(idx, 'instagram', e.target.value)}
                              className={inputClass}
                              placeholder="@username"
                            />
                          </div>
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
                      <div>
                        <label className={labelClass}>Contact Name <span className="text-red-500">*</span></label>
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
                          />
                        </div>
                        {errors[`contactName_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`contactName_${idx}`]}</p>}
                      </div>
                      <div>
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
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all ${errors.address ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-300'}`}
                      value={formData.address}
                      onChange={(e) => {
                        handleChange(e);
                        if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                      }}
                      placeholder="Street Address, City, State, ZIP, Country"
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
                        if (size === "Custom Fixture") {
                          const units = formData.customBoothSize || '7.0+';
                          const details = formData.customBoothRequirements || 'Custom Dimensions';
                          finalDesc = `${units} Custom || ${details} || (${qty} Fixtures)`;
                        }

                        const newFixtures = [...formData.selectedFixtures];
                        if (newFixtures.length === 1) newFixtures[0].quantity = qty;

                        setFormData({ ...formData, boothSize: size, finalBoothSize: finalDesc, selectedFixtures: newFixtures });
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
                            value={formData.customBoothSize || ''}
                            onChange={(e) => {
                              const units = e.target.value;
                              const qty = calculateTotalQuota("Custom Fixture", units);
                              const finalDesc = `${units || 'Custom'} Custom || (${qty} Fixtures)`;
                              const newFixtures = [...formData.selectedFixtures];
                              if (newFixtures.length === 1) newFixtures[0].quantity = qty;
                              setFormData({ ...formData, customBoothSize: units, finalBoothSize: finalDesc, selectedFixtures: newFixtures });
                            }}
                            placeholder="e.g. 8.5"
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
                  {formData.selectedFixtures.map((fix, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-1 px-3 py-1.5 border rounded text-sm"
                        value={fix.type}
                        onChange={(e) => handleFixtureChange(idx, 'type', e.target.value)}
                      >
                        {VALID_FIXTURES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <input
                        type="number"
                        className="w-20 px-3 py-1.5 border rounded text-sm"
                        value={fix.quantity}
                        onChange={(e) => handleFixtureChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                      />
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
    </div>
  );
};