import React from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { STORAGE_KEYS, StorageService } from '../../constants/storage';
import { AuthService } from '../../services/auth/auth.services';

interface VariantSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleVariantSelection = async (type: 'single' | 'multi') => {
    // Check business profile approval status before navigating
    try {
      // First check localStorage
      const stored = StorageService.getItem(STORAGE_KEYS.USER);
      let businessProfileStatus = stored?.businessProfile?.status;
      
      // If not in localStorage or status is not approved, fetch fresh profile
      if (!businessProfileStatus || businessProfileStatus !== 'approved') {
        const profile = await AuthService.getProfile();
        businessProfileStatus = profile?.data?.businessProfile?.status;
      }
      
      if (businessProfileStatus !== 'approved') {
        // Show confirmation/info box instead of error
        await Swal.fire({
          icon: "info",
          title: "Business Profile Approval Required",
          html: `<p style="text-align: left; margin: 10px 0;">Your business profile must be approved by admin before you can create products. Please wait for admin approval or contact support if you have already submitted your business profile.</p>`,
          confirmButtonText: "OK",
          confirmButtonColor: "#0071E0",
          width: "500px",
        });
        return;
      }
      
      // If approved, navigate to form
      onClose();
      navigate(`/products/create?type=${type}`);
    } catch (error) {
      console.error('Error checking business profile:', error);
      // On error, still navigate (let backend handle the validation)
      onClose();
      navigate(`/products/create?type=${type}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 bg-opacity-50 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 dark:bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <i className="fas fa-boxes text-white text-2xl"></i>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white">
                  Create New Product Request
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  Choose your listing type to get started
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Single Variant Option */}
            <button
              onClick={() => handleVariantSelection('single')}
              className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 text-left transform hover:scale-105 hover:shadow-2xl"
            >
              <div className="absolute top-4 right-4 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <i className="fas fa-check text-blue-600 dark:text-blue-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <i className="fas fa-file-alt text-white text-3xl"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Single Variant
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Create one product listing with a single set of specifications. Perfect for individual products.
                </p>
                <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <i className="fas fa-info-circle mr-1"></i>
                    Best for: Single products
                  </p>
                </div>
              </div>
            </button>

            {/* Multi Variant Option */}
            <button
              onClick={() => handleVariantSelection('multi')}
              className="group relative p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 text-left transform hover:scale-105 hover:shadow-2xl"
            >
              <div className="absolute top-4 right-4 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <i className="fas fa-check text-purple-600 dark:text-purple-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"></i>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                  <i className="fas fa-layer-group text-white text-3xl"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Multi Variant
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Create multiple variants using smart filters. Select models, storage, and colors to auto-generate all combinations.
                </p>
                <div className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <i className="fas fa-bolt mr-1"></i>
                    Best for: Multiple variants
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariantSelectionModal;
