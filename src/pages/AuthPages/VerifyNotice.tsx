import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import { Link, useLocation } from "react-router";
import { useMemo, useState } from "react";
import { AuthService } from "../../services/auth/auth.services";
import toastHelper from "../../utils/toastHelper";

export default function VerifyNotice() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const email = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('email') || '';
  }, [location.search]);

  const handleResend = async () => {
    const emailToUse = email || emailInput.trim();
    if (!emailToUse) {
      toastHelper.warning('Please enter your email address');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      toastHelper.warning('Please enter a valid email address');
      return;
    }
    
    try {
      setLoading(true);
      await AuthService.resendVerificationEmail(emailToUse);
      toastHelper.success('Verification email sent successfully!');
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to resend email';
      toastHelper.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta title="Verify Your Email" description="Please verify your email address" />
      <AuthLayout>
        <div className="flex flex-col items-center justify-center w-full py-16 px-4">
          <h1 className="mb-3 text-xl font-semibold text-gray-800 dark:text-white/90">Verify your email</h1>
          <p className="max-w-md text-center text-gray-600 dark:text-gray-400 mb-6">
            We have sent a verification link to your email. Please click the link to
            verify your account before signing in.
          </p>
          
          {!email && (
            <div className="w-full max-w-md mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enter your email address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0071E0] focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleResend();
                  }
                }}
              />
            </div>
          )}
          
          {email && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Email: <span className="font-medium">{email}</span>
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleResend}
              disabled={loading || (!email && !emailInput.trim())}
              className="px-4 py-2 text-white rounded bg-[#0071E0] hover:bg-[#005bb8] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Resend verification email'}
            </button>
            <Link
              to="/signin"
              className="px-4 py-2 text-white rounded bg-gray-600 hover:bg-gray-700"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}


