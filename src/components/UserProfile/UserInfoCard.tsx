import { useState, useMemo, useEffect, useRef } from "react";
import { AuthService } from "../../services/auth/auth.services";
import toastHelper from "../../utils/toastHelper";
import countriesData from "../../data/countries.json";
import { STORAGE_KEYS, StorageService } from "../../constants/storage";

// Country to Currency mapping
const countryToCurrency = {
  Hongkong: "HKD",
  Dubai: "AED",
  Singapore: "SGD",
  India: "INR",
};

interface FormData {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  businessName: string;
  businessCountry: string;
  businessCurrency: string;
  businessAddress: string;
}

interface UserInfoCardProps {
  formData: FormData;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}

export default function UserInfoCard({
  formData,
  handleChange,
}: UserInfoCardProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "business" | "account"
  >("profile");
  const [showPassword, setShowPassword] = useState<{
    current: boolean;
    new: boolean;
    confirm: boolean;
  }>({
    current: false,
    new: false,
    confirm: false,
  });
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [certificateImage, setCertificateImage] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  // Helper function to construct full image URL from relative path
  const getImageUrl = (path: string | null | undefined): string | null => {
    if (!path) return null;
    const base = (import.meta as { env?: { VITE_BASE_URL?: string } }).env?.VITE_BASE_URL || '';
    const isAbsolute = /^https?:\/\//i.test(path);
    if (isAbsolute) return path;
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  // Load images from profile when component mounts or profile updates
  useEffect(() => {
    const loadImagesFromProfile = async () => {
      try {
        // First try to get from localStorage
        const stored = StorageService.getItem(STORAGE_KEYS.USER);
        if (stored) {
          const user = stored as any;
          const business = user?.businessProfile || {};
          if (business?.logo) {
            const logoUrl = getImageUrl(business.logo);
            if (logoUrl) setLogoImage(logoUrl);
          }
          if (business?.certificate) {
            const certUrl = getImageUrl(business.certificate);
            if (certUrl) setCertificateImage(certUrl);
          }
        }

        // Then fetch fresh profile from API
        const profile = await AuthService.getProfile();
        const p: any = profile?.data || {};
        const bp = p?.businessProfile || {};
        
        if (bp?.logo) {
          const logoUrl = getImageUrl(bp.logo);
          if (logoUrl) setLogoImage(logoUrl);
        }
        if (bp?.certificate) {
          const certUrl = getImageUrl(bp.certificate);
          if (certUrl) setCertificateImage(certUrl);
        }
      } catch (error) {
        console.error('Error loading images from profile:', error);
      }
    };

    loadImagesFromProfile();
  }, []);

  // Country code dropdown state
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [phoneSearchTerm, setPhoneSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Business country and currency dropdown state
  const [showBusinessCountryDropdown, setShowBusinessCountryDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [businessCountrySearchTerm, setBusinessCountrySearchTerm] = useState("");
  const businessCountryRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowPhoneDropdown(false);
        setPhoneSearchTerm("");
      }
      if (
        businessCountryRef.current &&
        !businessCountryRef.current.contains(event.target as Node)
      ) {
        setShowBusinessCountryDropdown(false);
        setBusinessCountrySearchTerm("");
      }
      if (
        currencyRef.current &&
        !currencyRef.current.contains(event.target as Node)
      ) {
        setShowCurrencyDropdown(false);
      }
    };

    if (showPhoneDropdown || showBusinessCountryDropdown || showCurrencyDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPhoneDropdown, showBusinessCountryDropdown, showCurrencyDropdown]);

  // Process countries data
  const countries = useMemo(() => {
    return [...countriesData.countries]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((country) => ({
        name: country.name,
        code: country.code,
        phone_code: country.phone_code,
        flag: country.flag,
      }));
  }, []);

  // Filter countries based on search term
  const getFilteredCountries = (searchTerm: string) => {
    if (!searchTerm) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        country.phone_code.includes(searchTerm)
    );
  };

  // Get business countries list (limited to mapped countries)
  const businessCountries = ["Hongkong", "Dubai", "Singapore", "India"];
  const currencies = ["HKD", "AED", "SGD", "INR"];

  // Filter business countries based on search term
  const getFilteredBusinessCountries = (searchTerm: string) => {
    if (!searchTerm) return businessCountries;
    return businessCountries.filter((country) =>
      country.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Handle country code change
  const handlePhoneCodeChange = (phoneCode: string) => {
    handleChange({
      target: { name: "countryCode", value: phoneCode },
    } as React.ChangeEvent<HTMLInputElement>);
    setShowPhoneDropdown(false);
    setPhoneSearchTerm("");
  };

  // Handle business country change
  const handleBusinessCountryChange = (country: string) => {
    handleChange({
      target: { name: "businessCountry", value: country },
    } as React.ChangeEvent<HTMLInputElement>);
    
    // Auto-set currency based on country
    const currency = countryToCurrency[country as keyof typeof countryToCurrency];
    if (currency) {
      handleChange({
        target: { name: "businessCurrency", value: currency },
      } as React.ChangeEvent<HTMLInputElement>);
    }
    
    setShowBusinessCountryDropdown(false);
    setBusinessCountrySearchTerm("");
  };

  // Handle currency change
  const handleCurrencyChange = (currency: string) => {
    handleChange({
      target: { name: "businessCurrency", value: currency },
    } as React.ChangeEvent<HTMLInputElement>);
    setShowCurrencyDropdown(false);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload: any = {
        name: formData?.name?.trim(),
        email: formData?.email?.trim(),
        mobileNumber: formData?.phone?.trim(),
        mobileCountryCode: formData?.countryCode?.trim(),
      };
      
      // Include business profile fields
      payload.businessName = formData.businessName?.trim();
      payload.country = formData.businessCountry?.trim();
      payload.currencyCode = formData.businessCurrency?.trim();
      payload.address = formData.businessAddress?.trim();
      payload.logo = logoFile || undefined;
      payload.certificate = certificateFile || undefined;
      
      // Only submit for approval when saving from Business Profile tab
      if (activeTab === 'business') {
        payload.submitForApproval = true;
      }

      await AuthService.updateProfile(payload);

      try {
        const profile = await AuthService.getProfile();
        const stored = StorageService.getItem(STORAGE_KEYS.USER);
        const prevUser = (stored as any) || {};
        const p: any = profile?.data || {};
        const bp = p?.businessProfile || {};
        
        const merged = {
          ...prevUser,
          name: p?.name ?? payload.name ?? prevUser?.name,
          email: p?.email ?? payload.email ?? prevUser?.email,
          mobileNumber:
            p?.mobileNumber ??
            payload.mobileNumber ??
            prevUser?.mobileNumber,
          mobileCountryCode:
            p?.mobileCountryCode ??
            payload.mobileCountryCode ??
            prevUser?.mobileCountryCode,
          businessProfile: {
            ...(prevUser?.businessProfile || {}),
            businessName:
              bp?.businessName ??
              payload.businessName ??
              prevUser?.businessProfile?.businessName,
            country:
              bp?.country ??
              payload.country ??
              prevUser?.businessProfile?.country,
            currencyCode:
              bp?.currencyCode ??
              payload.currencyCode ??
              prevUser?.businessProfile?.currencyCode,
            address:
              bp?.address ??
              payload.address ??
              prevUser?.businessProfile?.address,
            logo:
              bp?.logo ??
              prevUser?.businessProfile?.logo,
            certificate:
              bp?.certificate ??
              prevUser?.businessProfile?.certificate,
          },
        };
        StorageService.setItem(STORAGE_KEYS.USER, merged);
        
        // Update image states with new URLs
        if (bp?.logo) {
          const logoUrl = getImageUrl(bp.logo);
          if (logoUrl) setLogoImage(logoUrl);
        }
        if (bp?.certificate) {
          const certUrl = getImageUrl(bp.certificate);
          if (certUrl) setCertificateImage(certUrl);
        }
      } catch {}
    } catch (error) {
      // Error toasts handled in service
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (
      !formData.currentPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      toastHelper.showTost("Please fill all password fields", "warning");
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toastHelper.showTost(
        "New password and confirm password do not match",
        "warning"
      );
      return;
    }
    if (formData.newPassword.length < 6) {
      toastHelper.showTost("Password must be at least 6 characters", "warning");
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await AuthService.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      if (!response) return;

      // Clear password fields on success
      handleChange({
        target: { name: "currentPassword", value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
      handleChange({
        target: { name: "newPassword", value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
      handleChange({
        target: { name: "confirmPassword", value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
    } catch (error) {
      // Error toast already handled in service
    } finally {
      setIsChangingPassword(false);
    }
  };

  const togglePassword = (field: "current" | "new" | "confirm") => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "certificate"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (type === "logo") {
          setLogoImage(result);
          setLogoFile(file);
        } else {
          setCertificateImage(result);
          setCertificateFile(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (type: "logo" | "certificate") => {
    if (type === "logo") {
      setLogoImage(null);
      setLogoFile(null);
    } else {
      setCertificateImage(null);
      setCertificateFile(null);
    }
  };

  return (
    <div className="p-5 border bg-white border-gray-200 rounded-2xl shadow dark:border-gray-800 lg:p-6">
      {/* Three Tabs */}
      <div className="flex gap-6 border-b pb-3 mb-5">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-2 text-base font-medium ${
            activeTab === "profile"
              ? "border-b-2 border-[#0071E3] text-[#0071E3]"
              : "text-gray-600 dark:text-gray-400 hover:text-[#0071E3]"
          }`}
        >
          <i className="fas fa-user mr-2"></i> Profile
        </button>
        <button
          onClick={() => setActiveTab("business")}
          className={`pb-2 text-base font-medium ${
            activeTab === "business"
              ? "border-b-2 border-[#0071E3] text-[#0071E3]"
              : "text-gray-600 dark:text-gray-400 hover:text-[#0071E3]"
          }`}
        >
          <i className="fas fa-building mr-2"></i> Business Profile
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`pb-2 text-base font-medium ${
            activeTab === "account"
              ? "border-b-2 border-[#0071E3] text-[#0071E3]"
              : "text-gray-600 dark:text-gray-400 hover:text-[#0071E3]"
          }`}
        >
          <i className="fas fa-cog mr-2"></i> Account Setting
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                <i className="fas fa-user text-gray-500"></i> Name
                <span className="text-red-500">*</span>
              </p>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg  dark:bg-gray-800 dark:text-white/90 dark:border-gray-600"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                <i className="fas fa-envelope text-gray-500"></i> Email Address
                <span className="text-red-500">*</span>
              </p>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg  dark:bg-gray-800 dark:text-white/90 dark:border-gray-600"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                <i className="fas fa-phone text-gray-500"></i> Mobile Number
                <span className="text-red-500">*</span>
              </p>
              <div className="relative flex gap-2">
                {/* Country Code Selector */}
                <div className="relative w-24" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhoneDropdown(!showPhoneDropdown);
                      if (showPhoneDropdown) setPhoneSearchTerm("");
                    }}
                    className="flex items-center justify-between cursor-pointer w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black text-gray-700 text-sm hover:bg-gray-100 transition-colors h-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    <div className="flex items-center">
                      {countries.find(
                        (c) => c.phone_code === formData.countryCode
                      )?.flag && (
                        <img
                          src={
                            countries.find(
                              (c) => c.phone_code === formData.countryCode
                            )?.flag || ""
                          }
                          alt="flag"
                          className="w-4 h-4 mr-1"
                        />
                      )}
                      <span>{formData.countryCode}</span>
                    </div>
                    <svg
                      className="ml-1 w-3 h-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showPhoneDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-10 dark:bg-gray-700 dark:border-gray-600">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                          </div>
                          <input
                            type="text"
                            value={phoneSearchTerm}
                            onChange={(e) => setPhoneSearchTerm(e.target.value)}
                            className="block w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                            placeholder="Search countries..."
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {getFilteredCountries(phoneSearchTerm).map(
                          (country) => (
                            <div
                              key={country.code}
                              onClick={() =>
                                handlePhoneCodeChange(country.phone_code)
                              }
                              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm dark:hover:bg-gray-600"
                            >
                              <img
                                src={country.flag}
                                alt={country.name}
                                className="w-4 h-4 mr-2"
                              />
                              <span className="truncate text-gray-900 dark:text-gray-100">
                                {country.name}
                              </span>
                              <span className="ml-auto text-gray-500 dark:text-gray-300">
                                {country.phone_code}
                              </span>
                            </div>
                          )
                        )}
                        {getFilteredCountries(phoneSearchTerm).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center dark:text-gray-400">
                            No countries found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {/* Phone Number Input */}
                <div className="relative flex-1">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/\D/g, "");
                      handleChange({
                        target: { name: "phone", value: numericValue },
                      } as React.ChangeEvent<HTMLInputElement>);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg  dark:bg-gray-800 dark:text-white/90"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium text-white shadow bg-[#0071E3] hover:bg-[#005bb5] disabled:opacity-60 transition-colors"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2 min-w-[130px]">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 
           5.373 0 12h4zm2 5.291A7.962 7.962 
           0 014 12H0c0 3.042 1.135 5.824 
           3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 min-w-[130px]">
                  <i className="fas fa-save"></i>
                  <span>Save Changes</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Business Profile Tab */}
      {activeTab === "business" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                <i className="fas fa-briefcase text-gray-500"></i> Business Name
                <span className="text-red-500">*</span>
              </p>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg  dark:bg-gray-800 dark:text-white/90 dark:border-gray-600"
                placeholder="Enter your business name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                  <i className="fas fa-globe text-gray-500"></i> Country
                  <span className="text-red-500">*</span>
                </p>
                <div className="relative" ref={businessCountryRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBusinessCountryDropdown(!showBusinessCountryDropdown);
                      if (showBusinessCountryDropdown) setBusinessCountrySearchTerm("");
                    }}
                    className="flex items-center justify-between cursor-pointer w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black text-gray-700 text-sm hover:bg-gray-100 transition-colors h-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    <span>
                      {formData.businessCountry || "Select Country"}
                    </span>
                    <svg
                      className="ml-1 w-3 h-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showBusinessCountryDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-10 dark:bg-gray-700 dark:border-gray-600">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg
                              className="w-4 h-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                          </div>
                          <input
                            type="text"
                            value={businessCountrySearchTerm}
                            onChange={(e) => setBusinessCountrySearchTerm(e.target.value)}
                            className="block w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                            placeholder="Search countries..."
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {getFilteredBusinessCountries(businessCountrySearchTerm).map(
                          (country) => (
                            <div
                              key={country}
                              onClick={() => handleBusinessCountryChange(country)}
                              className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm dark:hover:bg-gray-600"
                            >
                              <span className="text-gray-900 dark:text-gray-100">
                                {country}
                              </span>
                            </div>
                          )
                        )}
                        {getFilteredBusinessCountries(businessCountrySearchTerm).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500 text-center dark:text-gray-400">
                            No countries found
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                  <i className="fas fa-dollar-sign text-gray-500"></i> Currency
                  <span className="text-red-500">*</span>
                </p>
                <div className="relative" ref={currencyRef}>
                  <button
                    type="button"
                    onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                    className="flex items-center justify-between cursor-pointer w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black text-gray-700 text-sm hover:bg-gray-100 transition-colors h-10 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    <span>
                      {formData.businessCurrency || "Select Currency"}
                    </span>
                    <svg
                      className="ml-1 w-3 h-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showCurrencyDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-10 dark:bg-gray-700 dark:border-gray-600">
                      <div className="max-h-48 overflow-y-auto">
                        {currencies.map((currency) => (
                          <div
                            key={currency}
                            onClick={() => handleCurrencyChange(currency)}
                            className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm dark:hover:bg-gray-600"
                          >
                            <span className="text-gray-900 dark:text-gray-100">
                              {currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                <i className="fas fa-map-marker-alt text-gray-500"></i> Business
                Address
                <span className="text-xs text-gray-400">(Optional)</span>
              </p>
              <textarea
                name="businessAddress"
                value={formData.businessAddress}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg  dark:bg-gray-800 dark:text-white/90 resize-none dark:border-gray-600"
                placeholder="Enter your business address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                  <i className="fas fa-image text-gray-500"></i> Business Logo
                  <span className="text-xs text-gray-400">(Optional)</span>
                </p>
                <div className="space-y-3">
                  <label className="inline-block px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                    Choose Logo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "logo")}
                      className="hidden"
                    />
                  </label>
                  {logoFile && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {logoFile.name}
                    </p>
                  )}
                  {logoImage && (
                    <div className="relative inline-block">
                      <img
                        src={logoImage}
                        alt="Logo preview"
                        className="w-20 h-20 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage("logo")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
                  <i className="fas fa-certificate text-gray-500"></i> Business
                  Certificate
                  <span className="text-xs text-gray-400">(Optional)</span>
                </p>
                <div className="space-y-3">
                  <label className="inline-block px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600">
                    Choose Certificate
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleImageUpload(e, "certificate")}
                      className="hidden"
                    />
                  </label>
                  {certificateFile && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {certificateFile.name}
                    </p>
                  )}
                  {certificateImage && (
                    <div className="relative inline-block">
                      <img
                        src={certificateImage}
                        alt="Certificate preview"
                        className="w-32 h-24 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage("certificate")}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSave}
              className="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium text-white shadow bg-[#0071E3] hover:bg-[#005bb5] disabled:opacity-60 transition-colors"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2 min-w-[220px]">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 
             5.373 0 12h4zm2 5.291A7.962 7.962 
             0 014 12H0c0 3.042 1.135 5.824 
             3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2 min-w-[220px]">
                  <i className="fas fa-save"></i>
                  <span>Save Business Profile</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Account Setting Tab */}
      {activeTab === "account" && (
        <div className="grid grid-cols-1 gap-6">
          <div>
            <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
              <i className="fas fa-lock text-gray-500"></i> Current Password
            </p>
            <div className="relative">
              <input
                type={showPassword.current ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:ring focus:ring-brand-300 dark:bg-gray-800 dark:text-white/90"
              />
              <button
                type="button"
                onClick={() => togglePassword("current")}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              >
                <i
                  className={`fas ${
                    showPassword.current ? "fa-eye" : "fa-eye-slash"
                  }`}
                ></i>
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
              <i className="fas fa-lock text-gray-500"></i> New Password
            </p>
            <div className="relative">
              <input
                type={showPassword.new ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:ring focus:ring-brand-300 dark:bg-gray-800 dark:text-white/90"
              />
              <button
                type="button"
                onClick={() => togglePassword("new")}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              >
                <i
                  className={`fas ${
                    showPassword.new ? "fa-eye" : "fa-eye-slash"
                  }`}
                ></i>
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-2 text-base font-medium text-gray-600 dark:text-gray-400">
              <i className="fas fa-lock text-gray-500"></i> Confirm Password
            </p>
            <div className="relative">
              <input
                type={showPassword.confirm ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 py-2 pr-10 text-sm border rounded-lg focus:ring focus:ring-brand-300 dark:bg-gray-800 dark:text-white/90"
              />
              <button
                type="button"
                onClick={() => togglePassword("confirm")}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              >
                <i
                  className={`fas ${
                    showPassword.confirm ? "fa-eye" : "fa-eye-slash"
                  }`}
                ></i>
              </button>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button
              onClick={handleChangePassword}
              className="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium text-white shadow bg-[#0071E3] hover:bg-[#005bb5] disabled:opacity-60 transition-colors"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <span className="flex items-center justify-center w-[160px]">
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 
             5.373 0 12h4zm2 5.291A7.962 7.962 
             0 014 12H0c0 3.042 1.135 5.824 
             3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
              ) : (
                <span className="flex items-center justify-center w-[160px] gap-2">
                  <i className="fa-solid fa-pen-to-square"></i> Change Password
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
