import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import CascadingVariantSelector, { VariantOption } from '../../components/products/CascadingVariantSelector';
import ExcelLikeProductForm, { ProductRowData } from '../../components/products/ExcelLikeProductForm';
import { ProductService } from '../../services/products/products.services';
import { SellerProductPermissionService, SellerProductFieldPermission } from '../../services/sellerProductPermission/sellerProductPermission.services';
import { STORAGE_KEYS, StorageService } from '../../constants/storage';
import { AuthService } from '../../services/auth/auth.services';
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
  const [permissions, setPermissions] = useState<SellerProductFieldPermission[]>([]);
  
  // Get current seller ID from storage
  const getCurrentSellerId = (): string => {
    const user = StorageService.getItem<any>(STORAGE_KEYS.USER);
    return user?._id || user?.id || '';
  };
  
  // Helper function to check if field has permission
  const hasPermission = (fieldName: string): boolean => {
    if (permissions.length === 0) {
      return false;
    }
    const permission = permissions.find(p => p.fieldName === fieldName);
    return permission?.hasPermission ?? false;
  };
  
  // Load permissions on mount
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const sellerPermissions = await SellerProductPermissionService.getCurrentSellerPermissions();
        setPermissions(sellerPermissions || []);
      } catch (error) {
        console.error('Error loading seller permissions:', error);
        setPermissions([]);
      }
    };
    loadPermissions();
  }, []);

  // Helper function to check business profile approval status (REAL CHECK from server)
  const checkBusinessProfileApproval = async (): Promise<boolean> => {
    try {
      // Always fetch fresh profile from server for real check
      const profile = await AuthService.getProfile();
      const businessProfileStatus = profile?.data?.businessProfile?.status;
      
      if (businessProfileStatus !== 'approved') {
        // Show Business Profile Approval Required box
        await Swal.fire({
          icon: "info",
          title: "Business Profile Approval Required",
          html: `<p style="text-align: left; margin: 10px 0;">Your business profile must be approved by admin before you can perform this action. Please wait for admin approval or contact support if you have already submitted your business profile.</p>`,
          confirmButtonText: "OK",
          confirmButtonColor: "#0071E0",
          width: "500px",
        });
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking business profile:', error);
      // On error, show approval box as safety measure
      await Swal.fire({
        icon: "error",
        title: "Error Checking Business Profile",
        html: `<p style="text-align: left; margin: 10px 0;">Unable to verify your business profile status. Please try again or contact support.</p>`,
        confirmButtonText: "OK",
        confirmButtonColor: "#0071E0",
        width: "500px",
      });
      return false;
    }
  };

  // Check business profile approval when editing (REAL CHECK on page load)
  useEffect(() => {
    const verifyBusinessProfileApproval = async () => {
      if (!editId) return;
      
      // FIRST check business profile approval status (REAL CHECK)
      const isApproved = await checkBusinessProfileApproval();
      
      // If not approved, navigate back to products page
      if (!isApproved) {
        navigate('/products');
        return;
      }
    };
    
    verifyBusinessProfileApproval();
  }, [editId, navigate]);
  
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

  const handleFormSave = async (rows: ProductRowData[], totalMoq?: number | string, customColumns?: Array<{ key: string; label: string; width: number }>) => {
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
      
      // Transform rows to backend format - ONLY include fields with permission
      // Helper to normalize paymentTerm to a single valid value (backend only accepts single values)
      // Maps codes to full text values that the validator expects
      const normalizePaymentTerm = (val: string | null | undefined): string | null => {
        if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
        const trimmed = val.trim();
        // If comma-separated, take the first value
        const firstValue = trimmed.split(',')[0].trim();
        
        // Map common codes to full text values (validator expects full text)
        const codeToTextMap: Record<string, string> = {
          'USD_O': 'on order',
          'USD_D': 'on delivery',
          'AED_O': 'on order',
          'AED_D': 'on delivery',
          'HKD_O': 'on order',
          'HKD_D': 'on delivery',
          'USD_CONF': 'as in conformation',
          'AED_CONF': 'as in conformation',
          'HKD_CONF': 'as in conformation',
          'ON_ORDER': 'on order',
          'ON_DELIVERY': 'on delivery',
          'AS_IN_CONFORMATION': 'as in conformation',
        };
        
        // Check if it's a code and map it
        if (codeToTextMap[firstValue]) {
          return codeToTextMap[firstValue];
        }
        
        // Validate against allowed full text values (case-insensitive)
        const allowedValues = ['on order', 'on delivery', 'as in conformation'];
        const lowerFirst = firstValue.toLowerCase();
        const matched = allowedValues.find(v => v.toLowerCase() === lowerFirst);
        return matched || null;
      };
      
      // Helper to normalize country - convert full names to codes (HK or USA)
      // Map Hongkong -> HK, Dubai -> USA
      const normalizeCountry = (country: string | null | undefined): string | null => {
        if (!country) return null;
        const countryTrimmed = country.trim();
        const countryUpper = countryTrimmed.toUpperCase();
        
        // Map full names to codes
        if (countryUpper === 'HONGKONG' || countryUpper === 'HONG KONG') {
          return 'HK';
        } else if (countryUpper === 'DUBAI' || countryUpper === 'UAE') {
          return 'USA';
        } else if (countryUpper === 'HK' || countryUpper === 'USA') {
          // Already a code, use as-is
          return countryTrimmed;
        } else {
          // Unknown value, return as-is (backend will validate)
          return countryTrimmed;
        }
      };
      
      const productsToCreate = rows.map((row, rowIndex) => {
        // Helper to convert empty strings to null
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        // Helper to normalize color to match enum values
        const normalizeColor = (color: string | null | undefined): string | null => {
          if (!color) return null;
          const colorUpper = color.toUpperCase().trim();
          const colorMap: Record<string, string> = {
            'GRAPHITE': 'Graphite',
            'SILVER': 'Silver',
            'GOLD': 'Gold',
            'SIERRA BLUE': 'Sierra Blue',
            'MIXED': 'Mixed',
          };
          return colorMap[colorUpper] || color;
        };
        
        // Build countryDeliverables - only if seller has permission for price fields
        // In edit mode, preserve existing countryDeliverables and update prices
        let countryDeliverables: any[] = [];
        
        // Get existing product for edit mode
        // Match rowIndex with editProducts index for multi-variant, or use editProduct for single
        const existingProduct = editId 
          ? (variantType === 'single' ? editProduct : (editProducts[rowIndex] || null))
          : null;
        
        if (editId && existingProduct && (existingProduct as any).countryDeliverables) {
          // Preserve existing countryDeliverables structure and update prices
          countryDeliverables = (existingProduct as any).countryDeliverables.map((cd: any) => {
            if (cd.country === 'Hongkong' && (hasPermission('hkUsd') || hasPermission('hkHkd'))) {
              return {
                ...cd,
                basePrice: parseFloat(String(row.hkUsd)) || cd.basePrice || cd.usd || 0,
                calculatedPrice: cd.calculatedPrice || parseFloat(String(row.hkUsd)) || cd.usd || 0,
                usd: parseFloat(String(row.hkUsd)) || cd.usd || 0,
                xe: parseFloat(String(row.hkXe)) || cd.xe || 0,
                local: parseFloat(String(row.hkHkd)) || cd.local || cd.hkd || 0,
                hkd: parseFloat(String(row.hkHkd)) || cd.hkd || 0,
                price: parseFloat(String(row.hkUsd)) || cd.price || cd.usd || 0,
                exchangeRate: parseFloat(String(row.hkXe)) || cd.exchangeRate || cd.xe || null,
                // Preserve margins and costs (sellers can't modify these)
                margins: cd.margins || [],
                costs: cd.costs || [],
                charges: cd.charges || [],
                paymentTerm: hasPermission('paymentTerm') ? (normalizePaymentTerm(row.paymentTerm) || normalizePaymentTerm(cd.paymentTerm) || null) : (normalizePaymentTerm(cd.paymentTerm) || null),
                paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || cd.paymentMethod || null) : (cd.paymentMethod || null),
              };
            } else if (cd.country === 'Dubai' && (hasPermission('dubaiUsd') || hasPermission('dubaiAed'))) {
              return {
                ...cd,
                basePrice: parseFloat(String(row.dubaiUsd)) || cd.basePrice || cd.usd || 0,
                calculatedPrice: cd.calculatedPrice || parseFloat(String(row.dubaiUsd)) || cd.usd || 0,
                usd: parseFloat(String(row.dubaiUsd)) || cd.usd || 0,
                xe: parseFloat(String(row.dubaiXe)) || cd.xe || 0,
                local: parseFloat(String(row.dubaiAed)) || cd.local || cd.aed || 0,
                aed: parseFloat(String(row.dubaiAed)) || cd.aed || 0,
                price: parseFloat(String(row.dubaiUsd)) || cd.price || cd.usd || 0,
                exchangeRate: parseFloat(String(row.dubaiXe)) || cd.exchangeRate || cd.xe || null,
                // Preserve margins and costs (sellers can't modify these)
                margins: cd.margins || [],
                costs: cd.costs || [],
                charges: cd.charges || [],
                paymentTerm: hasPermission('paymentTerm') ? (normalizePaymentTerm(row.paymentTerm) || normalizePaymentTerm(cd.paymentTerm) || null) : (normalizePaymentTerm(cd.paymentTerm) || null),
                paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || cd.paymentMethod || null) : (cd.paymentMethod || null),
              };
            }
            // Return unchanged for other countries
            return cd;
          });
        } else {
          // Create new countryDeliverables for create mode or when none exist
          if (hasPermission('hkUsd') || hasPermission('hkHkd')) {
            if (row.hkUsd || row.hkHkd) {
              countryDeliverables.push({
                country: 'Hongkong',
                currency: 'USD',
                basePrice: parseFloat(String(row.hkUsd)) || 0,
                calculatedPrice: parseFloat(String(row.hkUsd)) || 0,
                exchangeRate: parseFloat(String(row.hkXe)) || null,
                price: parseFloat(String(row.hkUsd)) || 0,
                usd: parseFloat(String(row.hkUsd)) || 0,
                xe: parseFloat(String(row.hkXe)) || 0,
                local: parseFloat(String(row.hkHkd)) || 0,
                hkd: parseFloat(String(row.hkHkd)) || 0,
                margins: [],
                costs: [],
                charges: [],
                paymentTerm: hasPermission('paymentTerm') ? normalizePaymentTerm(row.paymentTerm) : null,
                paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
              });
            }
          }
          
          if (hasPermission('dubaiUsd') || hasPermission('dubaiAed')) {
            if (row.dubaiUsd || row.dubaiAed) {
              countryDeliverables.push({
                country: 'Dubai',
                currency: 'USD',
                basePrice: parseFloat(String(row.dubaiUsd)) || 0,
                calculatedPrice: parseFloat(String(row.dubaiUsd)) || 0,
                exchangeRate: parseFloat(String(row.dubaiXe)) || null,
                price: parseFloat(String(row.dubaiUsd)) || 0,
                usd: parseFloat(String(row.dubaiUsd)) || 0,
                xe: parseFloat(String(row.dubaiXe)) || 0,
                local: parseFloat(String(row.dubaiAed)) || 0,
                aed: parseFloat(String(row.dubaiAed)) || 0,
                margins: [],
                costs: [],
                charges: [],
                paymentTerm: hasPermission('paymentTerm') ? normalizePaymentTerm(row.paymentTerm) : null,
                paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
              });
            }
          }
        }

        // Build product object - ONLY include fields with permission
        const product: any = {};
        
        // Backend-required fields - always include, but use permission-based values or defaults
        if (hasPermission('skuFamilyId') && row.skuFamilyId && isValidObjectId(row.skuFamilyId)) {
          product.skuFamilyId = row.skuFamilyId;
        } else if (!hasPermission('skuFamilyId')) {
          // Can't update without skuFamilyId permission
          return null;
        }
        
        // Include subSkuFamilyId if available (from SKU Family selection)
        if (row.subSkuFamilyId && isValidObjectId(row.subSkuFamilyId)) {
          product.subSkuFamilyId = row.subSkuFamilyId;
        } else {
          product.subSkuFamilyId = null;
        }
        
        // stock is required by backend
        if (hasPermission('totalQty')) {
          product.stock = parseFloat(String(row.totalQty)) || 0;
        } else {
          product.stock = 0; // Default
        }
        
        // Only include gradeId if permission exists
        // In edit mode, include even if null to allow clearing the field
        if (hasPermission('grade')) {
          if (row.grade && isValidObjectId(row.grade)) {
            product.gradeId = row.grade;
          } else if (editId) {
            // In edit mode, allow null to clear the field
            product.gradeId = null;
          }
        }
        
        // Only include specification if permission exists
        if (hasPermission('subModelName') || hasPermission('version')) {
          const spec = cleanString(row.subModelName) || cleanString(row.version) || cleanString((row as any).specification);
          if (spec) {
            product.specification = spec;
          } else if (editId) {
            // In edit mode, allow empty to clear the field
            product.specification = null;
          }
        }
        
        // Only include simType if permission exists
        // In edit mode, include even if empty to allow clearing the field
        if (hasPermission('sim')) {
          if (row.sim) {
            product.simType = row.sim;
          } else if (editId) {
            // In edit mode, allow null to clear the field
            product.simType = null;
          }
        }
        
        // Only include color if permission exists
        if (hasPermission('colour')) {
          const color = normalizeColor(row.colour);
          if (color) {
            product.color = color;
          }
        }
        
        // Only include ram if permission exists
        if (hasPermission('ram')) {
          const ram = cleanString(row.ram);
          if (ram) {
            product.ram = ram;
          }
        }
        
        // Only include storage if permission exists
        if (hasPermission('storage') && row.storage) {
          product.storage = row.storage;
        }
        
        // Only include weight if permission exists
        if (hasPermission('weight') && row.weight) {
          product.weight = parseFloat(String(row.weight));
        }
        
        // Only include country if permission exists
        // In edit mode, include even if null to allow clearing the field
        if (hasPermission('country')) {
          const country = normalizeCountry(cleanString(row.country));
          if (country) {
            product.country = country;
          } else if (editId) {
            // In edit mode, allow null to clear the field
            product.country = null;
          }
        }
        
        // Only include moq if permission exists
        if (hasPermission('moqPerVariant')) {
          product.moq = parseFloat(String(row.moqPerVariant)) || 1;
        } else {
          product.moq = 1; // Default
        }
        
        // Only include purchaseType if permission exists
        if (hasPermission('purchaseType')) {
          product.purchaseType = (row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : '';
        }
        
        // Only include isNegotiable if permission exists
        if (hasPermission('negotiableFixed')) {
          product.isNegotiable = row.negotiableFixed === '1';
        }
        
        // Only include isFlashDeal if permission exists
        if (hasPermission('flashDeal')) {
          product.isFlashDeal = row.flashDeal && (row.flashDeal === '1' || row.flashDeal === 'true' || row.flashDeal.toLowerCase() === 'yes') ? 'true' : 'false';
        }
        
        // Only include startTime if permission exists
        if (hasPermission('startTime') && cleanString(row.startTime)) {
          product.startTime = new Date(row.startTime).toISOString();
        }
        
        // Only include expiryTime if permission exists
        if (hasPermission('endTime') && cleanString(row.endTime)) {
          product.expiryTime = new Date(row.endTime).toISOString();
        }
        
        // Group code for multi-variant
        if (variantType === 'multi') {
          product.groupCode = editId && editProducts.length > 0 
            ? (editProducts[0] as any).groupCode 
            : (row.groupCode || `GROUP-${Date.now()}`);
        }
        
        // Sequence
        if (row.sequence) {
          product.sequence = row.sequence;
        }
        
        // Country deliverables - only include if seller has permission for price fields
        if (countryDeliverables.length > 0) {
          product.countryDeliverables = countryDeliverables;
        }
        
        // Always include sellerId
        product.sellerId = hasPermission('supplierId') ? (cleanString(row.supplierId) || getCurrentSellerId()) : getCurrentSellerId();
        
        // Only include supplierListingNumber if permission exists
        if (hasPermission('supplierListingNumber')) {
          const supplierListingNo = cleanString(row.supplierListingNumber);
          if (supplierListingNo) {
            product.supplierListingNumber = supplierListingNo;
          }
        }
        
        // Only include customerListingNumber if permission exists
        if (hasPermission('customerListingNumber')) {
          const customerListingNo = cleanString(row.customerListingNumber);
          if (customerListingNo) {
            product.customerListingNumber = customerListingNo;
          }
        }
        
        // Only include packing if permission exists
        if (hasPermission('packing')) {
          const packingValue = cleanString(row.packing);
          if (packingValue) {
            product.packing = packingValue;
          }
        }
        
        // Only include currentLocation if permission exists
        if (hasPermission('currentLocation')) {
          const currentLoc = cleanString(row.currentLocation);
          if (currentLoc) {
            product.currentLocation = currentLoc;
          }
        }
        
        // Only include deliveryLocation if permission exists
        if (hasPermission('deliveryLocation') && Array.isArray(row.deliveryLocation) && row.deliveryLocation.length > 0) {
          product.deliveryLocation = row.deliveryLocation;
        }
        
        // Only include customMessage if permission exists
        // Always include it (even if empty) to allow clearing the field
        if (hasPermission('customMessage')) {
          const customMsg = cleanString(row.customMessage);
          product.customMessage = customMsg || null; // Send null if empty to clear
        }
        
        // Only include adminCustomMessage if permission exists
        // Always include it (even if empty) to allow clearing the field
        if (hasPermission('adminCustomMessage')) {
          const adminCustomMsg = cleanString(row.adminCustomMessage);
          product.adminCustomMessage = adminCustomMsg || null; // Send null if empty to clear
        }
        
        // Only include totalMoq if permission exists
        if (variantType === 'multi' && hasPermission('totalMoq') && totalMoq) {
          product.totalMoq = parseFloat(String(totalMoq));
        }
        
        // Only include paymentTerm if permission exists
        if (hasPermission('paymentTerm')) {
          const paymentTermValue = cleanString(row.paymentTerm);
          if (paymentTermValue) {
            product.paymentTerm = paymentTermValue;
          }
        }
        
        // Only include paymentMethod if permission exists
        if (hasPermission('paymentMethod')) {
          const paymentMethodValue = cleanString(row.paymentMethod);
          if (paymentMethodValue) {
            product.paymentMethod = paymentMethodValue;
          }
        }
        
        // Only include shippingTime if permission exists
        if (hasPermission('shippingTime')) {
          const shippingTimeValue = cleanString(row.shippingTime);
          if (shippingTimeValue) {
            product.shippingTime = shippingTimeValue;
          }
        }
        
        // Only include vendor if permission exists
        // Map vendor code to enum value: backend expects 'att' or 'tmobile'
        if (hasPermission('vendor') && row.vendor) {
          const vendorValue = String(row.vendor).trim();
          // Map code to enum value - backend enum: ['att', 'tmobile']
          // Map numeric codes: '1' -> 'att', '2' -> 'tmobile'
          if (vendorValue === '1') {
            product.vendor = 'att';
          } else if (vendorValue === '2') {
            product.vendor = 'tmobile';
          } else if (vendorValue.toLowerCase() === 'att' || vendorValue.toLowerCase() === 'tmobile') {
            product.vendor = vendorValue.toLowerCase();
          } else {
            // Fallback: try to use as-is (backend will validate)
            product.vendor = vendorValue;
          }
        }
        
        // Only include vendorListingNo if permission exists
        if (hasPermission('vendorListingNo')) {
          const vendorListingNoValue = cleanString(row.vendorListingNo);
          if (vendorListingNoValue) {
            product.vendorListingNo = vendorListingNoValue;
          }
        }
        
        // Only include carrier if permission exists
        // Map carrier code to enum value: backend expects 'tmob' or 'mixed'
        if (hasPermission('carrier') && row.carrier) {
          const carrierValue = String(row.carrier).trim();
          // Map code to enum value - backend enum: ['tmob', 'mixed']
          // Map numeric codes: '1' -> 'tmob', '2' -> 'mixed'
          if (carrierValue === '1') {
            product.carrier = 'tmob';
          } else if (carrierValue === '2') {
            product.carrier = 'mixed';
          } else if (carrierValue.toLowerCase() === 'tmob' || carrierValue.toLowerCase() === 'mixed') {
            product.carrier = carrierValue.toLowerCase();
          } else {
            // Fallback: try to use as-is (backend will validate)
            product.carrier = carrierValue;
          }
        }
        
        // Only include carrierListingNo if permission exists
        if (hasPermission('carrierListingNo')) {
          const carrierListingNoValue = cleanString(row.carrierListingNo);
          if (carrierListingNoValue) {
            product.carrierListingNo = carrierListingNoValue;
          }
        }
        
        // Only include uniqueListingNo if permission exists
        if (hasPermission('uniqueListingNo')) {
          const uniqueListingNoValue = cleanString(row.uniqueListingNo);
          if (uniqueListingNoValue) {
            product.uniqueListingNo = uniqueListingNoValue;
          }
        }
        
        // Only include tags if permission exists
        if (hasPermission('tags')) {
          const tagsValue = cleanString(row.tags);
          if (tagsValue) {
            product.tags = tagsValue;
          }
        }
        
        // Only include remark if permission exists
        // Always include it (even if empty) to allow clearing the field
        if (hasPermission('remark')) {
          const remarkValue = cleanString(row.remark);
          product.remark = remarkValue || null; // Send null if empty to clear
        }
        
        // Only include warranty if permission exists
        if (hasPermission('warranty')) {
          const warrantyValue = cleanString(row.warranty);
          if (warrantyValue) {
            product.warranty = warrantyValue;
          }
        }
        
        // Only include batteryHealth if permission exists
        if (hasPermission('batteryHealth')) {
          const batteryHealthValue = cleanString(row.batteryHealth);
          if (batteryHealthValue) {
            product.batteryHealth = batteryHealthValue;
          }
        }
        
        // Only include lockUnlock if permission exists
        if (hasPermission('lockUnlock')) {
          product.lockUnlock = row.lockUnlock === '1';
        }
        
        // Map status field to isStatus (active/nonactive)
        if (hasPermission('status')) {
          const statusValue = row.status ? String(row.status).trim().toLowerCase() : '';
          // Map status to isStatus field
          if (statusValue === 'active' || statusValue === 'nonactive' || statusValue === 'non active') {
            product.isStatus = statusValue === 'non active' ? 'nonactive' : statusValue;
          }
        } else {
          // Default to active if no permission
          product.isStatus = 'active';
        }
        
        // Collect custom fields and send to backend
        // Extract custom field keys from row that start with 'custom_'
        const customFieldsMap: Record<string, string> = {};
        const customColsMetadata: Array<{ key: string; label: string; width: number }> = [];
        Object.keys(row).forEach(key => {
          if (key.startsWith('custom_')) {
            const value = row[key as keyof ProductRowData];
            // Remove custom_ prefix when sending to backend
            const backendKey = key.replace(/^custom_/, '');
            // Include value even if empty (backend can handle empty strings)
            const fieldValue = (value && typeof value === 'string') ? value.trim() : '';
            customFieldsMap[backendKey] = fieldValue;
            // Store column metadata
            customColsMetadata.push({
              key: backendKey,
              label: backendKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              width: 150
            });
          }
        });
        // Always include customFields in payload if any custom columns exist (even if empty values)
        if (Object.keys(customFieldsMap).length > 0) {
          product.customFields = customFieldsMap;
          // Store custom column definitions (metadata) in payload for backend storage
          product.customColumns = customColsMetadata;
        }
        
        // Calculate price from countryDeliverables for legacy support
        if (countryDeliverables.length > 0) {
          const firstDeliverable = countryDeliverables[0];
          product.price = firstDeliverable.basePrice || firstDeliverable.usd || 0;
        } else {
          product.price = 0;
        }
        
        return product;
      }).filter(product => product !== null); // Filter out null products

      // Update or create products
      if (editId) {
        // Update existing products - only send fields with permission
        if (variantType === 'single' && editProduct?._id && productsToCreate.length > 0) {
          // Single variant update - build payload with only permitted fields
          const productData = productsToCreate[0];
          const updatePayload: any = {
            id: editProduct._id,
          };
          
          // Helper to safely add field only if permission exists
          // For certain fields (country, simType, gradeId), allow null/empty to clear the field
          const addFieldIfPermitted = (fieldName: string, value: any, allowNull: boolean = false, allowZero: boolean = false) => {
            if (hasPermission(fieldName)) {
              if (value !== undefined) {
                if (allowNull) {
                  // Allow null/empty to clear the field
                  // Convert empty string to null, preserve null, preserve other values
                  updatePayload[fieldName] = (value === '' || value === null) ? null : value;
                } else if (value !== null && value !== '' && (allowZero || value !== 0)) {
                  // Only send non-empty, non-null values (unless allowZero is true for numeric 0)
                  updatePayload[fieldName] = value;
                } else if (value === '' || value === null) {
                  // For text fields without allowNull, explicitly send empty string or null to clear the field
                  updatePayload[fieldName] = value === '' ? '' : null;
                }
              } else if (allowNull) {
                // If value is undefined but allowNull is true, send null to clear the field
                updatePayload[fieldName] = null;
              }
            }
          };
          
          // Only include fields that seller has permission for
          addFieldIfPermitted('skuFamilyId', productData.skuFamilyId);
          // subSkuFamilyId should always be included if available
          if (productData.subSkuFamilyId !== undefined) {
            updatePayload.subSkuFamilyId = productData.subSkuFamilyId || null;
          }
          // gradeId, country, and simType can be null to clear the field
          if (hasPermission('grade')) {
            updatePayload.gradeId = productData.gradeId !== undefined ? (productData.gradeId || null) : undefined;
          }
          addFieldIfPermitted('specification', productData.specification, true);
          // simType can be null/empty to clear
          if (hasPermission('sim')) {
            updatePayload.simType = productData.simType !== undefined ? (productData.simType || null) : undefined;
          }
          addFieldIfPermitted('color', productData.color, true);
          addFieldIfPermitted('ram', productData.ram, true);
          addFieldIfPermitted('storage', productData.storage, true);
          addFieldIfPermitted('weight', productData.weight);
          // country can be null to clear - normalize to HK or USA
          if (hasPermission('country')) {
            if (productData.country !== undefined) {
              updatePayload.country = normalizeCountry(productData.country);
            }
          }
          // stock is required by backend - always include it
          if (hasPermission('totalQty')) {
            updatePayload.stock = productData.stock !== undefined ? productData.stock : 0;
          } else {
            // If no permission, preserve existing stock value
            updatePayload.stock = editProduct?.stock || 0;
          }
          if (hasPermission('moqPerVariant')) {
            updatePayload.moq = productData.moq !== undefined ? productData.moq : 1;
          } else {
            // If no permission, preserve existing moq value
            updatePayload.moq = editProduct?.moq || 1;
          }
          addFieldIfPermitted('purchaseType', productData.purchaseType);
          if (hasPermission('negotiableFixed')) {
            updatePayload.isNegotiable = productData.isNegotiable !== undefined ? productData.isNegotiable : false;
          }
          if (hasPermission('flashDeal')) {
            updatePayload.isFlashDeal = productData.isFlashDeal !== undefined ? productData.isFlashDeal : 'false';
            // If isFlashDeal is true, ensure expiryTime is included (required by backend)
            if (updatePayload.isFlashDeal === true || updatePayload.isFlashDeal === 'true') {
              if (productData.expiryTime !== undefined) {
                updatePayload.expiryTime = productData.expiryTime;
              } else if (editProduct?.expiryTime) {
                // Preserve existing expiryTime if not provided
                updatePayload.expiryTime = editProduct.expiryTime;
              }
            }
          }
          addFieldIfPermitted('startTime', productData.startTime, true);
          addFieldIfPermitted('expiryTime', productData.expiryTime, true);
          addFieldIfPermitted('supplierListingNumber', productData.supplierListingNumber, true);
          addFieldIfPermitted('customerListingNumber', productData.customerListingNumber, true);
          addFieldIfPermitted('packing', productData.packing, true);
          addFieldIfPermitted('currentLocation', productData.currentLocation, true);
          addFieldIfPermitted('deliveryLocation', productData.deliveryLocation);
          addFieldIfPermitted('customMessage', productData.customMessage, true);
          addFieldIfPermitted('paymentTerm', productData.paymentTerm, true);
          addFieldIfPermitted('paymentMethod', productData.paymentMethod, true);
          addFieldIfPermitted('shippingTime', productData.shippingTime, true);
          addFieldIfPermitted('vendor', productData.vendor, true);
          addFieldIfPermitted('vendorListingNo', productData.vendorListingNo, true);
          addFieldIfPermitted('carrier', productData.carrier, true);
          addFieldIfPermitted('carrierListingNo', productData.carrierListingNo, true);
          addFieldIfPermitted('uniqueListingNo', productData.uniqueListingNo, true);
          addFieldIfPermitted('tags', productData.tags, true);
          addFieldIfPermitted('remark', productData.remark, true);
          addFieldIfPermitted('warranty', productData.warranty, true);
          addFieldIfPermitted('batteryHealth', productData.batteryHealth, true);
          
          // Handle adminCustomMessage field (if permission exists)
          if (hasPermission('adminCustomMessage')) {
            if (productData.adminCustomMessage !== undefined) {
              updatePayload.adminCustomMessage = productData.adminCustomMessage === '' ? null : productData.adminCustomMessage;
            }
          }
          if (hasPermission('lockUnlock')) {
            updatePayload.lockUnlock = productData.lockUnlock !== undefined ? productData.lockUnlock : false;
          }
          
          // Map status field to isStatus (active/nonactive)
          if (hasPermission('status')) {
            if (productData.isStatus !== undefined) {
              const statusValue = String(productData.isStatus).trim().toLowerCase();
              if (statusValue === 'active' || statusValue === 'nonactive' || statusValue === 'non active') {
                updatePayload.isStatus = statusValue === 'non active' ? 'nonactive' : statusValue;
              } else {
                updatePayload.isStatus = 'active';
              }
            } else if (editProduct && (editProduct as any).isStatus) {
              // Preserve existing isStatus if not provided
              updatePayload.isStatus = (editProduct as any).isStatus;
            } else {
              // Default to active
              updatePayload.isStatus = 'active';
            }
          }
          
          // Collect custom fields and send to backend
          // Always extract custom fields based on current customColumns state (from ExcelLikeProductForm)
          // This ensures deleted custom fields are not included and empty values are sent
          const customFieldsMap: Record<string, string> = {};
          const customColsMetadata: Array<{ key: string; label: string; width: number }> = [];
          const row = rows[0]; // Single variant - use first row
          
          // Use customColumns passed from ExcelLikeProductForm to know which fields to include
          if (customColumns && customColumns.length > 0) {
            customColumns.forEach(customCol => {
              const value = row[customCol.key as keyof ProductRowData];
              // Remove custom_ prefix when sending to backend
              const backendKey = customCol.key.startsWith('custom_') 
                ? customCol.key.replace(/^custom_/, '') 
                : customCol.key;
              // Include value even if empty (backend can handle empty strings)
              const fieldValue = (value && typeof value === 'string') ? value.trim() : '';
              customFieldsMap[backendKey] = fieldValue;
              // Store column metadata
              customColsMetadata.push({
                key: backendKey,
                label: customCol.label || backendKey.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                width: customCol.width || 150
              });
            });
          }
          
          // Always include customFields in update payload based on current customColumns
          // If no custom columns exist, send empty object to clear all custom fields
          updatePayload.customFields = customFieldsMap;
          if (customColsMetadata.length > 0) {
            updatePayload.customColumns = customColsMetadata;
          } else {
            // If no custom columns, send empty array to clear customColumns in backend
            updatePayload.customColumns = [];
          }
          
          // Include countryDeliverables if seller has permission for price fields
          if ((hasPermission('hkUsd') || hasPermission('hkHkd') || hasPermission('dubaiUsd') || hasPermission('dubaiAed')) 
              && productData.countryDeliverables && productData.countryDeliverables.length > 0) {
            // Remove _id fields from countryDeliverables (not allowed by backend validator)
            // Also normalize paymentTerm values
            updatePayload.countryDeliverables = productData.countryDeliverables.map((cd: any) => {
              const { _id: _, paymentTerm, ...rest } = cd;
              return {
                ...rest,
                paymentTerm: normalizePaymentTerm(paymentTerm),
              };
            });
            // Also include price for legacy support
            updatePayload.price = productData.price !== undefined ? productData.price : 0;
          }
          
          await ProductService.update(updatePayload);
          toastHelper.showTost('Product updated successfully!', 'success');
        } else if (variantType === 'multi' && editProducts.length > 0) {
          // Multi variant update - update all products in the group
          const updatePromises = editProducts.map((editProd, index) => {
            if (editProd._id && productsToCreate[index]) {
              const productData = productsToCreate[index];
              const updatePayload: any = {
                id: editProd._id,
              };
              
              // Helper to safely add field only if permission exists
              // For certain fields (country, simType, gradeId), allow null/empty to clear the field
              const addFieldIfPermitted = (fieldName: string, value: any, allowNull: boolean = false, allowZero: boolean = false) => {
                if (hasPermission(fieldName)) {
                  if (value !== undefined) {
                    if (allowNull) {
                      // Allow null/empty to clear the field
                      // Convert empty string to null, preserve null, preserve other values
                      updatePayload[fieldName] = (value === '' || value === null) ? null : value;
                    } else if (value !== null && value !== '' && (allowZero || value !== 0)) {
                      // Only send non-empty, non-null values (unless allowZero is true for numeric 0)
                      updatePayload[fieldName] = value;
                    } else if (value === '' || value === null) {
                      // For text fields without allowNull, explicitly send empty string or null to clear the field
                      updatePayload[fieldName] = value === '' ? '' : null;
                    }
                  } else if (allowNull) {
                    // If value is undefined but allowNull is true, send null to clear the field
                    updatePayload[fieldName] = null;
                  }
                }
              };
              
              // Only include fields that seller has permission for
              addFieldIfPermitted('skuFamilyId', productData.skuFamilyId);
              // subSkuFamilyId should always be included if available
              if (productData.subSkuFamilyId !== undefined) {
                updatePayload.subSkuFamilyId = productData.subSkuFamilyId || null;
              }
              // gradeId, country, and simType can be null to clear the field
              if (hasPermission('grade')) {
                updatePayload.gradeId = productData.gradeId !== undefined ? (productData.gradeId || null) : undefined;
              }
              addFieldIfPermitted('specification', productData.specification, true);
              // simType can be null/empty to clear
              if (hasPermission('sim')) {
                updatePayload.simType = productData.simType !== undefined ? (productData.simType || null) : undefined;
              }
              addFieldIfPermitted('color', productData.color, true);
              addFieldIfPermitted('ram', productData.ram, true);
              addFieldIfPermitted('storage', productData.storage, true);
              addFieldIfPermitted('weight', productData.weight);
              // country can be null to clear - normalize to HK or USA
              if (hasPermission('country')) {
                if (productData.country !== undefined) {
                  updatePayload.country = normalizeCountry(productData.country);
                }
              }
              // stock is required by backend - always include it
              if (hasPermission('totalQty')) {
                updatePayload.stock = productData.stock !== undefined ? productData.stock : 0;
              } else {
                // If no permission, preserve existing stock value
                updatePayload.stock = editProd?.stock || 0;
              }
              if (hasPermission('moqPerVariant')) {
                updatePayload.moq = productData.moq !== undefined ? productData.moq : 1;
              } else {
                // If no permission, preserve existing moq value
                updatePayload.moq = editProd?.moq || 1;
              }
              addFieldIfPermitted('purchaseType', productData.purchaseType);
              if (hasPermission('negotiableFixed')) {
                updatePayload.isNegotiable = productData.isNegotiable !== undefined ? productData.isNegotiable : false;
              }
              if (hasPermission('flashDeal')) {
                updatePayload.isFlashDeal = productData.isFlashDeal !== undefined ? productData.isFlashDeal : 'false';
                // If isFlashDeal is true, ensure expiryTime is included (required by backend)
                if (updatePayload.isFlashDeal === true || updatePayload.isFlashDeal === 'true') {
                  if (productData.expiryTime !== undefined) {
                    updatePayload.expiryTime = productData.expiryTime;
                  } else if (editProd?.expiryTime) {
                    // Preserve existing expiryTime if not provided
                    updatePayload.expiryTime = editProd.expiryTime;
                  }
                }
              }
              addFieldIfPermitted('startTime', productData.startTime, true);
              addFieldIfPermitted('expiryTime', productData.expiryTime, true);
              addFieldIfPermitted('supplierListingNumber', productData.supplierListingNumber, true);
              addFieldIfPermitted('customerListingNumber', productData.customerListingNumber, true);
              addFieldIfPermitted('packing', productData.packing, true);
              addFieldIfPermitted('currentLocation', productData.currentLocation, true);
              addFieldIfPermitted('deliveryLocation', productData.deliveryLocation);
              addFieldIfPermitted('customMessage', productData.customMessage, true);
              addFieldIfPermitted('paymentTerm', productData.paymentTerm, true);
              addFieldIfPermitted('paymentMethod', productData.paymentMethod, true);
              addFieldIfPermitted('shippingTime', productData.shippingTime, true);
              addFieldIfPermitted('vendor', productData.vendor, true);
              addFieldIfPermitted('vendorListingNo', productData.vendorListingNo, true);
              addFieldIfPermitted('carrier', productData.carrier, true);
              addFieldIfPermitted('carrierListingNo', productData.carrierListingNo, true);
              addFieldIfPermitted('uniqueListingNo', productData.uniqueListingNo, true);
              addFieldIfPermitted('tags', productData.tags, true);
              addFieldIfPermitted('remark', productData.remark, true);
              addFieldIfPermitted('warranty', productData.warranty, true);
              addFieldIfPermitted('batteryHealth', productData.batteryHealth, true);
              
              // Handle adminCustomMessage field (if permission exists)
              if (hasPermission('adminCustomMessage')) {
                if (productData.adminCustomMessage !== undefined) {
                  updatePayload.adminCustomMessage = productData.adminCustomMessage === '' ? null : productData.adminCustomMessage;
                }
              }
              if (hasPermission('lockUnlock')) {
                updatePayload.lockUnlock = productData.lockUnlock !== undefined ? productData.lockUnlock : false;
              }
              
              // Map status field to isStatus (active/nonactive)
              if (hasPermission('status')) {
                if (productData.isStatus !== undefined) {
                  const statusValue = String(productData.isStatus).trim().toLowerCase();
                  if (statusValue === 'active' || statusValue === 'nonactive' || statusValue === 'non active') {
                    updatePayload.isStatus = statusValue === 'non active' ? 'nonactive' : statusValue;
                  } else {
                    updatePayload.isStatus = 'active';
                  }
                } else if (editProd && (editProd as any).isStatus) {
                  // Preserve existing isStatus if not provided
                  updatePayload.isStatus = (editProd as any).isStatus;
                } else {
                  // Default to active
                  updatePayload.isStatus = 'active';
                }
              }
              
              // Collect custom fields and send to backend
              // Always extract custom fields based on current customColumns state (from ExcelLikeProductForm)
              // This ensures deleted custom fields are not included and empty values are sent
              const customFieldsMap: Record<string, string> = {};
              const customColsMetadata: Array<{ key: string; label: string; width: number }> = [];
              const row = rows[index]; // Multi variant - use row at current index
              
              // Use customColumns passed from ExcelLikeProductForm to know which fields to include
              if (customColumns && customColumns.length > 0) {
                customColumns.forEach(customCol => {
                  const value = row[customCol.key as keyof ProductRowData];
                  // Remove custom_ prefix when sending to backend
                  const backendKey = customCol.key.startsWith('custom_') 
                    ? customCol.key.replace(/^custom_/, '') 
                    : customCol.key;
                  // Include value even if empty (backend can handle empty strings)
                  const fieldValue = (value && typeof value === 'string') ? value.trim() : '';
                  customFieldsMap[backendKey] = fieldValue;
                  // Store column metadata
                  customColsMetadata.push({
                    key: backendKey,
                    label: customCol.label || backendKey.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    width: customCol.width || 150
                  });
                });
              }
              
              // Always include customFields in update payload based on current customColumns
              // If no custom columns exist, send empty object to clear all custom fields
              updatePayload.customFields = customFieldsMap;
              if (customColsMetadata.length > 0) {
                updatePayload.customColumns = customColsMetadata;
              } else {
                // If no custom columns, send empty array to clear customColumns in backend
                updatePayload.customColumns = [];
              }
              
              // Include countryDeliverables if seller has permission for price fields
              if ((hasPermission('hkUsd') || hasPermission('hkHkd') || hasPermission('dubaiUsd') || hasPermission('dubaiAed')) 
                  && productData.countryDeliverables && productData.countryDeliverables.length > 0) {
                // Remove _id fields from countryDeliverables (not allowed by backend validator)
                // Also normalize paymentTerm values
                updatePayload.countryDeliverables = productData.countryDeliverables.map((cd: any) => {
                  const { _id: _, paymentTerm, ...rest } = cd;
                  return {
                    ...rest,
                    paymentTerm: normalizePaymentTerm(paymentTerm),
                  };
                });
                updatePayload.price = productData.price !== undefined ? productData.price : 0;
              }
              
              return ProductService.update(updatePayload);
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
