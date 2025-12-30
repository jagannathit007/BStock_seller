import toastHelper from '../../utils/toastHelper';
import api from "../api/api";
import { env } from '../../utils/env';

export interface User {
  _id: string;
  name: string;
  email: string;
  isEmailVerified: boolean;
  role: string;
}

export interface AuthResponse {
  status: number;
  message: string;
  data?: {
    token?: string;
    customer?: User;
    seller?: any;
  };
}

export interface RegisterRequest {
  name: string;
  email: string;
  password?: string;
  socialId?: string;
  platformName?: string;
  mobileNumber?: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
  socialId?: string;
  platformName?: string;
}

export interface ProfileData {
  businessName?: string;
  country?: string;
  currencyCode?: string;
  address?: string;
  name?: string;
  email?: string;
  mobileNumber?: string;
  mobileCountryCode?: string;
  logo?: File | string | null;
  certificate?: File | string | null;
  profileImage?: File | string | null;
  submitForApproval?: boolean;
}

export interface BusinessProfile {
  businessName?: string | null;
  country?: string | null;
  address?: string | null;
  logo?: string | null;
  certificate?: string | null;
  status?: string | null;
  verifiedBy?: string | null;
  approvedBy?: string | null;
}

export interface UserProfile {
  name?: string;
  email?: string;
  mobileNumber?: string;
  businessProfile?: BusinessProfile;
}

export interface ProfileResponse<T = any> {
  status: number;
  message: string;
  data?: T;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class EmailNotVerifiedError extends Error {
  constructor(message = "Email is not verified. Please check your inbox.") {
    super(message);
    this.name = "EmailNotVerifiedError";
  }
}

import { STORAGE_KEYS, StorageService } from '../../constants/storage';

function persistSession(token?: string, user?: User): void {
  if (token) StorageService.setItem(STORAGE_KEYS.TOKEN, token);
  if (user) StorageService.setItem(STORAGE_KEYS.USER, user);
}

function clearSession(): void {
  StorageService.removeItem(STORAGE_KEYS.TOKEN);
  StorageService.removeItem(STORAGE_KEYS.USER);
}

export class AuthService {
  static register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    const baseUrl = env.baseUrl;
    const url = `${baseUrl}/api/seller/register`;

    try {
      const res = await api.post(url, userData);
      toastHelper.showTost(res.data.message || 'Registration successful!', 'success');
      return res.data as AuthResponse;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to register';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static resendVerificationEmail = async (email: string): Promise<AuthResponse> => {
    const baseUrl = env.baseUrl;
    const candidatePaths = [
      ...env.resendVerificationPaths,
      '/api/seller/verify-email/resend',
      '/api/seller/resend-verification-email',
      '/api/seller/resend-verification',
      '/api/seller/send-verification-email',
      '/api/auth/resend-verification',
    ];

    let lastError: any = null;
    for (const path of candidatePaths) {
      const url = `${baseUrl}${path}`;
      try {
        const res = await api.post(url, { email });
        const data: AuthResponse = res.data;
        toastHelper.showTost(data.message || 'Verification email sent', 'success');
        return data;
      } catch (postErr: any) {
        try {
          const getUrl = `${url}?email=${encodeURIComponent(email)}`;
          const res = await api.get(getUrl);
          const data: AuthResponse = res.data;
          toastHelper.showTost(data.message || 'Verification email sent', 'success');
          return data;
        } catch (getErr: any) {
          lastError = getErr || postErr;
          continue;
        }
      }
    }

    const fallbackMessage = lastError?.response?.data?.message || 'Verification email endpoint not available';
    toastHelper.showTost(fallbackMessage, 'error');
    throw new Error(fallbackMessage);
  };

  static verifyEmail = async (token: string): Promise<AuthResponse> => {
    const baseUrl = env.baseUrl;
    const url = `${baseUrl}/api/seller/verify-email/${token}`;
    
    try {
      const res = await api.get(url);
      
      // Check if verification was successful
      if (res.data.status === 200) {
        toastHelper.showTost(res.data.message || 'Email verified successfully!', 'success');
        return res.data;
      } else {
        // If status is not 200, treat as error
        const errorMessage = res.data.message || 'Failed to verify email';
        toastHelper.showTost(errorMessage, 'error');
        throw new Error(errorMessage);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to verify email';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static login = async (loginData: LoginRequest): Promise<AuthResponse> => {
    const baseUrl = env.baseUrl;
    const url = `${baseUrl}/api/seller/login`;

    try {
      const res = await api.post(url, loginData);
      const data: AuthResponse = res.data;
      const user = (data?.data as any)?.customer || (data?.data as any)?.seller;
      const token = data?.data?.token;


      const backendMessage = (res as any)?.data?.message?.toString().toLowerCase() || '';
      if (backendMessage.includes('verify') && backendMessage.includes('email')) {
        throw new EmailNotVerifiedError(data.message);
      }

      if (data.status === 200 && token && user) {
        clearSession();
        persistSession(token, user);
        toastHelper.showTost(data.message || 'Login successful!', 'success');
        return data;
      }

      const warnMessage = data.message || 'Invalid credentials';
      toastHelper.showTost(warnMessage, 'warning');
      return data;
    } catch (err: any) {
      if (err instanceof EmailNotVerifiedError) {
        throw err;
      }
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to login';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static getProfile = async (): Promise<ProfileResponse<UserProfile>> => {
    const baseUrl = env.baseUrl;
    try {
      const url = `${baseUrl}/api/seller/getProfile`;
      const res = await api.post(url, {});
      return res.data as ProfileResponse<UserProfile>;
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load profile';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static updateProfile = async (payload: ProfileData): Promise<ProfileResponse> => {
    const baseUrl = env.baseUrl;


    // Check if we have files to upload
    const hasFiles = payload.logo instanceof File || payload.certificate instanceof File || payload.profileImage instanceof File;
    
    if (hasFiles) {
      // Use FormData for file uploads
      const form = new FormData();
      
      // Always include these fields, even if empty, so backend can clear them
      form.append('businessName', payload.businessName || '');
      form.append('country', payload.country || '');
      form.append('currencyCode', payload.currencyCode || '');
      form.append('address', payload.address || '');
      form.append('name', payload.name || '');
      form.append('email', payload.email || '');
      form.append('mobileNumber', payload.mobileNumber || '');
      form.append('mobileCountryCode', payload.mobileCountryCode || '');
      // Include submitForApproval flag if provided
      if (payload.submitForApproval !== undefined) {
        form.append('submitForApproval', payload.submitForApproval.toString());
      }

      if (payload.logo instanceof File) {
        form.append('logo', payload.logo);
      } else if (typeof payload.logo === 'string') {
        form.append('logo', payload.logo);
      }

      if (payload.certificate instanceof File) {
        form.append('certificate', payload.certificate);
      } else if (typeof payload.certificate === 'string') {
        form.append('certificate', payload.certificate);
      }

      if (payload.profileImage instanceof File) {
        form.append('profileImage', payload.profileImage);
      } else if (typeof payload.profileImage === 'string') {
        form.append('profileImage', payload.profileImage);
      }

      try {
        const url = `${baseUrl}/api/seller/updateBusinessProfile`;
        
        const res = await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        
        toastHelper.showTost(res.data?.message || 'Profile updated successfully', 'success');
        return res.data as ProfileResponse;
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Failed to update profile';
        toastHelper.showTost(errorMessage, 'error');
        throw new Error(errorMessage);
      }
    } else {
      // Use JSON for non-file updates
      const jsonPayload: any = {
        businessName: payload.businessName || '',
        country: payload.country || '',
        currencyCode: payload.currencyCode || '',
        address: payload.address || '',
        name: payload.name || '',
        email: payload.email || '',
        mobileNumber: payload.mobileNumber || '',
        mobileCountryCode: payload.mobileCountryCode || ''
      };
      // Include submitForApproval flag if provided
      if (payload.submitForApproval !== undefined) {
        jsonPayload.submitForApproval = payload.submitForApproval;
      }

      try {
        const url = `${baseUrl}/api/seller/updateBusinessProfile`;
        
        const res = await api.post(url, jsonPayload, { 
          headers: { 'Content-Type': 'application/json' } 
        });
        
        toastHelper.showTost(res.data?.message || 'Profile updated successfully', 'success');
        return res.data as ProfileResponse;
      } catch (err: any) {
        const errorMessage = err.response?.data?.message || 'Failed to update profile';
        toastHelper.showTost(errorMessage, 'error');
        throw new Error(errorMessage);
      }
    }
  };

  static changePassword = async (
    payload: ChangePasswordRequest
  ): Promise<ProfileResponse> => {
    const baseUrl = env.baseUrl;
    try {
      const url = `${baseUrl}/api/seller/change-password`;
      const res = await api.post(url, payload);
      const data: ProfileResponse = res.data;

      if (data.status == 200 && data.data) {
        toastHelper.showTost(data.message || 'Password changed successfully', 'success');
        return data.data;
      } else {
        const errorMessage = data.message || 'Failed to change password';
        toastHelper.showTost(errorMessage, 'warning');
        return data.data;
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to change password';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}