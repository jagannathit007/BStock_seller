import { useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import PageMeta from "../components/common/PageMeta";
import { AuthService } from "../services/auth/auth.services";
import { STORAGE_KEYS, StorageService } from "../constants/storage";

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

export default function UserProfiles() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    countryCode: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    businessName: "",
    businessCountry: "",
    businessCurrency: "",
    businessAddress: "",
  });

  useEffect(() => {
    // Load from localStorage as a fast-first render
    try {
      const stored = StorageService.getItem(STORAGE_KEYS.USER);
      if (stored) {
        const user = stored as any;
        const business = user?.businessProfile || {};
        setFormData((prev) => ({
          ...prev,
          name: user?.name || "",
          email: user?.email || "",
          countryCode: user?.mobileCountryCode || "",
          phone: user?.mobileNumber || "",
          businessName: business?.businessName || "",
          businessCountry: business?.country || "",
          businessCurrency: business?.currencyCode || business?.currency || "",
          businessAddress: business?.address || "",
        }));
      }
    } catch {}

    // Then fetch fresh profile from API
    (async () => {
      try {
      const profile = await AuthService.getProfile();
      const p: any = profile?.data || {};
      const bp = p?.businessProfile || {};
      setFormData((prev) => ({
        ...prev,
        name: p?.name ?? prev.name,
        email: p?.email ?? prev.email,
        countryCode: p?.mobileCountryCode ?? prev.countryCode,
        phone: p?.mobileNumber ?? prev.phone,
        businessName: bp?.businessName ?? p?.businessName ?? prev.businessName,
        businessCountry: bp?.country ?? p?.country ?? prev.businessCountry,
        businessCurrency: bp?.currencyCode ?? bp?.currency ?? p?.currency ?? prev.businessCurrency,
        businessAddress: bp?.address ?? p?.address ?? prev.businessAddress,
      }));

      // Update localStorage user in sync
      try {
        const stored = StorageService.getItem(STORAGE_KEYS.USER);
        const prevUser = (stored as any) || {};
        const bp = p?.businessProfile || {};
        const merged = {
          ...prevUser,
          name: p?.name ?? prevUser?.name,
          email: p?.email ?? prevUser?.email,
          mobileNumber: p?.mobileNumber ?? prevUser?.mobileNumber,
          mobileCountryCode: p?.mobileCountryCode ?? prevUser?.mobileCountryCode,
          businessProfile: {
            ...(prevUser?.businessProfile || {}),
            businessName: bp?.businessName ?? p?.businessName ?? prevUser?.businessProfile?.businessName,
            country: bp?.country ?? p?.country ?? prevUser?.businessProfile?.country,
            currencyCode: bp?.currencyCode ?? bp?.currency ?? p?.currency ?? prevUser?.businessProfile?.currencyCode,
            currency: bp?.currencyCode ?? bp?.currency ?? p?.currency ?? prevUser?.businessProfile?.currency,
            address: bp?.address ?? p?.address ?? prevUser?.businessProfile?.address,
            logo: bp?.logo ?? p?.logo ?? prevUser?.businessProfile?.logo,
            certificate: bp?.certificate ?? p?.certificate ?? prevUser?.businessProfile?.certificate,
            status: bp?.status ?? prevUser?.businessProfile?.status,
            verifiedBy: bp?.verifiedBy ?? prevUser?.businessProfile?.verifiedBy,
            approvedBy: bp?.approvedBy ?? prevUser?.businessProfile?.approvedBy,
          },
        };
        StorageService.setItem(STORAGE_KEYS.USER, merged);
      } catch {}
      } catch {}
    })();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <PageMeta
        title="React.js Profile Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Profile Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Profile" />
      <div className="lg:p-0">
        <div className="space-y-6">
          {/* <UserMetaCard name={formData.name} /> */}
          <UserInfoCard formData={formData} handleChange={handleChange} />
        </div>
      </div>
    </>
  );
}
