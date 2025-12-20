import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CascadingVariantSelector, { VariantOption } from '../../components/products/CascadingVariantSelector';
import ExcelLikeProductForm, { ProductRowData } from '../../components/products/ExcelLikeProductForm';
import { ProductService } from '../../services/products/products.services';
import toastHelper from '../../utils/toastHelper';

type PageStep = 'variant-selection' | 'variant-config' | 'form';

const ProductVariantForm: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');
  const editId = searchParams.get('editId');
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [editProducts, setEditProducts] = useState<any[]>([]); // For multi-variant products
  const [loadingProduct, setLoadingProduct] = useState(false);
  
  // Initialize step and variantType based on URL parameter
  const getInitialStep = (): PageStep => {
    if (editId) {
      return 'form'; // Go directly to form when editing
    }
    if (typeParam === 'single' || typeParam === 'multi') {
      return 'form'; // Go directly to form when type is specified
    }
    return 'variant-selection';
  };

  const getInitialVariantType = (): 'single' | 'multi' | null => {
    if (editId) {
      // Will be determined after loading product
      return null;
    }
    if (typeParam === 'single') {
      return 'single';
    }
    if (typeParam === 'multi') {
      return 'multi';
    }
    return null;
  };

  const [step, setStep] = useState<PageStep>(getInitialStep());
  const [variantType, setVariantType] = useState<'single' | 'multi' | null>(getInitialVariantType());
  const [selectedVariants, setSelectedVariants] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Load product data when editing
  useEffect(() => {
    const loadProductForEdit = async () => {
      if (!editId) return;
      
      try {
        setLoadingProduct(true);
        const response = await ProductService.get({ id: editId });
        const product = response.data;
        
        console.log('Loaded product for edit:', product);
        
        if (!product) {
          toastHelper.showTost('Product not found', 'error');
          navigate('/products');
          return;
        }
        
        // Check if it's a multi-variant product (has groupCode)
        const groupCode = (product as any).groupCode;
        if (groupCode) {
          // Load all products with the same groupCode
          const listResponse = await ProductService.list({ page: 1, limit: 1000 });
          const allProducts = listResponse.data?.docs || listResponse.data || [];
          const groupedProducts = Array.isArray(allProducts) 
            ? allProducts.filter((p: any) => p.groupCode === groupCode)
            : [];
          
          setEditProducts(groupedProducts);
          setVariantType('multi');
          
          // Set variants from products
          const variants: VariantOption[] = groupedProducts.map((p: any) => {
            const skuFamily = typeof p.skuFamilyId === 'object' ? p.skuFamilyId : null;
            // Get subModelName from specification
            let subModelName = '';
            if (p.specification) {
              subModelName = p.specification;
            } else if (skuFamily && (skuFamily as any).subSkuFamilies && Array.isArray((skuFamily as any).subSkuFamilies)) {
              const matchingSubSku = (skuFamily as any).subSkuFamilies.find((sub: any) => sub.subName);
              if (matchingSubSku && matchingSubSku.subName) {
                subModelName = matchingSubSku.subName;
              }
            }
            return {
              skuFamilyId: typeof p.skuFamilyId === 'object' ? p.skuFamilyId._id : p.skuFamilyId,
              subModelName: subModelName,
              storage: p.storage || '',
              color: p.color || '',
              ram: p.ram || '',
            };
          });
          setSelectedVariants(variants);
        } else {
          // Single variant product
          console.log('Setting single variant product:', product);
          setEditProduct(product);
          // Also set editProducts array for single variant so ExcelLikeProductForm can detect edit mode
          setEditProducts([product]);
          setVariantType('single');
          
          const skuFamily = typeof product.skuFamilyId === 'object' ? product.skuFamilyId : null;
          // Get subModelName from specification or find matching subSkuFamily
          let subModelName = '';
          if (product.specification) {
            subModelName = product.specification;
          } else if (skuFamily && (skuFamily as any).subSkuFamilies && Array.isArray((skuFamily as any).subSkuFamilies)) {
            const matchingSubSku = (skuFamily as any).subSkuFamilies.find((sub: any) => sub.subName);
            if (matchingSubSku && matchingSubSku.subName) {
              subModelName = matchingSubSku.subName;
            }
          }
          const variant = {
            skuFamilyId: typeof product.skuFamilyId === 'object' ? product.skuFamilyId._id : product.skuFamilyId,
            subModelName: subModelName,
            storage: product.storage || '',
            color: product.color || '',
            ram: product.ram || '',
          };
          console.log('Setting selected variant:', variant);
          setSelectedVariants([variant]);
        }
        
        setStep('form');
        
        // Clear localStorage when editing to prevent conflicts
        try {
          localStorage.removeItem('variant-product-form-data');
        } catch (error) {
          console.error('Error clearing localStorage:', error);
        }
      } catch (error: any) {
        console.error('Error loading product for edit:', error);
        toastHelper.showTost(error.message || 'Failed to load product', 'error');
        navigate('/products');
      } finally {
        setLoadingProduct(false);
      }
    };
    
    loadProductForEdit();
  }, [editId, navigate]);
  
  // For multi variant, initialize with empty variant to allow form entry (only if not editing)
  useEffect(() => {
    if (!editId && variantType === 'multi' && typeParam === 'multi' && selectedVariants.length === 0) {
      // Create an empty variant to allow form entry
      setSelectedVariants([{
        skuFamilyId: '',
        subModelName: '',
        storage: '',
        color: '',
        ram: '',
      }]);
    }
  }, [variantType, typeParam, selectedVariants.length, editId]);

  const handleVariantSelection = (type: 'single' | 'multi') => {
    setVariantType(type);
    if (type === 'single') {
      setStep('form');
    } else {
      // For multi-variant, check if variants are already selected from modal
      const savedVariants = sessionStorage.getItem('multiVariantSelectedVariants');
      if (savedVariants) {
        try {
          const parsed = JSON.parse(savedVariants);
          setSelectedVariants(parsed);
          setStep('form');
          sessionStorage.removeItem('multiVariantSelectedVariants');
        } catch (error) {
          console.error('Failed to parse saved variants:', error);
          setStep('variant-config');
          sessionStorage.removeItem('multiVariantSelectedVariants');
        }
      } else {
        setStep('variant-config');
      }
    }
  };

  const handleVariantsSelected = (variants: VariantOption[]) => {
    setSelectedVariants(variants);
    if (variants.length > 0) {
      setStep('form');
    }
  };

  // Helper function to validate ObjectId
  const isValidObjectId = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  const handleFormSave = async (rows: ProductRowData[], totalMoq?: number | string) => {
    try {
      setLoading(true);
      
      // Validate all required IDs before processing
      const validationErrors: string[] = [];
      rows.forEach((row, index) => {
        if (!row.skuFamilyId || !isValidObjectId(row.skuFamilyId)) {
          validationErrors.push(`Row ${index + 1}: Invalid or missing SKU Family ID`);
        }
        if (row.grade && !isValidObjectId(row.grade)) {
          validationErrors.push(`Row ${index + 1}: Invalid Grade ID`);
        }
      });

      if (validationErrors.length > 0) {
        toastHelper.showTost(
          `Validation errors:\n${validationErrors.join('\n')}`,
          'error'
        );
        setLoading(false);
        return;
      }
      
      // Transform rows to backend format and create products
      const productsToCreate = rows.map(row => {
        // Build countryDeliverables array
        const countryDeliverables: any[] = [];
        
        // Helper to convert empty strings to null
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        if (row.hkUsd || row.hkHkd) {
          countryDeliverables.push({
            country: 'Hongkong',
            price: parseFloat(String(row.hkUsd)) || 0,
            usd: parseFloat(String(row.hkUsd)) || 0,
            xe: parseFloat(String(row.hkXe)) || 0,
            local: parseFloat(String(row.hkHkd)) || 0,
            hkd: parseFloat(String(row.hkHkd)) || 0,
            paymentTerm: cleanString(row.paymentTerm) || null,
            paymentMethod: cleanString(row.paymentMethod) || null,
          });
        }
        
        if (row.dubaiUsd || row.dubaiAed) {
          countryDeliverables.push({
            country: 'Dubai',
            price: parseFloat(String(row.dubaiUsd)) || 0,
            usd: parseFloat(String(row.dubaiUsd)) || 0,
            xe: parseFloat(String(row.dubaiXe)) || 0,
            local: parseFloat(String(row.dubaiAed)) || 0,
            aed: parseFloat(String(row.dubaiAed)) || 0,
            paymentTerm: cleanString(row.paymentTerm) || null,
            paymentMethod: cleanString(row.paymentMethod) || null,
          });
        }

        // Helper to normalize color to match enum values
        const normalizeColor = (color: string | null | undefined): string | null => {
          if (!color) return null;
          const colorUpper = color.toUpperCase().trim();
          // Map common color values to enum values
          const colorMap: Record<string, string> = {
            'GRAPHITE': 'Graphite',
            'SILVER': 'Silver',
            'GOLD': 'Gold',
            'SIERRA BLUE': 'Sierra Blue',
            'MIXED': 'Mixed',
          };
          return colorMap[colorUpper] || color; // Return mapped value or original if not in map
        };

        // Helper to normalize country to match enum values
        const normalizeCountry = (country: string | null | undefined): string | null => {
          if (!country) return null;
          const countryUpper = country.toUpperCase().trim();
          // Map common country codes/values to enum values
          if (countryUpper === 'HK' || countryUpper === 'HONGKONG' || countryUpper === 'HONG KONG') {
            return 'Hongkong';
          }
          if (countryUpper === 'D' || countryUpper === 'DUBAI' || countryUpper === 'USA') {
            return 'Dubai';
          }
          return country; // Return original if already correct format
        };

        return {
          skuFamilyId: row.skuFamilyId, // Already validated above - required field
          gradeId: (row.grade && isValidObjectId(row.grade)) ? row.grade : null,
          specification: cleanString(row.subModelName) || cleanString(row.version) || cleanString((row as any).specification) || '',
          simType: row.sim || '',
          color: normalizeColor(row.colour) || null,
          ram: cleanString(row.ram) || '',
          storage: row.storage || '',
          weight: row.weight ? parseFloat(String(row.weight)) : null,
          condition: cleanString(row.condition) || null,
          price: parseFloat(String(row.hkUsd || row.dubaiUsd || 0)),
          stock: parseFloat(String(row.totalQty)) || 0,
          country: normalizeCountry(cleanString(row.country)) || null,
          moq: parseFloat(String(row.moqPerVariant)) || 1,
          purchaseType: (row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : 'partial',
          isNegotiable: row.negotiableFixed === '1',
          // Use flashDeal field from form (code value from constants), convert to boolean string
          // Assuming code '1' or 'true' means flash deal enabled, empty or '0'/'false' means disabled
          isFlashDeal: row.flashDeal && (row.flashDeal === '1' || row.flashDeal === 'true' || row.flashDeal.toLowerCase() === 'yes') ? 'true' : 'false',
          startTime: cleanString(row.startTime) ? new Date(row.startTime).toISOString() : '',
          expiryTime: cleanString(row.endTime) ? new Date(row.endTime).toISOString() : '',
          groupCode: variantType === 'multi' 
            ? (editId && editProducts.length > 0 ? (editProducts[0] as any).groupCode : (row.groupCode || `GROUP-${Date.now()}`))
            : undefined,
          sequence: row.sequence || null,
          countryDeliverables,
          // Additional fields that need to be stored - convert empty strings to null
          supplierListingNumber: cleanString(row.supplierListingNumber) || '',
          packing: cleanString(row.packing) || '',
          currentLocation: cleanString(row.currentLocation) || '',
          deliveryLocation: Array.isArray(row.deliveryLocation) 
            ? row.deliveryLocation 
            : (row.deliveryLocation && typeof row.deliveryLocation === 'string' 
                ? (() => {
                    try {
                      const parsed = JSON.parse(row.deliveryLocation);
                      return Array.isArray(parsed) ? parsed : [row.deliveryLocation];
                    } catch {
                      return [row.deliveryLocation];
                    }
                  })()
                : []),
          customMessage: cleanString(row.customMessage) || '',
          totalMoq: variantType === 'multi' && totalMoq ? parseFloat(String(totalMoq)) : null,
          paymentTerm: cleanString(row.paymentTerm) || null,
          paymentMethod: cleanString(row.paymentMethod) || null,
          shippingTime: cleanString(row.shippingTime) || '',
          vendor: cleanString(row.vendor) || null,
          vendorListingNo: cleanString(row.vendorListingNo) || '',
          carrier: cleanString(row.carrier) || null,
          carrierListingNo: cleanString(row.carrierListingNo) || '',
          uniqueListingNo: cleanString(row.uniqueListingNo) || '',
          tags: cleanString(row.tags) || '',
          adminCustomMessage: cleanString(row.adminCustomMessage) || '',
          remark: cleanString(row.remark) || '',
          warranty: cleanString(row.warranty) || '',
          batteryHealth: cleanString(row.batteryHealth) || '',
          lockUnlock: row.lockUnlock === '1',
        };
      });

      // Update or create products
      if (editId) {
        // Update existing products
        if (variantType === 'single' && editProduct?._id) {
          // Single variant update - map to seller update format
          const productData = productsToCreate[0];
          await ProductService.update({
            id: editProduct._id,
            skuFamilyId: productData.skuFamilyId,
            specification: productData.specification || '',
            simType: productData.simType || '',
            color: productData.color || undefined,
            ram: productData.ram || '',
            storage: productData.storage || '',
            condition: productData.condition || '',
            price: productData.price || 0,
            stock: productData.stock || 0,
            country: productData.country || undefined,
            moq: productData.moq || 1,
            isNegotiable: productData.isNegotiable || false,
            isFlashDeal: productData.isFlashDeal === 'true',
            purchaseType: productData.purchaseType || 'partial',
            expiryTime: productData.expiryTime || undefined,
          });
          toastHelper.showTost('Product updated successfully!', 'success');
        } else if (variantType === 'multi' && editProducts.length > 0) {
          // Multi variant update - update all products in the group
          const updatePromises = editProducts.map((editProd, index) => {
            if (editProd._id && productsToCreate[index]) {
              const productData = productsToCreate[index];
              return ProductService.update({
                id: editProd._id,
                skuFamilyId: productData.skuFamilyId,
                specification: productData.specification || '',
                simType: productData.simType || '',
                color: productData.color || undefined,
                ram: productData.ram || '',
                storage: productData.storage || '',
                condition: productData.condition || '',
                price: productData.price || 0,
                stock: productData.stock || 0,
                country: productData.country || undefined,
                moq: productData.moq || 1,
                isNegotiable: productData.isNegotiable || false,
                isFlashDeal: productData.isFlashDeal === 'true',
                purchaseType: productData.purchaseType || 'partial',
                expiryTime: productData.expiryTime || undefined,
              });
            }
            return Promise.resolve();
          });
          await Promise.all(updatePromises);
          toastHelper.showTost('Products updated successfully!', 'success');
        }
        
        // Navigate back to products list after successful update
        setTimeout(() => {
          navigate('/products');
        }, 1000);
      } else {
        // NOTE: Products are created in ExcelLikeProductForm.handleDirectSubmit
        // This function should only handle navigation, not create products again
        // to avoid duplicate product creation
        
        // Navigate to products list
        // Products are already created by ExcelLikeProductForm, so we just navigate
        navigate('/products');
      }
      
      // Clear localStorage on successful save
      try {
        localStorage.removeItem('variant-product-form-data');
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
    } catch (error: any) {
      console.error('Error creating product requests:', error);
      toastHelper.showTost(error.message || 'Failed to create product requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      // Both single and multi go back to products list when coming from type param
      if (typeParam === 'single' || typeParam === 'multi') {
        navigate('/products');
      } else {
        if (variantType === 'multi') {
          setStep('variant-config');
        } else {
          setStep('variant-selection');
        }
      }
    } else if (step === 'variant-config') {
      setStep('variant-selection');
    }
  };

  const handleCancel = () => {
    navigate('/products');
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 overflow-y-auto">
      {/* Variant Selection Step - Only shown if no type param (shouldn't happen with modal) */}
      {step === 'variant-selection' && !typeParam && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-6xl">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                      <i className="fas fa-boxes text-white text-2xl"></i>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
                        Create New Product Request
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose your listing type to get started
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 hover:scale-110"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      )}

      {/* Multi-Variant Configuration Step */}
      {step === 'variant-config' && (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-7xl">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm">
              <div className="bg-purple-600 dark:bg-purple-800 p-6 border-b-2 border-purple-500 dark:border-purple-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                      <i className="fas fa-layer-group text-white text-xl"></i>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Multi-Variant Configuration
                      </h2>
                      <p className="text-purple-100 text-sm mt-1">
                        Select models, storage, and colors to generate product variants
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <CascadingVariantSelector onVariantsSelected={handleVariantsSelected} />
                {selectedVariants.length > 0 && (
                  <div className="mt-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="px-5 py-2.5 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-sm font-medium transition-all duration-200 flex items-center gap-2"
                    >
                      <i className="fas fa-arrow-left"></i>
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('form')}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg font-semibold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                    >
                      <i className="fas fa-arrow-right"></i>
                      Continue to Form
                      <span className="ml-1 px-2.5 py-0.5 bg-white/30 rounded-full text-sm font-bold">
                        {selectedVariants.length}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Step - Full Width and Height */}
      {step === 'form' && (
        <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
          <div className="flex-shrink-0 bg-blue-600 dark:bg-blue-800 px-5 py-2 border-b-2 border-blue-500 dark:border-blue-700 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 dark:bg-white/10 rounded-lg flex items-center justify-center">
                  <i className="fas fa-table text-white text-xl"></i>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {variantType === 'multi' ? 'Multi-Variant Product Form' : 'Single Variant Product Form'}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1 flex items-center gap-2">
                    <i className="fas fa-info-circle text-xs"></i>
                    Excel-like interface • Scroll horizontally to see all columns
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {loading || loadingProduct || (editId && !variantType) ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {loadingProduct ? 'Loading product...' : 'Creating product requests...'}
                  </p>
                </div>
              </div>
            ) : (
              <ExcelLikeProductForm
                variantType={variantType!}
                variants={selectedVariants}
                onSave={handleFormSave}
                onCancel={handleCancel}
                editProducts={editProducts}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantForm;
