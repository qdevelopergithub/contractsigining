/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState } from 'react';
import { VendorDetails } from '../types';
import { generateContractDraft } from '../services/gemini';
import { createContract } from '../services/storage';
import { Sparkles, Send, Loader2, Settings, Copy, Check } from 'lucide-react';

interface Props {
  navigate: (path: string) => void;
}

export const CreateContractForm: React.FC<Props> = ({ navigate }) => {
  const [loading, setLoading] = useState(false);
  // DEFAULT URL set to your specific script
  const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAjV1kJRnqHrh_e3QRnKrTRiSnM2TGGZfIhSGP2jUc_IZv-44yO-jAq_668MdsYEZtGA/exec';
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('gas_url') || DEFAULT_SCRIPT_URL);
  const [showConfig, setShowConfig] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<VendorDetails>({
    name: '',
    email: '',
    phone: '',
    countryCode: '+1',
    address: '',
    company: '',
    brandName: '',
    showroomName: '',
    website: '',
    instagram: '',
    title: '',
    categories: [],
    otherCategory: '',
    boothSize: "1 Standard || 13' x 8' || (4 Fixtures)",
    finalBoothSize: "1 Standard || 13' x 8' || (4 Fixtures)",
    selectedFixtures: [{ type: 'Display Counter (Large)', quantity: 4 }],
    fixture: 'Display Counter (Large)',
    fixtureQuantity: 4,
    eventDate: new Date().toISOString().split('T')[0],
    specialRequirements: '',
    additionalContact: {
      name: '',
      email: '',
      phone: '',
      countryCode: '+1'
    }
  });

  const COUNTRY_CODES = [
    { code: '+1', label: 'US (+1)' },
    { code: '+44', label: 'UK (+44)' },
    { code: '+91', label: 'IN (+91)' },
    { code: '+61', label: 'AU (+61)' },
    { code: '+971', label: 'UAE (+971)' },
    { code: '+33', label: 'FR (+33)' },
    { code: '+49', label: 'DE (+49)' },
    { code: '+81', label: 'JP (+81)' },
    { code: '+86', label: 'CN (+86)' },
  ];

  const CATEGORY_OPTIONS = [
    'Resort', 'Men’s', 'Beauty / Body', 'Swim', 'Footwear',
    'Travel', 'Ready to Wear', 'Lounge', 'Accessories – Jewelry',
    'Accessories – Bags'
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdditionalContactChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      additionalContact: {
        ...(prev.additionalContact || { name: '', email: '', phone: '', countryCode: '+1' }),
        [field]: value
      }
    }));
  };

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

  const validate = (): { isValid: boolean, currentErrors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.company?.trim()) newErrors.company = "Company Name is required";
    if (!formData.brandName?.trim()) newErrors.brandName = "Brand Name is required";
    if (!formData.name?.trim()) newErrors.name = "Contact Name is required";
    if (!formData.email?.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phone?.trim()) {
      newErrors.phone = "Phone Number is required";
    } else if (!/^\d+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid numeric number (integers only)";
    }
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
        companyName: formData.company,
        brandName: formData.brandName,
        showroomName: formData.showroomName,
        website: formData.website,
        instagram: formData.instagram,
        contactName: formData.name,
        title: formData.title,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        categories: formData.categories,
        otherCategory: formData.otherCategory,
        boothSize: formData.boothSize,
        finalBoothSize: formData.finalBoothSize,
        customBoothSize: formData.customBoothSize,
        customBoothRequirements: formData.customBoothRequirements,
        selectedFixtures: formData.selectedFixtures,
        fixture: finalDetails.fixture,
        fixtureQuantity: finalDetails.fixtureQuantity,
        eventDate: formData.eventDate,
        specialRequirements: formData.specialRequirements,
        additionalContact: formData.additionalContact,
        countryCode: formData.countryCode
      };

      // Create secure Base64 link
      const base64Data = btoa(JSON.stringify(payload));
      const magicLink = `${window.location.origin}${window.location.pathname}?data=${encodeURIComponent(base64Data)}`;

      // 3. Save to Local Storage
      const newContract = createContract(finalDetails, draftText);
      setGeneratedLink(magicLink);

      // 4. Send Email via Google Apps Script
      if (scriptUrl) {
        try {
          await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: "send_signing_link",
              fullName: formData.name,
              email: formData.email,
              companyName: formData.company,
              signingLink: magicLink
            })
          });
          alert(`Contract Generated!\n\nEmail sent to ${formData.email} via Google Apps Script.`);
        } catch (netError) {
          console.error(netError);
          alert("Contract generated, but failed to call Google Apps Script. Check the console.");
        }
      }

      navigate(`#/contract/${newContract.id}`);

    } catch (error) {
      console.error(error);
      alert("Failed to generate contract. Please check console.");
    } finally {
      setLoading(false);
    }
  };

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition";

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
            <div className="md:col-span-2">
              <label className={labelClass}>Company Name</label>
              <input
                name="company"
                className={`${inputClass} ${errors.company ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                value={formData.company}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.company) setErrors(prev => ({ ...prev, company: '' }));
                }}
              />
              {errors.company && <p className="text-red-500 text-xs mt-1">{errors.company}</p>}
            </div>
            <div>
              <label className={labelClass}>Brand Name</label>
              <input
                name="brandName"
                className={`${inputClass} ${errors.brandName ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                value={formData.brandName}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.brandName) setErrors(prev => ({ ...prev, brandName: '' }));
                }}
              />
              {errors.brandName && <p className="text-red-500 text-xs mt-1">{errors.brandName}</p>}
              <p className="text-[10px] text-gray-400 mt-1">As it will appear on Booth ID</p>
            </div>
            <div>
              <label className={labelClass}>Showroom Name</label>
              <input name="showroomName" className={inputClass} value={formData.showroomName} onChange={handleChange} />
              <p className="text-[10px] text-gray-400 mt-1">As it will appear on Booth ID</p>
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input type="url" name="website" className={inputClass} value={formData.website} onChange={handleChange} />
            </div>
            <div>
              <label className={labelClass}>Instagram Handle</label>
              <input name="instagram" className={inputClass} value={formData.instagram} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Primary Contact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Primary Contact Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Contact Name</label>
              <input
                name="name"
                className={`${inputClass} ${errors.name ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                value={formData.name}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className={labelClass}>Title</label>
              <input name="title" className={inputClass} value={formData.title} onChange={handleChange} />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                name="email"
                className={`${inputClass} ${errors.email ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                value={formData.email}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <div className="flex gap-2">
                <select
                  name="countryCode"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={formData.countryCode}
                  onChange={handleChange}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <div className="flex-1">
                  <input
                    name="phone"
                    className={`${inputClass} ${errors.phone ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                    value={formData.phone}
                    onChange={(e) => {
                      handleChange(e);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    placeholder="Enter numbers only"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Company Address</label>
              <textarea
                name="address"
                rows={2}
                className={`${inputClass} ${errors.address ? 'border-red-500 ring-2 ring-red-100' : ''}`}
                value={formData.address}
                onChange={(e) => {
                  handleChange(e);
                  if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                }}
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </div>
          </div>
        </div>

        {/* Additional Contact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 border-b pb-2">Additional Contact Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Name</label>
              <input
                name="altName"
                className={inputClass}
                value={formData.additionalContact?.name || ''}
                onChange={(e) => handleAdditionalContactChange('name', e.target.value)}
                placeholder="Alternative Contact Name"
              />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                name="altEmail"
                className={inputClass}
                value={formData.additionalContact?.email || ''}
                onChange={(e) => handleAdditionalContactChange('email', e.target.value)}
                placeholder="alt@company.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Contact Number</label>
              <div className="flex gap-3">
                <select
                  className="w-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.additionalContact?.countryCode || '+1'}
                  onChange={(e) => handleAdditionalContactChange('countryCode', e.target.value)}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.additionalContact?.phone || ''}
                  onChange={(e) => handleAdditionalContactChange('phone', e.target.value)}
                  placeholder="555-000-0000"
                />
              </div>
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
              <select
                name="boothSize"
                className={inputClass}
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
                  "1 Standard || 13' x 8' || (4 Fixtures)",
                  "1.5 Standard || 20' x 8' || (6 Fixtures)",
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className={labelClass}>Custom Units</label>
                  <input
                    name="customBoothSize"
                    className={inputClass}
                    value={formData.customBoothSize || ''}
                    onChange={(e) => {
                      const units = e.target.value;
                      const qty = calculateTotalQuota("Custom Fixture", units);
                      const details = formData.customBoothRequirements || 'Custom Dimensions';
                      const finalDesc = `${units || 'Custom'} Custom || ${details} || (${qty} Fixtures)`;
                      const newFixtures = [...formData.selectedFixtures];
                      if (newFixtures.length === 1) newFixtures[0].quantity = qty;
                      setFormData({ ...formData, customBoothSize: units, finalBoothSize: finalDesc, selectedFixtures: newFixtures });
                    }}
                    placeholder="e.g. 8.5"
                  />
                </div>
                <div>
                  <label className={labelClass}>Booth Dimensions</label>
                  <input
                    name="customBoothRequirements"
                    className={inputClass}
                    value={formData.customBoothRequirements || ''}
                    onChange={(e) => {
                      const details = e.target.value;
                      const units = formData.customBoothSize || 'Custom';
                      const qty = calculateTotalQuota("Custom Fixture", units);
                      const finalDesc = `${units} Custom || ${details || 'Custom Dimensions'} || (${qty} Fixtures)`;
                      setFormData({ ...formData, customBoothRequirements: details, finalBoothSize: finalDesc });
                    }}
                    placeholder="e.g. 15' x 10'"
                  />
                </div>
              </div>
            )}

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
                    {[
                      'Display Counter (Large)', 'Display Counter (Small)', 'Shelving Unit (4ft)',
                      'Shelving Unit (6ft)', 'Rectangular Table (6ft)', 'Rectangular Table (4ft)',
                      'Standard Exhibition Chair', 'Clothing Rail / Rack', 'Showcase Cabinet (Glass)',
                      'Brochure Rack (Floor Stand)', 'Power Drop (15 Amp)'
                    ].map(type => <option key={type} value={type}>{type}</option>)}
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
                <label className={labelClass}>Event Date</label>
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
                {errors.eventDate && <p className="text-red-500 text-xs mt-1">{errors.eventDate}</p>}
              </div>
              <div>
                <label className={labelClass}>Final Confirmation (Editable)</label>
                <input name="finalBoothSize" className="w-full px-4 py-2 border border-indigo-200 rounded-lg text-xs font-mono" value={formData.finalBoothSize} onChange={handleChange} />
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
      </form>
    </div>
  );
};