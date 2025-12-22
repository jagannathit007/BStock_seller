import  { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { AuthService } from "../../services/auth/auth.services";
import AuthPageLayout from "./AuthPageLayout";
import { STORAGE_KEYS, StorageService } from "../../constants/storage";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setError("Invalid verification link - no token found");
        setIsLoading(false);
        return;
      }

      try {
        const res = await AuthService.verifyEmail(token);
        
        // Handle response structure: backend returns { status, message, data: { token, seller } }
        // The AuthService returns res.data which is the axios response data
        const responseData = res;
        const tokenValue = responseData?.data?.token;
        
        // Check if verification was successful (status 200)
        if (responseData?.status === 200) {
          if (tokenValue) {
            // Store token and show success
            StorageService.setItem(STORAGE_KEYS.TOKEN, tokenValue);
            setSuccess(true);
            setTimeout(() => navigate("/signin"), 2000);
          } else if (responseData?.message?.toLowerCase().includes('verified')) {
            // Verification succeeded but no token (already verified case)
            setSuccess(true);
            setTimeout(() => navigate("/signin"), 2000);
          } else {
            // Success status but no token - might be an issue
            setError(responseData?.message || "Verification completed but token not received. Please try logging in.");
          }
        } else {
          // Non-200 status means error
          setError(responseData?.message || "Verification failed. Please try again.");
        }
      } catch (err: any) {
        // Extract error message from various possible locations
        const errorMessage = err.response?.data?.message || 
                           err.message || 
                           "Verification failed. The link may be invalid or expired.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <>
      <AuthPageLayout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md p-6">
            {isLoading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-700 text-lg">Verifying your email...</p>
              </div>
            ) : success ? (
              <>
                <div className="text-green-600 text-6xl mb-4">✓</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified Successfully!</h1>
                <p className="text-gray-600 mb-6">Your account is now active. Redirecting to sign in...</p>
                <Link
                  to="/signin"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                >
                  Go to Sign In
                </Link>
              </>
            ) : (
              <>
                <div className="text-red-600 text-6xl mb-4">⚠</div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
                <p className="text-gray-600 mb-6">{error}</p>
                <div className="space-y-4">
                  <Link
                    to="/signin"
                    className="block w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium text-center hover:bg-indigo-700 transition-colors"
                  >
                    Back to Sign In
                  </Link>
                  <p className="text-sm text-gray-500">
                    Link expired or didn't receive the email?{" "}
                    <Link 
                      to={`/verify-notice?email=${encodeURIComponent('')}`} 
                      className="text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Resend Verification Email
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </AuthPageLayout>
    </>
  );
}


