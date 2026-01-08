import React from 'react';
import { VendorFormData, BoothSize, FixtureType, PaymentMode, SelectedFixture, ExhibitorType, BrandInfo, ContactInfo } from '../types';
import { User, Mail, MapPin, Building2, LayoutGrid, Lamp, ShoppingCart, CreditCard, FileText, Send, Loader2, Globe, Instagram, Phone, Plus, Trash2, CheckSquare, FileCheck, Layers } from 'lucide-react';

interface VendorFormProps {
  data: VendorFormData;
  onChange: (data: VendorFormData) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  processingText?: string;
}

const CATEGORY_OPTIONS = [
  'Resort', 'Men’s', 'Beauty / Body', 'Swim', 'Footwear',
  'Travel', 'Ready to Wear', 'Lounge', 'Accessories – Jewelry',
  'Accessories – Bags'
];

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

const VALID_FIXTURES = [
  FixtureType.DISPLAY_COUNTER_L,
  FixtureType.DISPLAY_COUNTER_S,
  FixtureType.SHELVING_UNIT_4FT,
  FixtureType.SHELVING_UNIT_6FT,
  FixtureType.CLOTHING_RAIL,
  FixtureType.SHOWCASE_CABINET,
  FixtureType.BROCHURE_RACK,
  FixtureType.POWER_DROP
];

const VendorForm: React.FC<VendorFormProps> = ({
  data,
  onChange,
  onSubmit,
  isProcessing,
  processingText = "Generating Contract..."
}) => {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): { isValid: boolean, currentErrors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!data.companyName?.trim()) newErrors.companyName = "Company Name is required";

    data.brands.forEach((brand, idx) => {
      if (!brand.brandName?.trim()) {
        newErrors[`brandName_${idx}`] = "Brand Name is required";
      }
    });

    data.contacts.forEach((contact, idx) => {
      if (!contact.name?.trim()) newErrors[`contactName_${idx}`] = "Contact Name is required";
      if (!contact.email?.trim()) {
        newErrors[`contactEmail_${idx}`] = "Email is required";
      } else if (!emailRegex.test(contact.email)) {
        newErrors[`contactEmail_${idx}`] = "Invalid email format";
      }
    });

    if (!data.address?.trim()) newErrors.address = "Address is required";

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, currentErrors: newErrors };
  };

  const handleFormSubmit = () => {
    const { isValid, currentErrors } = validate();
    if (isValid) {
      onSubmit();
    } else {
      // Scroll to first error
      const firstErrorKey = Object.keys(currentErrors)[0];
      if (firstErrorKey) {
        const element = document.getElementsByName(firstErrorKey)[0];
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.focus();
      }
    }
  };

  const calculateTotalQuota = (size: BoothSize, customSize?: string): number => {
    if (size === BoothSize.CUSTOM_LARGE && customSize) {
      const num = parseFloat(customSize) || 0;
      return Math.ceil(num * 4);
    }
    const match = size.match(/\((\d+)\s+Fixtures\)/);
    if (match) return parseInt(match[1]);
    return 4;
  };

  const totalQuota = calculateTotalQuota(data.boothSize, data.customBoothSize);
  const currentTotalFixtures = data.selectedFixtures.reduce((sum, f) => sum + f.quantity, 0);

  const handleChange = (field: keyof VendorFormData, value: any) => {
    const newData = { ...data, [field]: value };

    if (field === 'boothSize' || field === 'customBoothSize' || field === 'customBoothRequirements') {
      const sizeToUse = field === 'boothSize' ? value as BoothSize : data.boothSize;
      const customSizeToUse = field === 'customBoothSize' ? value as string : data.customBoothSize;

      const qty = calculateTotalQuota(sizeToUse, customSizeToUse);

      // Update final description in professional format
      if (sizeToUse === BoothSize.CUSTOM_LARGE) {
        const units = customSizeToUse || 'Custom';
        newData.finalBoothSize = `${units} Custom || (${qty} Fixtures)`;
      } else {
        newData.finalBoothSize = sizeToUse;
      }

      // If switching booth size, we might need to adjust the first fixture quantity to match quota if it's the only one
      if (newData.selectedFixtures.length === 1) {
        newData.selectedFixtures[0].quantity = qty;
      }
    }

    onChange(newData);
  };

  const handleBrandChange = (index: number, field: keyof BrandInfo, value: string) => {
    const newBrands = [...data.brands];
    newBrands[index] = { ...newBrands[index], [field]: value };
    onChange({ ...data, brands: newBrands });
  };

  const addBrandRow = () => {
    onChange({ ...data, brands: [...data.brands, { brandName: '', showroomName: '', website: '', instagram: '' }] });
  };

  const removeBrandRow = (index: number) => {
    if (data.brands.length > 1) {
      onChange({ ...data, brands: data.brands.filter((_, i) => i !== index) });
    }
  };

  const handleContactChange = (index: number, field: keyof ContactInfo, value: string) => {
    const newContacts = [...data.contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };

    // Update top level email for compatibility if it's the first contact
    const updates: Partial<VendorFormData> = { contacts: newContacts };
    if (index === 0 && field === 'email') {
      updates.email = value;
    }

    onChange({ ...data, ...updates });
  };

  const addContactRow = () => {
    onChange({ ...data, contacts: [...data.contacts, { name: '', email: '', title: '' }] });
  };

  const removeContactRow = (index: number) => {
    if (data.contacts.length > 1) {
      onChange({ ...data, contacts: data.contacts.filter((_, i) => i !== index) });
    }
  };

  const handleFixtureChange = (index: number, field: keyof SelectedFixture, value: any) => {
    const newFixtures = [...data.selectedFixtures];
    newFixtures[index] = { ...newFixtures[index], [field]: value };
    onChange({ ...data, selectedFixtures: newFixtures });
  };

  const addFixtureRow = () => {
    // Calculate remaining quota for the new row
    const remaining = Math.max(0, totalQuota - currentTotalFixtures);
    const newFixtures = [...data.selectedFixtures, { type: FixtureType.DISPLAY_COUNTER_L, quantity: remaining || 1 }];
    onChange({ ...data, selectedFixtures: newFixtures });
  };

  const removeFixtureRow = (index: number) => {
    if (data.selectedFixtures.length > 1) {
      const newFixtures = data.selectedFixtures.filter((_, i) => i !== index);
      onChange({ ...data, selectedFixtures: newFixtures });
    }
  };

  const toggleCategory = (category: string) => {
    const newCategories = data.categories.includes(category)
      ? data.categories.filter(c => c !== category)
      : [...data.categories, category];
    onChange({ ...data, categories: newCategories });
  };

  const inputClass = "w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const iconClass = "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400";
  const helperClass = "text-[10px] text-slate-400 mt-0.5 ml-1";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* STEP 1: Exhibitor / Company Information */}
      <section className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-4">
          <Building2 className="w-5 h-5 text-accent" />
          Exhibitor Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-full">
            <label className={labelClass}>Exhibitor Type <span className="text-red-500">*</span></label>
            <div className="flex gap-6">
              {!data.exhibitorType ? (
                Object.values(ExhibitorType).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleChange('exhibitorType', type)}
                    className="flex-1 py-8 px-6 rounded-xl border-2 border-slate-200 hover:border-accent hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center gap-3 group bg-white shadow-sm hover:shadow-md"
                  >
                    <div className="p-3 bg-slate-100 rounded-full group-hover:bg-blue-100 transition-colors">
                      {type === ExhibitorType.BRAND ? (
                        <FileCheck className="w-8 h-8 text-slate-500 group-hover:text-accent" />
                      ) : (
                        <Layers className="w-8 h-8 text-slate-500 group-hover:text-accent" />
                      )}
                    </div>
                    <span className="font-bold text-lg text-slate-700 group-hover:text-accent">{type}</span>
                  </button>
                ))
              ) : (
                <div className="flex items-center justify-between w-full p-6 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-lg shadow-sm">
                      {data.exhibitorType === ExhibitorType.BRAND ? (
                        <FileCheck className="w-6 h-6 text-accent" />
                      ) : (
                        <Layers className="w-6 h-6 text-accent" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Selected Type</span>
                      <p className="text-lg font-bold text-slate-900">{data.exhibitorType}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleChange('exhibitorType', '')}
                    className="text-sm font-semibold text-slate-500 hover:text-red-500 px-4 py-2 hover:bg-white/50 rounded-lg transition-all"
                  >
                    Change Selection
                  </button>
                </div>
              )}
            </div>
          </div>

          {data.exhibitorType && (
            <>
              <div className="col-span-full">
                <label className={labelClass}>
                  {data.exhibitorType === 'Multi-line showroom' ? 'Showroom Name' : 'Company Name'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className={iconClass} />
                  <input
                    type="text"
                    name="companyName"
                    value={data.companyName}
                    onChange={(e) => {
                      handleChange('companyName', e.target.value);
                      if (errors.companyName) setErrors(prev => ({ ...prev, companyName: '' }));
                    }}
                    className={`${inputClass} ${errors.companyName ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    placeholder={data.exhibitorType === 'Multi-line showroom' ? "Showroom Name" : "Acme Corp"}
                    required
                  />
                </div>
                {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
              </div>

              <div className="col-span-full space-y-6">
                {data.brands.map((brand, idx) => (
                  <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 relative group">
                    {data.brands.length > 1 && (
                      <button
                        onClick={() => removeBrandRow(idx)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Brand Details {data.brands.length > 1 ? `#${idx + 1}` : ''}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={data.exhibitorType === 'Multi-line showroom' ? 'col-span-2' : ''}>
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
                            className={`${inputClass} ${errors[`brandName_${idx}`] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                            placeholder="Brand Identity"
                          />
                        </div>
                        {errors[`brandName_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`brandName_${idx}`]}</p>}
                      </div>

                      {data.exhibitorType !== 'Multi-line showroom' && (
                        <div>
                          <label className={labelClass}>Showroom Name (if applicable)</label>
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
                        <label className={labelClass}>Website URL</label>
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
                        <label className={labelClass}>Instagram Handle</label>
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
                  onClick={addBrandRow}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Brand
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {data.exhibitorType && (
        <>

          {/* STEP 2: Contact Details */}
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-4">
              <User className="w-5 h-5 text-accent" />
              Contact Details
            </h2>

            <div className="space-y-6">
              {data.contacts.map((contact, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 relative group">
                  {data.contacts.length > 1 && (
                    <button
                      onClick={() => removeContactRow(idx)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact {data.contacts.length > 1 ? `#${idx + 1}` : ''}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          className={`${inputClass} ${errors[`contactName_${idx}`] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
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
                          className={`${inputClass} ${errors[`contactEmail_${idx}`] ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                          placeholder="john@company.com"
                        />
                      </div>
                      {errors[`contactEmail_${idx}`] && <p className="text-red-500 text-xs mt-1">{errors[`contactEmail_${idx}`]}</p>}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addContactRow}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Contact
              </button>

              <div className="col-span-full">
                <label className={labelClass}>Full Mailing Address <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea
                    name="address"
                    value={data.address}
                    onChange={(e) => {
                      handleChange('address', e.target.value);
                      if (errors.address) setErrors(prev => ({ ...prev, address: '' }));
                    }}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all min-h-[100px] ${errors.address ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                    placeholder="Street Address, City, State, ZIP, Country"
                    required
                  />
                </div>
                {errors.address && <p className="text-red-500 text-xs mt-1 font-normal ml-1">{errors.address}</p>}
              </div>
            </div>
          </section>

          {/* STEP 3: Categories */}
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-4">
              <CheckSquare className="w-5 h-5 text-accent" />
              Categories Being Shown at Cabana
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {CATEGORY_OPTIONS.map((cat) => (
                <label key={cat} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.categories.includes(cat)}
                    onChange={() => toggleCategory(cat)}
                    className="w-4 h-4 text-accent border-slate-300 rounded focus:ring-accent"
                  />
                  <span className="text-sm text-slate-700">{cat}</span>
                </label>
              ))}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50 transition-colors col-span-full sm:col-span-2">
                <input
                  type="checkbox"
                  checked={data.categories.includes('Other')}
                  onChange={() => toggleCategory('Other')}
                  className="w-4 h-4 text-accent border-slate-300 rounded focus:ring-accent"
                />
                <span className="text-sm text-slate-700 mr-2">Other:</span>
                {data.categories.includes('Other') && (
                  <input
                    type="text"
                    value={data.otherCategory}
                    onChange={(e) => handleChange('otherCategory', e.target.value)}
                    className="flex-1 px-2 py-1 border-b border-slate-300 outline-none focus:border-accent bg-transparent text-sm"
                    placeholder="Specify other category"
                  />
                )}
              </label>
            </div>
          </section>

          {/* Booth & Fixtures */}
          <section className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2 border-b pb-4">
              <LayoutGrid className="w-5 h-5 text-accent" />
              Booth & Fixture Selection
            </h2>

            <div className="space-y-6">
              <div>
                <label className={labelClass}>Booth Size</label>
                <div className="relative">
                  <LayoutGrid className={iconClass} />
                  <select
                    value={data.boothSize}
                    onChange={(e) => handleChange('boothSize', e.target.value as BoothSize)}
                    className={inputClass}
                  >
                    {Object.values(BoothSize).map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>

                {data.boothSize === BoothSize.CUSTOM_LARGE && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className={labelClass}>Fixture Count (Number)</label>
                        <input
                          type="text"
                          value={data.customBoothSize || ''}
                          onChange={(e) => handleChange('customBoothSize', e.target.value)}
                          className={inputClass}
                          placeholder="e.g. 8.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Contract Booth Entry (Professional Display)</label>
                      <input
                        type="text"
                        value={data.finalBoothSize}
                        readOnly
                        className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white/50 text-xs font-mono text-blue-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Fixture Allocation</h3>
                  <div className={`text-xs font-bold px-3 py-1 rounded-full ${currentTotalFixtures > totalQuota ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {currentTotalFixtures} / {totalQuota} Fixtures Used
                  </div>
                </div>

                <div className="space-y-4">
                  {data.selectedFixtures.map((fix, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-white p-4 rounded-lg border border-slate-100 shadow-sm relative group">
                      <div className="md:col-span-7">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Fixture Type</label>
                        <div className="relative">
                          <Lamp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <select
                            value={fix.type}
                            onChange={(e) => handleFixtureChange(idx, 'type', e.target.value as FixtureType)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
                          >
                            {VALID_FIXTURES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Quantity</label>
                        <div className="relative">
                          <ShoppingCart className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                          <input
                            type="number"
                            min="1"
                            value={fix.quantity}
                            onChange={(e) => handleFixtureChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </div>
                      <div className="md:col-span-2 flex gap-2">
                        {data.selectedFixtures.length > 1 && (
                          <button
                            onClick={() => removeFixtureRow(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Remove"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addFixtureRow}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 text-sm font-medium hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Fixture Type
                </button>

                {currentTotalFixtures > totalQuota && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs flex items-start gap-2 animate-pulse">
                    <span className="font-bold">(!)</span>
                    <span>You have exceeded the standard fixture quota ({totalQuota}). Extra charges may apply for {currentTotalFixtures - totalQuota} additional fixtures.</span>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Payment Mode</label>
                <div className="relative">
                  <CreditCard className={iconClass} />
                  <select
                    value={data.paymentMode}
                    onChange={(e) => handleChange('paymentMode', e.target.value as PaymentMode)}
                    className={inputClass}
                  >
                    {Object.values(PaymentMode).map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <button
            onClick={handleFormSubmit}
            disabled={isProcessing}
            className={`w-full py-4 px-6 rounded-xl text-white font-bold shadow-lg transition-all flex items-center justify-center gap-2 text-lg
          ${isProcessing
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-accent hover:bg-blue-700 hover:shadow-xl active:transform active:scale-95'
              }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin h-6 w-6 text-white" />
                <span>{processingText}</span>
              </>
            ) : (
              <>
                <Send className="w-6 h-6" />
                <span>SUBMIT APPLICATION</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
};

export default VendorForm;