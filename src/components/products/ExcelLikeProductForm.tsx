import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { VariantOption } from './CascadingVariantSelector';
import { GradeService } from '../../services/grade/grade.services';
import { ProductService } from '../../services/products/products.services';
import { ConstantsService, Constants } from '../../services/constants/constants.services';
import { SkuFamilyService } from '../../services/skuFamily/skuFamily.services';
import { SellerProductPermissionService, SellerProductFieldPermission } from '../../services/sellerProductPermission/sellerProductPermission.services';
import { STORAGE_KEYS, StorageService } from '../../constants/storage';
import toastHelper from '../../utils/toastHelper';

type ColumnDefinition = 
  | { key: string; label: string; width: number }
  | { key: string; label: string; width: number; group: string; permissionField: string; subgroup?: undefined }
  | { key: string; label: string; width: number; group: string; subgroup: string; permissionField: string };

export interface ProductRowData {
  // Product Detail Group
  subModelName: string;
  storage: string;
  colour: string;
  country: string;
  sim: string;
  version: string;
  grade: string;
  status: string;
  lockUnlock: string;
  warranty: string;
  batteryHealth: string;
  
  // Pricing / Delivery / Payment Method Group
  packing: string;
  currentLocation: string; // Store code: "HK" or "D"
  hkUsd: number | string;
  hkXe: number | string;
  hkHkd: number | string;
  dubaiUsd: number | string;
  dubaiXe: number | string;
  dubaiAed: number | string;
  deliveryLocation: string[]; // Array of codes: ["HK", "D"]
  customMessage: string;
  totalQty: number | string;
  moqPerVariant: number | string;
  weight: number | string;
  purchaseType: string; // 'full' | 'partial'
  // Payment Term - single field (from constants)
  paymentTerm: string;
  // Payment Method - single field (from constants, stored as comma-separated string for multiple selection)
  paymentMethod: string;
  
  // Other Information Group
  negotiableFixed: string;
  tags: string; // Comma-separated string of tag codes
  flashDeal: string;
  shippingTime: string;
  vendor: string;
  vendorListingNo: string;
  carrier: string;
  carrierListingNo: string;
  uniqueListingNo: string;
  adminCustomMessage: string;
  startTime: string;
  endTime: string;
  remark: string;
  
  // Additional fields
  supplierId: string; // Seller ID (disabled, auto-filled from current user)
  supplierListingNumber: string;
  customerListingNumber: string;
  skuFamilyId: string;
  subSkuFamilyId?: string | null; // Sub SKU Family ID from skuFamily.subSkuFamilies array
  ram?: string;
  sequence?: number;
  images?: string[];
  // Dynamic custom fields - key-value pairs
  [key: string]: any;
}

interface ExcelLikeProductFormProps {
  variantType: 'single' | 'multi';
  variants?: VariantOption[];
  onSave: (rows: ProductRowData[], totalMoq?: number | string, customColumns?: Array<{ key: string; label: string; width: number }>) => void;
  onCancel: () => void;
  editProducts?: any[]; // Products to edit
}

const ExcelLikeProductForm: React.FC<ExcelLikeProductFormProps> = ({
  variantType,
  variants = [],
  onSave,
  onCancel,
  editProducts = [],
}) => {
  const [rows, setRows] = useState<ProductRowData[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [skuFamilies, setSkuFamilies] = useState<any[]>([]);
  const [constants, setConstants] = useState<Constants | null>(null);
  const [permissions, setPermissions] = useState<SellerProductFieldPermission[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMoq, setTotalMoq] = useState<number | string>(''); 
  const tableRef = useRef<HTMLDivElement>(null);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: string } | null>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  // State for row-specific SKU Family search
  const [rowSkuFamilySearch, setRowSkuFamilySearch] = useState<{ rowIndex: number; query: string; showResults: boolean } | null>(null);
  const [rowSkuFamilySearchResults, setRowSkuFamilySearchResults] = useState<any[]>([]);
  const [shippingTimeMode, setShippingTimeMode] = useState<Record<number, 'today' | 'tomorrow' | 'calendar' | ''>>({});
  const rowsContainerRef = useRef<HTMLDivElement | null>(null);
  const [currentCustomerListingNumber, setCurrentCustomerListingNumber] = useState<number | null>(null);
  const [currentUniqueListingNumber, setCurrentUniqueListingNumber] = useState<number | null>(null);
  const [supplierListingNumberInfo, setSupplierListingNumberInfo] = useState<{ listingNumber: number; supplierCode: string } | null>(null);
  
  // Get current seller ID from storage
  const getCurrentSellerId = (): string => {
    const user = StorageService.getItem<any>(STORAGE_KEYS.USER);
    return user?._id || user?.id || '';
  };

  // Get current seller code from storage
  const getCurrentSellerCode = (): string => {
    const user = StorageService.getItem<any>(STORAGE_KEYS.USER);
    return user?.code || '';
  };

  // Removed modal states - sellers don't set margins/costs

  // Dynamic custom columns state
  const [customColumns, setCustomColumns] = useState<Array<{ key: string; label: string; width: number }>>([]);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // LocalStorage key for saving form data
  const STORAGE_KEY = 'variant-product-form-data';

  // Fields that must be shared across all variants in a multi-variant group.
  // These are editable only on the first (master) row and read-only on others.
  const groupLevelFields: (keyof ProductRowData)[] = [
    'currentLocation',
    'paymentTerm',
    'paymentMethod',
    'negotiableFixed',
    'flashDeal',
    'shippingTime',
    'startTime',
    'endTime',
  ];

  // Load data from localStorage on mount OR initialize from editProducts
  useEffect(() => {
    // Priority 1: Initialize from editProducts if available (editing mode)
    if (editProducts && editProducts.length > 0) {
      console.log('ExcelLikeProductForm: Initializing rows from editProducts:', editProducts.length, 'products');
      console.log('ExcelLikeProductForm: editProducts data:', JSON.stringify(editProducts, null, 2));
      const transformedRows: ProductRowData[] = editProducts.map((product) => {
        const skuFamily = typeof product.skuFamilyId === 'object' ? product.skuFamilyId : null;
        const grade = (product as any).gradeId ? (typeof (product as any).gradeId === 'object' ? (product as any).gradeId._id : (product as any).gradeId) : '';
        
        // Get country deliverables - find USD entries for base prices
        const hkDeliverable = Array.isArray(product.countryDeliverables) 
          ? product.countryDeliverables.find((cd: any) => cd.country === 'Hongkong' && cd.currency === 'USD')
          : null;
        const dubaiDeliverable = Array.isArray(product.countryDeliverables)
          ? product.countryDeliverables.find((cd: any) => cd.country === 'Dubai' && cd.currency === 'USD')
          : null;
        
        // Calculate local currency base prices from USD basePrice and exchange rate
        const hkBasePrice = hkDeliverable?.basePrice || hkDeliverable?.usd || 0;
        const hkExchangeRate = hkDeliverable?.exchangeRate || hkDeliverable?.xe || 0;
        const hkHkdBasePrice = hkBasePrice && hkExchangeRate ? hkBasePrice * hkExchangeRate : 0;
        
        const dubaiBasePrice = dubaiDeliverable?.basePrice || dubaiDeliverable?.usd || 0;
        const dubaiExchangeRate = dubaiDeliverable?.exchangeRate || dubaiDeliverable?.xe || 0;
        const dubaiAedBasePrice = dubaiBasePrice && dubaiExchangeRate ? dubaiBasePrice * dubaiExchangeRate : 0;
        
        // Get custom fields and normalize keys to include custom_ prefix
        // Backend stores custom fields without custom_ prefix (e.g., "notes")
        // Frontend expects them with custom_ prefix (e.g., "custom_notes")
        const customFields = (product as any).customFields || {};
        const customFieldsObj: Record<string, string> = {};
        if (customFields instanceof Map) {
          customFields.forEach((value, key) => {
            // Normalize key: add custom_ prefix if not present
            const normalizedKey = key.startsWith('custom_') ? key : `custom_${key}`;
            customFieldsObj[normalizedKey] = String(value || '');
          });
        } else if (typeof customFields === 'object' && customFields !== null) {
          Object.keys(customFields).forEach(key => {
            // Normalize key: add custom_ prefix if not present
            const normalizedKey = key.startsWith('custom_') ? key : `custom_${key}`;
            customFieldsObj[normalizedKey] = String(customFields[key] || '');
          });
        }
        
        // Find matching subSkuFamily to get subModelName
        // The specification field contains the subModelName value (e.g., "Pro Max")
        let subModelName = '';
        if (skuFamily && (skuFamily as any).subSkuFamilies && Array.isArray((skuFamily as any).subSkuFamilies)) {
          // Try to match by specification (which should match subName)
          const specification = product.specification || '';
          if (specification) {
            const matchingSubSku = (skuFamily as any).subSkuFamilies.find((sub: any) => 
              sub.subName === specification
            );
            if (matchingSubSku && matchingSubSku.subName) {
              subModelName = matchingSubSku.subName;
            } else {
              // If no exact match, use specification directly as it represents the subModelName
              subModelName = specification;
            }
          }
        } else if (product.specification) {
          // Fallback: use specification directly (it contains the subModelName)
          subModelName = product.specification;
        }
        
        // Map country from database to dropdown code
        // Database stores full names (Hongkong, Dubai) but dropdown uses codes (HK, USA)
        // Convert full names to codes for dropdown selection
        let countryCode = '';
        if (product.country) {
          const countryValue = String(product.country).trim();
          const countryUpper = countryValue.toUpperCase();
          
          // Convert full names to codes for dropdown
          if (countryUpper === 'HONGKONG' || countryUpper === 'HONG KONG') {
            countryCode = 'HK';
          } else if (countryUpper === 'DUBAI' || countryUpper === 'D' || countryUpper === 'UAE') {
            countryCode = 'USA';
          } else if (countryUpper === 'HK' || countryUpper === 'USA') {
            // Already a code, use as-is
            countryCode = countryValue;
          } else {
            // Try to find matching code from constants
            if (constants?.spec?.COUNTRY && Array.isArray(constants.spec.COUNTRY)) {
              const matchingCountry = constants.spec.COUNTRY.find((c: any) => 
                c.name?.toUpperCase() === countryUpper ||
                c.code?.toUpperCase() === countryUpper
              );
              if (matchingCountry) {
                countryCode = matchingCountry.code;
              } else {
                countryCode = countryValue; // Use as-is if no match
              }
            } else {
              countryCode = countryValue; // Use as-is if constants not loaded
            }
          }
        }
        
        // Map isStatus from backend to status field (active/nonactive)
        let statusCode = '';
        if ((product as any).isStatus) {
          const isStatusValue = String((product as any).isStatus).trim().toLowerCase();
          // Map isStatus to status field (active/nonactive)
          if (isStatusValue === 'active' || isStatusValue === 'nonactive' || isStatusValue === 'non active') {
            statusCode = isStatusValue === 'non active' ? 'nonactive' : isStatusValue;
          }
        } else if ((product as any).status) {
          // Fallback to old status field if isStatus not available
          const statusValue = String((product as any).status).trim().toLowerCase();
          if (statusValue === 'active' || statusValue === 'nonactive' || statusValue === 'non active') {
            statusCode = statusValue === 'non active' ? 'nonactive' : statusValue;
          }
        }
        
        // Normalize SIM type to match dropdown values - same logic as admin panel
        // Admin panel uses product.simType directly, but we need to ensure it matches available options
        let simValue = '';
        if (product.simType) {
          const simTypeValue = String(product.simType).trim();
          
          // Get available SIM options for the selected country
          const availableSimOptions = countryCode && constants?.spec?.COUNTRY
            ? (constants.spec.COUNTRY.find((c: any) => c.code === countryCode)?.SIM || [])
            : [];
          
          if (availableSimOptions.length > 0) {
            // Try to find exact match first (case-insensitive)
            const exactMatch = availableSimOptions.find((opt: string) => 
              String(opt).toUpperCase().trim() === simTypeValue.toUpperCase()
            );
            
            if (exactMatch) {
              simValue = exactMatch;
            } else {
              // Try partial/fuzzy matching for common variations
              const simUpper = simTypeValue.toUpperCase();
              const partialMatch = availableSimOptions.find((opt: string) => {
                const optUpper = String(opt).toUpperCase();
                return optUpper.includes(simUpper) || simUpper.includes(optUpper);
              });
              
              if (partialMatch) {
                simValue = partialMatch;
              } else {
                // If no match found, use the original value (might be a valid option not in constants)
                simValue = simTypeValue;
              }
            }
          } else {
            // If no SIM options available for country, use the original value
            simValue = simTypeValue;
          }
        }
        
        // Get paymentTerm and paymentMethod from countryDeliverables or product
        // PaymentTerm might be stored in countryDeliverables[].paymentTerm as full text
        // Need to convert to codes for the dropdown
        let paymentTermValue = '';
        const getPaymentTermCodes = (paymentTerm: any): string => {
          if (!paymentTerm) return '';
          
          // If it's an array, process each item
          const terms = Array.isArray(paymentTerm) ? paymentTerm : [paymentTerm];
          const codes: string[] = [];
          
          terms.forEach((term: any) => {
            if (!term) return;
            const termStr = String(term).trim();
            if (!termStr) return;
            
            // Try to find matching code from paymentTermOptions (access via constants)
            const paymentTermOpts = constants?.paymentTerm || [];
            if (paymentTermOpts && paymentTermOpts.length > 0) {
              // First try exact match by name (case-insensitive)
              const matchByName = paymentTermOpts.find((opt: any) => 
                opt.name?.toLowerCase() === termStr.toLowerCase()
              );
              if (matchByName) {
                codes.push(matchByName.code);
                return;
              }
              
              // Try match by code
              const matchByCode = paymentTermOpts.find((opt: any) => 
                opt.code === termStr
              );
              if (matchByCode) {
                codes.push(matchByCode.code);
                return;
              }
              
              // Try to map common full text values to codes
              const textToCodeMap: Record<string, string> = {
                'on order': 'USD_O',
                'on delivery': 'USD_D',
                'as in conformation': 'USD_CONF',
              };
              
              const lowerTerm = termStr.toLowerCase();
              if (textToCodeMap[lowerTerm]) {
                // Find if this code exists in options
                const codeExists = paymentTermOpts.find((opt: any) => 
                  opt.code === textToCodeMap[lowerTerm]
                );
                if (codeExists) {
                  codes.push(codeExists.code);
                  return;
                }
              }
            }
            
            // If no match found, use as is (might already be a code)
            codes.push(termStr);
          });
          
          return codes.join(', ');
        };
        
        if ((product as any).paymentTerm) {
          paymentTermValue = getPaymentTermCodes((product as any).paymentTerm);
        } else if (hkDeliverable?.paymentTerm || dubaiDeliverable?.paymentTerm) {
          // Get from first available countryDeliverable
          const deliverablePaymentTerm = hkDeliverable?.paymentTerm || dubaiDeliverable?.paymentTerm;
          paymentTermValue = getPaymentTermCodes(deliverablePaymentTerm);
        }
        
        let paymentMethodValue = '';
        const getPaymentMethodCodes = (paymentMethod: any): string => {
          if (!paymentMethod) return '';
          
          // If it's an array, process each item
          const methods = Array.isArray(paymentMethod) ? paymentMethod : [paymentMethod];
          const codes: string[] = [];
          
          methods.forEach((method: any) => {
            if (!method) return;
            const methodStr = String(method).trim();
            if (!methodStr) return;
            
            // Try to find matching code from paymentMethodOptions (access via constants)
            const paymentMethodOpts = constants?.paymentMethod || [];
            if (paymentMethodOpts && paymentMethodOpts.length > 0) {
              // First try exact match by name (case-insensitive)
              const matchByName = paymentMethodOpts.find((opt: any) => 
                opt.name?.toLowerCase() === methodStr.toLowerCase()
              );
              if (matchByName) {
                codes.push(matchByName.code);
                return;
              }
              
              // Try match by code
              const matchByCode = paymentMethodOpts.find((opt: any) => 
                opt.code === methodStr
              );
              if (matchByCode) {
                codes.push(matchByCode.code);
                return;
              }
            }
            
            // If no match found, use as is (might already be a code)
            codes.push(methodStr);
          });
          
          return codes.join(', ');
        };
        
        if ((product as any).paymentMethod) {
          paymentMethodValue = getPaymentMethodCodes((product as any).paymentMethod);
        } else if (hkDeliverable?.paymentMethod || dubaiDeliverable?.paymentMethod) {
          // Get from first available countryDeliverable
          const deliverablePaymentMethod = hkDeliverable?.paymentMethod || dubaiDeliverable?.paymentMethod;
          paymentMethodValue = getPaymentMethodCodes(deliverablePaymentMethod);
        }
        
        // Get subSkuFamilyId from product
        let subSkuFamilyId: string | null = null;
        if ((product as any).subSkuFamilyId) {
          subSkuFamilyId = typeof (product as any).subSkuFamilyId === 'object' 
            ? ((product as any).subSkuFamilyId._id || null)
            : (product as any).subSkuFamilyId;
        }
        
        return {
          subModelName: subModelName,
          storage: product.storage || '',
          colour: product.color || '',
          country: countryCode,
          sim: simValue,
          version: product.specification || '',
          grade: grade,
          status: statusCode,
          lockUnlock: (product as any).lockUnlock ? '1' : '0',
          warranty: (product as any).warranty || '',
          batteryHealth: (product as any).batteryHealth || '',
          packing: (product as any).packing || '',
          currentLocation: (product as any).currentLocation || '',
          hkUsd: hkBasePrice,
          hkXe: hkExchangeRate,
          hkHkd: hkHkdBasePrice,
          dubaiUsd: dubaiBasePrice,
          dubaiXe: dubaiExchangeRate,
          dubaiAed: dubaiAedBasePrice,
          deliveryLocation: Array.isArray((product as any).deliveryLocation) 
            ? (product as any).deliveryLocation 
            : [],
          customMessage: (product as any).customMessage || '',
          totalQty: product.stock || 0,
          moqPerVariant: product.moq || 0,
          weight: (product as any).weight || '',
          purchaseType: (product as any).purchaseType || '',
          paymentTerm: paymentTermValue,
          paymentMethod: paymentMethodValue,
          negotiableFixed: product.isNegotiable ? '1' : '',
          tags: (product as any).tags || '',
          flashDeal: (product as any).isFlashDeal === 'true' || (product as any).isFlashDeal === true ? '1' : '0',
          shippingTime: (product as any).shippingTime || '',
          vendor: (product as any).vendor || '',
          vendorListingNo: (product as any).vendorListingNo || '',
          carrier: (product as any).carrier || '',
          carrierListingNo: (product as any).carrierListingNo || '',
          uniqueListingNo: (product as any).uniqueListingNo || '',
          adminCustomMessage: (product as any).adminCustomMessage || '',
          startTime: (product as any).startTime || '',
          endTime: product.expiryTime || '',
          remark: (product as any).remark || '',
          supplierId: (product as any).sellerId ? (typeof (product as any).sellerId === 'object' ? (product as any).sellerId._id : (product as any).sellerId) : '',
          subSkuFamilyId: subSkuFamilyId,
          supplierListingNumber: (product as any).supplierListingNumber || '',
          customerListingNumber: (product as any).customerListingNumber || '',
          skuFamilyId: typeof product.skuFamilyId === 'object' ? product.skuFamilyId._id : product.skuFamilyId,
          ram: product.ram || '',
          sequence: (product as any).sequence || undefined,
          images: (skuFamily as any)?.images || [],
          ...customFieldsObj,
        };
      });
      console.log('Transformed rows:', transformedRows);
      setRows(transformedRows);

      // Initialize MOQ PER CART (totalMoq) when editing a multi-variant product
      if (variantType === 'multi' && editProducts.length > 0) {
        const firstProduct: any = editProducts[0];
        let initialTotalMoq: number | string = '';

        // Try to read a group/cart MOQ from the product, if backend provides one
        if (firstProduct) {
          if (firstProduct.totalMoq !== undefined && firstProduct.totalMoq !== null) {
            initialTotalMoq = firstProduct.totalMoq;
          } else if (firstProduct.moqPerCart !== undefined && firstProduct.moqPerCart !== null) {
            initialTotalMoq = firstProduct.moqPerCart;
          } else if (firstProduct.cartMoq !== undefined && firstProduct.cartMoq !== null) {
            initialTotalMoq = firstProduct.cartMoq;
          }
        }

        if (initialTotalMoq) {
          setTotalMoq(initialTotalMoq);
        }
      }
      
      // Extract custom columns from backend (product.customColumns) or from custom fields
      // Priority 1: Check if product has customColumns field from backend
      const firstProduct = editProducts[0];
      if (firstProduct && (firstProduct as any).customColumns && Array.isArray((firstProduct as any).customColumns)) {
        // Load custom columns from backend (stored in database)
        const backendCustomCols = (firstProduct as any).customColumns.map((col: any) => ({
          key: col.key.startsWith('custom_') ? col.key : `custom_${col.key}`,
          label: col.label || col.key.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          width: col.width || 150,
        }));
        setCustomColumns(backendCustomCols);
      } else if (transformedRows.length > 0) {
        // Priority 2: Extract custom columns from custom fields data
        const allCustomKeys = new Set<string>();
        editProducts.forEach((product) => {
          const customFields = (product as any).customFields || {};
          if (customFields instanceof Map) {
            customFields.forEach((_value, key) => {
              const normalizedKey = key.startsWith('custom_') ? key : `custom_${key}`;
              allCustomKeys.add(normalizedKey);
            });
          } else if (typeof customFields === 'object' && customFields !== null) {
            Object.keys(customFields).forEach(key => {
              const normalizedKey = key.startsWith('custom_') ? key : `custom_${key}`;
              allCustomKeys.add(normalizedKey);
            });
          }
        });
        if (allCustomKeys.size > 0) {
          const customCols = Array.from(allCustomKeys).map(key => ({
            key,
            label: key.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            width: 150,
          }));
          setCustomColumns(customCols);
        }
      }
      return;
    }
    
    // Priority 2: Load from localStorage if available
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // Only restore if variantType matches
        if (parsed.variantType === variantType && parsed.rows && parsed.rows.length > 0) {
          // Restore custom columns first if they exist
          if (parsed.customColumns && Array.isArray(parsed.customColumns) && parsed.customColumns.length > 0) {
            setCustomColumns(parsed.customColumns);
            // Ensure all rows have custom column fields initialized
            const rowsWithCustomFields = parsed.rows.map((row: ProductRowData) => {
              const rowWithFields = { ...row };
              parsed.customColumns.forEach((col: { key: string; label: string; width: number }) => {
                if (!(col.key in rowWithFields)) {
                  rowWithFields[col.key] = '';
                }
              });
              return rowWithFields;
            });
            setRows(rowsWithCustomFields);
          } else {
            setRows(parsed.rows);
          }
          // Restore totalMoq if it exists and variantType is multi
          if (variantType === 'multi' && parsed.totalMoq !== undefined) {
            setTotalMoq(parsed.totalMoq);
          }
          // Show notification that data was restored
          // toastHelper.showTost(`Restored ${parsed.rows.length} row(s) from saved data`, 'info');
          return;
        }
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    // Priority 3: Initialize rows based on variant type if no saved data and not editing
    if (variantType === 'multi') {
      if (variants.length > 0) {
        const newRows: ProductRowData[] = variants.map((variant, index) => createEmptyRow(index, variant));
        setRows(newRows);
      } else {
        // If no variants provided, create one empty row
        setRows([createEmptyRow(0)]);
      }
    } else if (variantType === 'single') {
      setRows([createEmptyRow(0)]);
    }
  }, [variantType, variants, editProducts, constants]);

  // Sync shipping time mode with values
  useEffect(() => {
    const newModes: Record<number, 'today' | 'tomorrow' | 'calendar' | ''> = {};
    let hasChanges = false;
    
    rows.forEach((row, index) => {
      const shippingTimeValue = row.shippingTime;
      if (!shippingTimeValue) {
        if (shippingTimeMode[index]) {
          newModes[index] = '';
          hasChanges = true;
        }
        return;
      }
      
      try {
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const getToday = (): Date => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return today;
        };
        
        const getTomorrow = (): Date => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          return tomorrow;
        };
        
        const dateValue = new Date(shippingTimeValue);
        dateValue.setHours(0, 0, 0, 0);
        
        const todayStr = formatDate(getToday());
        const tomorrowStr = formatDate(getTomorrow());
        const valueStr = formatDate(dateValue);
        
        let detectedMode: 'today' | 'tomorrow' | 'calendar' | '' = '';
        if (valueStr === todayStr) {
          detectedMode = 'today';
        } else if (valueStr === tomorrowStr) {
          detectedMode = 'tomorrow';
        } else {
          detectedMode = 'calendar';
        }
        
        if (shippingTimeMode[index] !== detectedMode) {
          newModes[index] = detectedMode;
          hasChanges = true;
        }
      } catch (e) {
        // Invalid date, clear mode
        if (shippingTimeMode[index]) {
          newModes[index] = '';
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      setShippingTimeMode((prev) => {
        const updated = { ...prev };
        Object.keys(newModes).forEach((key) => {
          const idx = Number(key);
          const mode = newModes[idx];
          if (mode === '' || mode === 'today' || mode === 'tomorrow' || mode === 'calendar') {
            updated[idx] = mode;
          }
        });
        return updated;
      });
    }
  }, [rows.map(r => r.shippingTime).join(',')]);


  // Save data to localStorage whenever rows, totalMoq, or customColumns change
  useEffect(() => {
    if (rows.length > 0 || customColumns.length > 0) {
      try {
        const dataToSave = {
          variantType,
          rows,
          totalMoq: variantType === 'multi' ? totalMoq : undefined,
          customColumns: customColumns.length > 0 ? customColumns : undefined,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }
    }
  }, [rows, variantType, totalMoq, customColumns]);

  const createEmptyRow = (index: number, variant?: VariantOption): ProductRowData => ({
    subModelName: variant?.subModelName || '',
    storage: variant?.storage || '',
    colour: variant?.color || '',
    country: '',
    sim: '',
    version: '',
    grade: '',
    status: '', // No default - user must select
    lockUnlock: '',
    warranty: '',
    batteryHealth: '',
    packing: '',
    currentLocation: '',
    hkUsd: '',
    hkXe: '',
    hkHkd: '',
    dubaiUsd: '',
    dubaiXe: '',
    dubaiAed: '',
    deliveryLocation: [],
    customMessage: '',
    totalQty: '',
    moqPerVariant: '',
    weight: '',
    purchaseType: '',
    paymentTerm: '',
    paymentMethod: '',
    negotiableFixed: '',
    tags: '',
    flashDeal: '',
    shippingTime: '',
    vendor: '',
    vendorListingNo: '',
    carrier: '',
    carrierListingNo: '',
    uniqueListingNo: '',
    adminCustomMessage: '',
    startTime: '',
    endTime: '',
    remark: '',
    supplierId: getCurrentSellerId(), // Auto-fill with current seller ID
    supplierListingNumber: '',
    customerListingNumber: '',
    skuFamilyId: variant?.skuFamilyId || '',
    subSkuFamilyId: (variant as any)?.subSkuFamilyId || null,
    ram: variant?.ram,
    sequence: index + 1,
    // Initialize custom fields
    ...customColumns.reduce((acc, col) => {
      acc[col.key] = '';
      return acc;
    }, {} as Record<string, string>),
  });

  // Load permissions and fetch dropdown data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Load seller permissions
        try {
          const sellerPermissions = await SellerProductPermissionService.getCurrentSellerPermissions();
          setPermissions(sellerPermissions);
          // If no permissions returned, use empty array (strict mode - no fields visible)
          if (!sellerPermissions || sellerPermissions.length === 0) {
            console.warn('No seller permissions found. No fields will be visible.');
            setPermissions([]);
          }
        } catch (error: any) {
          console.warn('Error loading seller permissions. No fields will be visible.');
          // Don't set all fields to true - use empty array for strict mode
          setPermissions([]);
        }
        
        const gradeResponse = await GradeService.getGradeList(1, 1000);
        setGrades(gradeResponse.data.docs || []);
        const skuFamiliesList = await SkuFamilyService.getSkuFamilyListByName();
        setSkuFamilies(skuFamiliesList || []);
        const constantsData = await ConstantsService.getConstants();
        setConstants(constantsData);
        
        // Fetch next customer listing number WITH multi-variant support
        try {
          const customerListingData = await ProductService.getNextCustomerListingNumber(variantType === 'multi');
          setCurrentCustomerListingNumber(customerListingData.data?.listingNumber || 1);
        } catch (error) {
          console.error('Error fetching customer listing number:', error);
          // Default to 1 if fetch fails
          setCurrentCustomerListingNumber(1);
        }
        
        // Fetch next unique listing number (8-digit)
        try {
          const uniqueListingData = await ProductService.getNextUniqueListingNumber();
          setCurrentUniqueListingNumber(parseInt(uniqueListingData.data?.uniqueListingNumber || '10000000', 10));
        } catch (error) {
          console.error('Error fetching unique listing number:', error);
          // Default to 10000000 if fetch fails
          setCurrentUniqueListingNumber(10000000);
        }

        // Fetch next supplier listing number for current seller
        try {
          const supplierListingData = await ProductService.getNextSupplierListingNumber(variantType === 'multi');
          if (supplierListingData.data) {
            setSupplierListingNumberInfo({
              listingNumber: supplierListingData.data.listingNumber || 1,
              supplierCode: supplierListingData.data.supplierCode || getCurrentSellerCode()
            });
          } else {
            // Fallback: use seller code from storage
            const sellerCode = getCurrentSellerCode();
            if (sellerCode) {
              setSupplierListingNumberInfo({
                listingNumber: 1,
                supplierCode: sellerCode
              });
            }
          }
        } catch (error) {
          console.error('Error fetching supplier listing number:', error);
          // Use seller code from storage as fallback
          const sellerCode = getCurrentSellerCode();
          if (sellerCode) {
            setSupplierListingNumberInfo({
              listingNumber: 1,
              supplierCode: sellerCode
            });
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toastHelper.showTost('Failed to load form data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper function to check if field has permission
  const hasPermission = (fieldName: string): boolean => {
    // Strict mode: Only show fields with explicit permission
    // If no permissions loaded, don't show any field (strict mode)
    if (permissions.length === 0) {
      return false;
    }
    
    const permission = permissions.find(p => p.fieldName === fieldName);
    // Only show if permission explicitly granted
    return permission?.hasPermission ?? false;
  };

  // Flatten SKU Families with subSkuFamilies for search
  const getFlattenedSkuFamilyOptions = () => {
    const options: any[] = [];
    skuFamilies.forEach((skuFamily) => {
      // Add SKU Family itself (if it has no subSkuFamilies or we want to show it)
      if (!skuFamily.subSkuFamilies || skuFamily.subSkuFamilies.length === 0) {
        options.push({
          skuFamilyId: skuFamily._id,
          skuFamilyName: skuFamily.name,
          subModelName: skuFamily.name,
          storage: '',
          storageId: null,
          colour: '',
          colorId: null,
          ram: '',
          ramId: null,
          displayText: `${skuFamily.name}${skuFamily.brand ? ` - ${skuFamily.brand.title}` : ''}`,
        });
      } else {
        // Add each subSkuFamily as a separate option
        skuFamily.subSkuFamilies.forEach((subSku: any) => {
          options.push({
            skuFamilyId: skuFamily._id,
            skuFamilyName: skuFamily.name,
            subModelName: subSku.subName || skuFamily.name,
            subSkuFamilyId: subSku._id || null,
            storage: subSku.storageId?.title || '',
            storageId: subSku.storageId?._id || null,
            colour: subSku.colorId?.title || '',
            colorId: subSku.colorId?._id || null,
            ram: subSku.ramId?.title || '',
            ramId: subSku.ramId?._id || null,
            displayText: `${skuFamily.name}${subSku.subName ? ` - ${subSku.subName}` : ''}${subSku.storageId?.title ? ` - ${subSku.storageId.title}` : ''}${subSku.colorId?.title ? ` - ${subSku.colorId.title}` : ''}${subSku.ramId?.title ? ` - ${subSku.ramId.title}` : ''}`,
          });
        });
      }
    });
    return options;
  };

  // Search functionality for top search - removed as it's not used (commented out in UI)

  // Search functionality for row-specific SKU Family search
  useEffect(() => {
    if (!rowSkuFamilySearch) {
      setRowSkuFamilySearchResults([]);
      return;
    }

    const allOptions = getFlattenedSkuFamilyOptions();
    
    // If query is empty, show all options; otherwise filter
    if (!rowSkuFamilySearch.query.trim()) {
      setRowSkuFamilySearchResults(allOptions);
      setRowSkuFamilySearch(prev => prev ? { ...prev, showResults: allOptions.length > 0 } : null);
    } else {
      const query = rowSkuFamilySearch.query.toLowerCase().trim();
      const filtered = allOptions.filter((option) => {
        const searchText = `${option.skuFamilyName} ${option.subModelName} ${option.storage} ${option.colour} ${option.ram}`.toLowerCase();
        return searchText.includes(query);
      });

      setRowSkuFamilySearchResults(filtered);
      setRowSkuFamilySearch(prev => prev ? { ...prev, showResults: filtered.length > 0 } : null);
    }
  }, [rowSkuFamilySearch?.query, skuFamilies]);

  // Handle selection from search results (top search)

  // Handle selection from row-specific SKU Family search
  const handleRowSkuFamilySearchSelect = (option: any, rowIndex: number) => {
    // Update SKU Family ID
    updateRow(rowIndex, 'skuFamilyId', option.skuFamilyId);
    
    // Update subSkuFamilyId if available
    if (option.subSkuFamilyId) {
      updateRow(rowIndex, 'subSkuFamilyId', option.subSkuFamilyId);
    } else {
      updateRow(rowIndex, 'subSkuFamilyId', null);
    }
    
    // Auto-fill related fields from selected SKU Family (matching admin panel behavior)
    updateRow(rowIndex, 'subModelName', option.subModelName || '');
    updateRow(rowIndex, 'storage', option.storage || '');
    updateRow(rowIndex, 'colour', option.colour || '');
    if (option.ram) {
      updateRow(rowIndex, 'ram', option.ram);
    }
    
    // Close search dropdown
    setRowSkuFamilySearch(null);
    setRowSkuFamilySearchResults([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N to add row
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        addRow();
      }
      // Delete key to remove row if focused
      if (e.key === 'Delete' && focusedCell) {
        const cell = cellRefs.current[`${focusedCell.row}-${focusedCell.col}`];
        if (cell && 'value' in cell) {
          updateRow(focusedCell.row, focusedCell.col as keyof ProductRowData, '');
        }
      }
      // Escape key to close SKU Family search
      if (e.key === 'Escape' && rowSkuFamilySearch) {
        setRowSkuFamilySearch(null);
        setRowSkuFamilySearchResults([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, rows.length, rowSkuFamilySearch]);

  // Removed supplier dropdown click outside handler

  // Auto-calculate delivery location and currency conversions
  useEffect(() => {
    setRows(prevRows => prevRows.map(row => {
      const updatedRow = { ...row };
      
      // Auto-calculate delivery location based on pricing
      const locations: string[] = [];
      // If HK pricing exists, add HK to delivery locations
      if (row.hkUsd || row.hkHkd) {
        locations.push('HK');
      }
      // If Dubai pricing exists, add D to delivery locations
      if (row.dubaiUsd || row.dubaiAed) {
        locations.push('D');
      }
      updatedRow.deliveryLocation = locations;
      
      return updatedRow;
    }));
  }, [rows.map(r => `${r.currentLocation}-${r.hkUsd}-${r.hkHkd}-${r.dubaiUsd}-${r.dubaiAed}`).join(',')]);

  // Auto-generate customer listing numbers when rows change
  // Format: L{number}-{index+1} for single, L{number}M{number}-{index+1} for multi
  // Counting is overall (not per seller), NO supplier code
  // For multi-variant: M number matches L number (L1M1, L2M2, etc.) - same as admin panel
  useEffect(() => {
    if (currentCustomerListingNumber !== null && rows.length > 0) {
      setRows(prevRows => prevRows.map((row, index) => {
        const updatedRow = { ...row };
        let prefix = `L${currentCustomerListingNumber}`;
        // For multi-variant: L{N}M{N} (e.g., L1M1, L2M2) - M number matches L number
        if (variantType === 'multi') {
          prefix = `L${currentCustomerListingNumber}M${currentCustomerListingNumber}`;
        }

        const customerListingNo = `${prefix}-${index + 1}`;

        if (!updatedRow.customerListingNumber || updatedRow.customerListingNumber !== customerListingNo) {
          updatedRow.customerListingNumber = customerListingNo;
        }
        return updatedRow;
      }));
    }
  }, [rows.length, currentCustomerListingNumber, variantType]);

  // Auto-generate unique listing numbers when rows change
  useEffect(() => {
    if (currentUniqueListingNumber !== null && rows.length > 0) {
      setRows(prevRows => prevRows.map((row, index) => {
        const updatedRow = { ...row };
        const uniqueListingNo = String(currentUniqueListingNumber + index).padStart(8, '0');
        if (!updatedRow.uniqueListingNo || updatedRow.uniqueListingNo !== uniqueListingNo) {
          updatedRow.uniqueListingNo = uniqueListingNo;
        }
        return updatedRow;
      }));
    }
  }, [rows.length, currentUniqueListingNumber]);

  // Auto-generate supplier listing numbers when rows change
  // Format: {supplierCode}-L{number}-{index+1} for single, {supplierCode}-L{number}M{number}-{index+1} for multi
  // Counting is per seller (individual), includes supplier code
  // For multi-variant: M number matches L number (L1M1, L2M2, etc.) - same as admin panel
  useEffect(() => {
    if (!supplierListingNumberInfo || rows.length === 0) return;
    
    setRows(prevRows => {
      let hasChanges = false;
      const updatedRows = prevRows.map((row, index) => {
        const updatedRow = { ...row };
        
        // Count how many rows come before this row (for product number) - per seller individual counting
        const productNum = index + 1;
        
        // For multi-variant: L{N}M{N} (e.g., L1M1, L2M2) - M number matches L number
        // For single: L{N}
        const listingPrefix = variantType === 'multi' 
          ? `L${supplierListingNumberInfo.listingNumber}M${supplierListingNumberInfo.listingNumber}` 
          : `L${supplierListingNumberInfo.listingNumber}`;
        
        // Include supplier code in supplier listing number
        const expectedListingNo = `${supplierListingNumberInfo.supplierCode}-${listingPrefix}-${productNum}`;
        
        if (updatedRow.supplierListingNumber !== expectedListingNo) {
          hasChanges = true;
          updatedRow.supplierListingNumber = expectedListingNo;
        }
        
        return updatedRow;
      });
      
      return hasChanges ? updatedRows : prevRows;
    });
  }, [rows.length, supplierListingNumberInfo, variantType]);

  // Removed auto-generation of customer/unique/supplier listing numbers - sellers don't need these

  const updateRow = (index: number, field: keyof ProductRowData, value: any) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      newRows[index] = { ...newRows[index], [field]: value };

      // In multi-variant mode, keep group-level fields identical across all rows.
      if (variantType === 'multi' && groupLevelFields.includes(field)) {
        for (let i = 0; i < newRows.length; i++) {
          if (i !== index) {
            (newRows[i] as any)[field] = value;
          }
        }
      }
      
      // Removed supplier listing number auto-generation - sellers don't select suppliers
      
      // Auto-calculate currency conversions for HK
      if (field === 'hkUsd' || field === 'hkXe' || field === 'hkHkd') {
        const usd = parseFloat(String(newRows[index].hkUsd)) || 0;
        const xe = parseFloat(String(newRows[index].hkXe)) || 0;
        const hkd = parseFloat(String(newRows[index].hkHkd)) || 0;
        
        // Count how many values are present (greater than 0)
        const valuesCount = [usd, xe, hkd].filter(v => v > 0).length;
        
        // Only calculate if at least 2 values exist
        if (valuesCount >= 2) {
          // Calculate the missing value when any two values exist
          // Priority: don't overwrite the field being edited
          if (field !== 'hkHkd' && usd > 0 && xe > 0) {
            // If USD and XE exist, calculate HKD (multiply USD * XE)
            newRows[index].hkHkd = (usd * xe).toFixed(2);
          } else if (field !== 'hkUsd' && hkd > 0 && xe > 0) {
            // If HKD and XE exist, calculate USD (divide HKD / XE)
            newRows[index].hkUsd = (hkd / xe).toFixed(2);
          } else if (field !== 'hkXe' && usd > 0 && hkd > 0) {
            // If USD and HKD exist, calculate XE (divide HKD / USD)
            newRows[index].hkXe = (hkd / usd).toFixed(4);
          }
        }
      }
      
      // Auto-calculate currency conversions for Dubai
      if (field === 'dubaiUsd' || field === 'dubaiXe' || field === 'dubaiAed') {
        const usd = parseFloat(String(newRows[index].dubaiUsd)) || 0;
        const xe = parseFloat(String(newRows[index].dubaiXe)) || 0;
        const aed = parseFloat(String(newRows[index].dubaiAed)) || 0;
        
        // Count how many values are present (greater than 0)
        const valuesCount = [usd, xe, aed].filter(v => v > 0).length;
        
        // Only calculate if at least 2 values exist
        if (valuesCount >= 2) {
          // Calculate the missing value when any two values exist
          // Priority: don't overwrite the field being edited
          if (field !== 'dubaiAed' && usd > 0 && xe > 0) {
            // If USD and XE exist, calculate AED (multiply USD * XE)
            newRows[index].dubaiAed = (usd * xe).toFixed(2);
          } else if (field !== 'dubaiUsd' && aed > 0 && xe > 0) {
            // If AED and XE exist, calculate USD (divide AED / XE)
            newRows[index].dubaiUsd = (aed / xe).toFixed(2);
          } else if (field !== 'dubaiXe' && usd > 0 && aed > 0) {
            // If USD and AED exist, calculate XE (divide AED / USD)
            newRows[index].dubaiXe = (aed / usd).toFixed(4);
          }
        }
      }
      
      return newRows;
    });
  };

  const addRow = () => {
    setRows(prevRows => {
      const baseRow = createEmptyRow(prevRows.length);

      // In multi-variant mode, new variants inherit group-level fields from master row (row 0)
      if (variantType === 'multi' && prevRows.length > 0) {
        const master = prevRows[0];
        groupLevelFields.forEach((field) => {
          (baseRow as any)[field] = (master as any)[field];
        });
      }

      return [...prevRows, baseRow];
    });
  };

  const removeRow = (index: number) => {
    if (rows.length > 1) {
      setRows(prevRows => prevRows.filter((_, i) => i !== index));
    }
  };

  const duplicateRow = (index: number) => {
    setRows(prevRows => {
      const newRow = { ...prevRows[index], sequence: prevRows.length + 1 };
      // Clear unique fields
      newRow.uniqueListingNo = '';
      newRow.supplierId = getCurrentSellerId();
      newRow.supplierListingNumber = '';
      newRow.customerListingNumber = '';
      newRow.tags = '';
      return [...prevRows, newRow];
    });
  };

  const fillDown = (rowIndex: number, columnKey: string) => {
    if (rowIndex === rows.length - 1) return;
    const value = rows[rowIndex][columnKey as keyof ProductRowData];
    updateRow(rowIndex + 1, columnKey as keyof ProductRowData, value);
  };

  const fillAllBelow = (rowIndex: number, columnKey: string) => {
    const value = rows[rowIndex][columnKey as keyof ProductRowData];
    setRows(prevRows => prevRows.map((row, idx) => 
      idx > rowIndex ? { ...row, [columnKey]: value } : row
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For multi-variant products, enforce that all group-level fields match the master row
    let normalizedRows = rows;
    if (variantType === 'multi' && rows.length > 1) {
      const master = rows[0];
      normalizedRows = rows.map((row, index) => {
        if (index === 0) return row;
        const updated: ProductRowData = { ...row };
        groupLevelFields.forEach((field) => {
          (updated as any)[field] = (master as any)[field];
        });
        return updated;
      });
    }
    
    // Set current time for start time if not entered
    const currentTime = new Date().toISOString();
    const updatedRows = normalizedRows.map(row => ({
      ...row,
      startTime: row.startTime || currentTime
    }));
    setRows(updatedRows);
    
    // Validate required fields based on permissions
    const errors: string[] = [];
      updatedRows.forEach((row, index) => {
        if (hasPermission('supplierId') && !row.supplierId) errors.push(`Row ${index + 1}: SUPPLIER ID is required`);
      if (hasPermission('skuFamilyId') && !row.skuFamilyId) errors.push(`Row ${index + 1}: SKU Family is required`);
        if (hasPermission('subModelName') && !row.subModelName) errors.push(`Row ${index + 1}: SubModelName is required`);
        if (hasPermission('storage') && !row.storage) errors.push(`Row ${index + 1}: Storage is required`);
        if (hasPermission('colour') && !row.colour) errors.push(`Row ${index + 1}: Colour is required`);
        if (hasPermission('country') && !row.country) errors.push(`Row ${index + 1}: Country is required`);
        if (hasPermission('sim') && !row.sim) errors.push(`Row ${index + 1}: SIM is required`);
        if (hasPermission('grade') && !row.grade) errors.push(`Row ${index + 1}: GRADE is required`);
        if (hasPermission('status') && !row.status) errors.push(`Row ${index + 1}: STATUS is required`);
        if (hasPermission('lockUnlock') && !row.lockUnlock) errors.push(`Row ${index + 1}: LOCK/UNLOCK is required`);
        if (hasPermission('packing') && !row.packing) errors.push(`Row ${index + 1}: PACKING is required`);
        if (hasPermission('currentLocation') && !row.currentLocation) errors.push(`Row ${index + 1}: CURRENT LOCATION is required`);
        if (hasPermission('totalQty') && !row.totalQty) errors.push(`Row ${index + 1}: TOTAL QTY is required`);
        if (hasPermission('moqPerVariant') && !row.moqPerVariant) errors.push(`Row ${index + 1}: MOQ/VARIANT is required`);
        if (hasPermission('supplierListingNumber') && !row.supplierListingNumber) errors.push(`Row ${index + 1}: SUPPLIER LISTING NO is required`);
        if (hasPermission('customerListingNumber') && !row.customerListingNumber) errors.push(`Row ${index + 1}: CUSTOMER LISTING NO is required`);
        if (hasPermission('paymentTerm') && !row.paymentTerm) errors.push(`Row ${index + 1}: PAYMENT TERM is required`);
        if (hasPermission('paymentMethod') && (!row.paymentMethod || row.paymentMethod.trim() === '')) {
          errors.push(`Row ${index + 1}: PAYMENT METHOD is required`);
        }
        if (hasPermission('endTime') && !row.endTime) errors.push(`Row ${index + 1}: END TIME is required`);
        
        // Validate: End time must be greater than start time
        if (hasPermission('startTime') && hasPermission('endTime') && row.startTime && row.endTime) {
          const startTime = new Date(row.startTime);
          const endTime = new Date(row.endTime);
          if (endTime <= startTime) {
            errors.push(`Row ${index + 1}: END TIME must be greater than START TIME`);
          }
        }
        
        // Validate: No past dates allowed for start time
        if (hasPermission('startTime') && row.startTime) {
          const startTime = new Date(row.startTime);
          const now = new Date();
          if (startTime < now) {
            errors.push(`Row ${index + 1}: START TIME cannot be in the past`);
          }
        }
        
        // Validate: No past dates allowed for end time
        if (hasPermission('endTime') && row.endTime) {
          const endTime = new Date(row.endTime);
          const now = new Date();
          if (endTime < now) {
            errors.push(`Row ${index + 1}: END TIME cannot be in the past`);
          }
        }
      });

    if (errors.length > 0) {
      // Use a better error display
      // const errorMessage = `Please fix the following ${errors.length} error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n\n... and ${errors.length - 10} more errors` : ''}`;
      // if (window.confirm(errorMessage + '\n\nDo you want to continue anyway?')) {
      //   // User wants to continue despite errors
      // } else {
      //   return;
      // }
    }

    const rowsWithListingNos = updatedRows;
    
    // Validate MOQ PER CART for multi-variant products (only if permission exists)
    if (variantType === 'multi' && hasPermission('totalMoq')) {
      const totalMoqValue = typeof totalMoq === 'string' ? totalMoq.trim() : totalMoq;
      if (!totalMoqValue || totalMoqValue === '' || totalMoqValue === '0' || Number(totalMoqValue) <= 0) {
        toastHelper.showTost('MOQ PER CART is required for multi-variant products', 'error');
        return;
      }
    }
    
    // If editing, bypass margin/cost flow and directly save
    if (editProducts && editProducts.length > 0) {
      // Direct save for edit mode - preserve existing margins and costs
      // Pass customColumns so ProductVariantForm knows which custom fields to include
      onSave(rowsWithListingNos, variantType === 'multi' && hasPermission('totalMoq') ? totalMoq : undefined, customColumns);
      return;
    }
    
    // For sellers, directly create product requests (no margin/cost modals)
    await handleDirectSubmit(rowsWithListingNos, variantType === 'multi' && hasPermission('totalMoq') ? totalMoq : undefined);
  };

  // Direct submit for sellers (no margin/cost selection)
  const handleDirectSubmit = async (rowsToSubmit: ProductRowData[], totalMoqValue?: number | string) => {
    try {
      setLoading(true);
      
      // Transform rows to backend format
      const productsToCreate = rowsToSubmit.map(row => {
        const cleanString = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          return val;
        };
        
        // Normalize paymentTerm to a single valid value (backend only accepts single values)
        // Maps codes to full text values that the validator expects
        const normalizePaymentTerm = (val: string | null | undefined): string | null => {
          if (!val || val === '' || (typeof val === 'string' && val.trim() === '')) return null;
          const trimmed = val.trim();
          // If comma-separated, take the first value
          const firstValue = trimmed.split(',')[0].trim();
          
          // Try to find the paymentTerm option by code and use its name
          if (paymentTermOptions && paymentTermOptions.length > 0) {
            const option = paymentTermOptions.find(opt => opt.code === firstValue);
            if (option && option.name) {
              // Validate that the name matches allowed values
              const allowedValues = ['on order', 'on delivery', 'as in conformation'];
              const lowerName = option.name.toLowerCase();
              const matched = allowedValues.find(v => v.toLowerCase() === lowerName);
              if (matched) {
                return matched;
              }
            }
          }
          
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

        // Helper to normalize country - same as admin panel: store code directly (HK or USA)
        // Admin panel stores row.country directly without normalization
        const normalizeCountry = (country: string | null | undefined): string | null => {
          if (!country) return null;
          // Return as is - admin panel stores codes directly (HK for Hongkong, USA for Dubai)
          return country.trim() || null;
        };
        
        const countryDeliverables: any[] = [];
        
        if (hasPermission('hkUsd') || hasPermission('hkHkd')) {
          if (row.hkUsd || row.hkHkd) {
            countryDeliverables.push({
              country: 'Hongkong',
              currency: 'USD',
              basePrice: parseFloat(String(row.hkUsd)) || 0,
              exchangeRate: parseFloat(String(row.hkXe)) || null,
              // Legacy fields
              usd: parseFloat(String(row.hkUsd)) || 0,
              xe: parseFloat(String(row.hkXe)) || 0,
              local: parseFloat(String(row.hkHkd)) || 0,
              hkd: parseFloat(String(row.hkHkd)) || 0,
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
              exchangeRate: parseFloat(String(row.dubaiXe)) || null,
              // Legacy fields
              usd: parseFloat(String(row.dubaiUsd)) || 0,
              xe: parseFloat(String(row.dubaiXe)) || 0,
              local: parseFloat(String(row.dubaiAed)) || 0,
              aed: parseFloat(String(row.dubaiAed)) || 0,
              paymentTerm: hasPermission('paymentTerm') ? normalizePaymentTerm(row.paymentTerm) : null,
              paymentMethod: hasPermission('paymentMethod') ? (cleanString(row.paymentMethod) || null) : null,
            });
          }
        }

        // Build product object - only include fields with permission
        const product: any = {};
        
        // Backend-required fields - always include, but use permission-based values or defaults
        // skuFamilyId is required by backend
        if (hasPermission('skuFamilyId') && row.skuFamilyId && /^[0-9a-fA-F]{24}$/.test(row.skuFamilyId)) {
          product.skuFamilyId = row.skuFamilyId;
        } else if (!hasPermission('skuFamilyId')) {
          // If no permission, skip this product (can't create without skuFamilyId)
          // Or provide a default - but this should be handled by validation
          // For now, we'll skip products without skuFamilyId permission
          return null;
        }
        
        // Include subSkuFamilyId if available (from SKU Family selection)
        if (row.subSkuFamilyId && /^[0-9a-fA-F]{24}$/.test(row.subSkuFamilyId)) {
          product.subSkuFamilyId = row.subSkuFamilyId;
        } else {
          product.subSkuFamilyId = null;
        }
        
        // stock is required by backend
        if (hasPermission('totalQty')) {
          product.stock = parseFloat(String(row.totalQty)) || 0;
        } else {
          // If no permission, use default value 0
          product.stock = 0;
        }
        
        // Only include gradeId if permission exists and value is valid
        if (hasPermission('grade') && row.grade && /^[0-9a-fA-F]{24}$/.test(row.grade)) {
          product.gradeId = row.grade;
        }
        
        // Only include specification if permission exists
        if (hasPermission('subModelName') || hasPermission('version')) {
          const spec = cleanString(row.subModelName) || cleanString(row.version) || cleanString((row as any).specification);
          if (spec) {
            product.specification = spec;
          }
        }
        
        // Only include simType if permission exists
        if (hasPermission('sim') && row.sim) {
          product.simType = row.sim;
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
        if (hasPermission('country')) {
          const country = normalizeCountry(cleanString(row.country));
          if (country) {
            product.country = country;
          }
        }
        
        // Only include moq if permission exists
        if (hasPermission('moqPerVariant')) {
          product.moq = parseFloat(String(row.moqPerVariant)) || 1;
        } else {
          // Default moq value
          product.moq = 1;
        }
        
        // Only include purchaseType if permission exists
        if (hasPermission('purchaseType')) {
          product.purchaseType = (row.purchaseType === 'full' || row.purchaseType === 'partial') ? row.purchaseType : '';
        }
        // Collect custom fields and send to backend
        // Remove custom_ prefix when sending to backend (backend stores without prefix)
        // Always include customFields in payload if customColumns exist
        if (customColumns.length > 0) {
          const customFieldsMap: Record<string, string> = {};
          customColumns.forEach(customCol => {
            const value = row[customCol.key as keyof ProductRowData];
            // Remove custom_ prefix when sending to backend
            const backendKey = customCol.key.startsWith('custom_') 
              ? customCol.key.replace(/^custom_/, '') 
              : customCol.key;
            // Include value even if empty (backend can handle empty strings)
            customFieldsMap[backendKey] = (value && typeof value === 'string') ? value.trim() : '';
          });
          // Always include customFields in payload
          product.customFields = customFieldsMap;
          
          // Store custom column definitions (metadata) in payload for backend storage
          // Backend will store this to restore columns when editing
          product.customColumns = customColumns.map(col => ({
            key: col.key.startsWith('custom_') ? col.key.replace(/^custom_/, '') : col.key,
            label: col.label,
            width: col.width
          }));
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
          product.groupCode = `GROUP-${Date.now()}`;
        }
        
        // Sequence
        if (row.sequence) {
          product.sequence = row.sequence;
        }
        
        // Country deliverables
        if (countryDeliverables.length > 0) {
          product.countryDeliverables = countryDeliverables;
        }
        
        // Always include sellerId
        product.sellerId = hasPermission('supplierId') ? (cleanString(row.supplierId) || getCurrentSellerId()) : getCurrentSellerId();
        
        // Only include supplierListingNumber if permission exists and value is provided
        if (hasPermission('supplierListingNumber')) {
          const supplierListingNo = cleanString(row.supplierListingNumber);
          if (supplierListingNo) {
            product.supplierListingNumber = supplierListingNo;
          }
        }
        
        // Only include customerListingNumber if permission exists and value is provided
        if (hasPermission('customerListingNumber')) {
          const customerListingNo = cleanString(row.customerListingNumber);
          if (customerListingNo) {
            product.customerListingNumber = customerListingNo;
          }
        }
        
        // Only include packing if permission exists and value is provided
        if (hasPermission('packing')) {
          const packingValue = cleanString(row.packing);
          if (packingValue) {
            product.packing = packingValue;
          }
        }
        
        // Only include currentLocation if permission exists and value is provided
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
        
        // Only include customMessage if permission exists and value is provided
        if (hasPermission('customMessage')) {
          const customMsg = cleanString(row.customMessage);
          if (customMsg) {
            product.customMessage = customMsg;
          }
        }
        
        // Only include totalMoq if permission exists
        if (variantType === 'multi' && hasPermission('totalMoq') && totalMoqValue) {
          product.totalMoq = parseFloat(String(totalMoqValue));
        }
        
        // Only include paymentTerm if permission exists and value is provided
        if (hasPermission('paymentTerm')) {
          const paymentTermValue = cleanString(row.paymentTerm);
          if (paymentTermValue) {
            product.paymentTerm = paymentTermValue;
          }
        }
        
        // Only include paymentMethod if permission exists and value is provided
        if (hasPermission('paymentMethod')) {
          const paymentMethodValue = cleanString(row.paymentMethod);
          if (paymentMethodValue) {
            product.paymentMethod = paymentMethodValue;
          }
        }
        
        // Only include shippingTime if permission exists and value is provided
        if (hasPermission('shippingTime')) {
          const shippingTimeValue = cleanString(row.shippingTime);
          if (shippingTimeValue) {
            product.shippingTime = shippingTimeValue;
          }
        }
        
        // Only include vendor if permission exists and value is provided
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
        
        // Only include vendorListingNo if permission exists and value is provided
        if (hasPermission('vendorListingNo')) {
          const vendorListingNoValue = cleanString(row.vendorListingNo);
          if (vendorListingNoValue) {
            product.vendorListingNo = vendorListingNoValue;
          }
        }
        
        // Only include carrier if permission exists and value is provided
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
        
        // Only include carrierListingNo if permission exists and value is provided
        if (hasPermission('carrierListingNo')) {
          const carrierListingNoValue = cleanString(row.carrierListingNo);
          if (carrierListingNoValue) {
            product.carrierListingNo = carrierListingNoValue;
          }
        }
        
        // Only include uniqueListingNo if permission exists and value is provided
        if (hasPermission('uniqueListingNo')) {
          const uniqueListingNoValue = cleanString(row.uniqueListingNo);
          if (uniqueListingNoValue) {
            product.uniqueListingNo = uniqueListingNoValue;
          }
        }
        
        // Only include tags if permission exists and value is provided
        if (hasPermission('tags')) {
          const tagsValue = cleanString(row.tags);
          if (tagsValue) {
            product.tags = tagsValue;
          }
        }
        
        // Only include remark if permission exists and value is provided
        if (hasPermission('remark')) {
          const remarkValue = cleanString(row.remark);
          if (remarkValue) {
            product.remark = remarkValue;
          }
        }
        
        // Only include warranty if permission exists and value is provided
        if (hasPermission('warranty')) {
          const warrantyValue = cleanString(row.warranty);
          if (warrantyValue) {
            product.warranty = warrantyValue;
          }
        }
        
        // Only include batteryHealth if permission exists and value is provided
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
          const statusValue = row.status ? String(row.status).trim().toLowerCase() : 'active';
          // Map status to isStatus field
          if (statusValue === 'active' || statusValue === 'nonactive' || statusValue === 'non active') {
            product.isStatus = statusValue === 'non active' ? 'nonactive' : statusValue;
          } else {
            // Default to active if invalid value
            product.isStatus = 'active';
          }
        } else {
          // Default to active if no permission
          product.isStatus = 'active';
        }
        
        return product;
      });

      // Filter out null products (products without required fields like skuFamilyId)
      const validProducts = productsToCreate.filter(product => product !== null);
      
      if (validProducts.length === 0) {
        toastHelper.showTost('No valid products to create. Please ensure SKU Family is selected for at least one product.', 'error');
        setLoading(false);
        return;
      }
      
      // Create all product requests using seller service
      const createPromises = validProducts.map(product => 
        ProductService.createSellerProductRequest(product)
      );

      await Promise.all(createPromises);
      
      // Clear localStorage on successful save
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error('Error clearing localStorage:', error);
      }
      
      toastHelper.showTost('Product requests submitted successfully! They will be reviewed by admin.', 'success');
      
      // Products are already created above - don't call onSave as it would create duplicate products
      // Navigate directly to products list
      setTimeout(() => {
        window.location.href = '/seller/#/products';
      }, 1000);
    } catch (error: any) {
      console.error('Error creating product requests:', error);
      const errorMessage = error.message || 'Failed to submit product requests';
      
      // Check if it's a business profile approval error
      if (errorMessage.includes('business profile must be approved') || errorMessage.includes('BUSINESS_PROFILE_NOT_APPROVED')) {
        // Show confirmation/info box instead of error toast
        await Swal.fire({
          icon: "info",
          title: "Business Profile Approval Required",
          html: `<p style="text-align: left; margin: 10px 0;">${errorMessage}</p>`,
          confirmButtonText: "OK",
          confirmButtonColor: "#0071E0",
          width: "500px",
        });
      } else {
        toastHelper.showTost(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Removed modal handlers - sellers don't set margins/costs

  // Column definitions - filtered by permissions
  const allColumns = [
    { key: 'supplierId', label: 'SUPPLIER ID*', width: 180, group: 'Supplier Info', permissionField: 'supplierId' },
    { key: 'supplierListingNumber', label: 'SUPPLIER LISTING NO*', width: 180, group: 'Supplier Info', permissionField: 'supplierListingNumber' },
    { key: 'customerListingNumber', label: 'CUSTOMER LISTING NO*', width: 180, group: 'Supplier Info', permissionField: 'customerListingNumber' },
    { key: 'skuFamilyId', label: 'SKU FAMILY*', width: 200, group: 'Product Detail', permissionField: 'skuFamilyId' },
    { key: 'subModelName', label: 'SUB MODEL NAME*', width: 150, group: 'Product Detail', permissionField: 'subModelName' },
    { key: 'storage', label: 'STORAGE*', width: 100, group: 'Product Detail', permissionField: 'storage' },
    { key: 'colour', label: 'COLOUR*', width: 100, group: 'Product Detail', permissionField: 'colour' },
    { key: 'country', label: 'COUNTRY*', width: 120, group: 'Product Detail', permissionField: 'country' },
    { key: 'sim', label: 'SIM*', width: 120, group: 'Product Detail', permissionField: 'sim' },
    { key: 'version', label: 'VERSION', width: 120, group: 'Product Detail', permissionField: 'version' },
    { key: 'grade', label: 'GRADE*', width: 140, group: 'Product Detail', permissionField: 'grade' },
    { key: 'status', label: 'STATUS*', width: 100, group: 'Product Detail', permissionField: 'status' },
    { key: 'lockUnlock', label: 'LOCK/UNLOCK*', width: 120, group: 'Product Detail', permissionField: 'lockUnlock' },
    { key: 'warranty', label: 'WARRANTY', width: 120, group: 'Product Detail', permissionField: 'warranty' },
    { key: 'batteryHealth', label: 'BATTERY HEALTH', width: 130, group: 'Product Detail', permissionField: 'batteryHealth' },
    { key: 'packing', label: 'PACKING*', width: 120, group: 'Pricing/Delivery', permissionField: 'packing' },
    { key: 'currentLocation', label: 'CURRENT LOCATION*', width: 150, group: 'Pricing/Delivery', permissionField: 'currentLocation' },
    { key: 'hkUsd', label: 'USD', width: 100, group: 'HK DELIVERY', subgroup: 'HK', permissionField: 'hkUsd' },
    { key: 'hkXe', label: 'XE', width: 100, group: 'HK DELIVERY', subgroup: 'HK', permissionField: 'hkXe' },
    { key: 'hkHkd', label: 'HKD', width: 100, group: 'HK DELIVERY', subgroup: 'HK', permissionField: 'hkHkd' },
    { key: 'dubaiUsd', label: 'USD', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI', permissionField: 'dubaiUsd' },
    { key: 'dubaiXe', label: 'XE', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI', permissionField: 'dubaiXe' },
    { key: 'dubaiAed', label: 'AED', width: 110, group: 'DUBAI DELIVERY', subgroup: 'DUBAI', permissionField: 'dubaiAed' },
    { key: 'deliveryLocation', label: 'DELIVERY LOCATION', width: 150, group: 'Pricing/Delivery', permissionField: 'deliveryLocation' },
    { key: 'customMessage', label: 'CUSTOM MESSAGE', width: 150, group: 'Pricing/Delivery', permissionField: 'customMessage' },
    { key: 'totalQty', label: 'TOTAL QTY*', width: 100, group: 'Pricing/Delivery', permissionField: 'totalQty' },
    { key: 'moqPerVariant', label: 'MOQ/VARIANT*', width: 120, group: 'Pricing/Delivery', permissionField: 'moqPerVariant' },
    { key: 'weight', label: 'WEIGHT', width: 100, group: 'Pricing/Delivery', permissionField: 'weight' },
    { key: 'purchaseType', label: 'PURCHASE TYPE*', width: 130, group: 'Pricing/Delivery', permissionField: 'purchaseType' },
    ...(variantType === 'multi' ? [{ key: 'totalMoq', label: 'MOQ PER CART*', width: 150, group: 'Pricing/Delivery', permissionField: 'totalMoq' }] : []),
    { key: 'paymentTerm', label: 'PAYMENT TERM*', width: 200, group: 'Payment', permissionField: 'paymentTerm' },
    { key: 'paymentMethod', label: 'PAYMENT METHOD*', width: 200, group: 'Payment', permissionField: 'paymentMethod' },
    { key: 'negotiableFixed', label: 'NEGOTIABLE/FIXED', width: 150, group: 'Other Info', permissionField: 'negotiableFixed' },
    { key: 'flashDeal', label: 'FLASH DEAL', width: 130, group: 'Other Info', permissionField: 'flashDeal' },
    { key: 'shippingTime', label: 'SHIPPING TIME', width: 130, group: 'Other Info', permissionField: 'shippingTime' },
    { key: 'vendor', label: 'VENDOR', width: 100, group: 'Other Info', permissionField: 'vendor' },
    { key: 'vendorListingNo', label: 'VENDOR LISTING NO', width: 150, group: 'Other Info', permissionField: 'vendorListingNo' },
    { key: 'carrier', label: 'CARRIER', width: 100, group: 'Other Info', permissionField: 'carrier' },
    { key: 'carrierListingNo', label: 'CARRIER LISTING NO', width: 150, group: 'Other Info', permissionField: 'carrierListingNo' },
    { key: 'uniqueListingNo', label: 'UNIQUE LISTING NO', width: 150, group: 'Other Info', permissionField: 'uniqueListingNo' },
    { key: 'tags', label: 'TAGS', width: 190, group: 'Other Info', permissionField: 'tags' },
    { key: 'adminCustomMessage', label: 'ADMIN CUSTOM MESSAGE', width: 180, group: 'Other Info', permissionField: 'adminCustomMessage' },
    { key: 'startTime', label: 'START TIME', width: 150, group: 'Other Info', permissionField: 'startTime' },
    { key: 'endTime', label: 'END TIME *', width: 150, group: 'Other Info', permissionField: 'endTime' },
    { key: 'remark', label: 'REMARK', width: 150, group: 'Other Info', permissionField: 'remark' },
    ...customColumns, // Add dynamic custom columns at the end
  ];

  // Filter columns based on permissions - strict mode: only show fields with permission
  const columns = allColumns.filter((col): col is ColumnDefinition => {
    // Always show custom fields (no permission check needed)
    // Custom columns don't have permissionField, so check if it's in customColumns array
    if (!('permissionField' in col)) {
      return true; // This is a custom column, always show
    }
    
    // For all fields with permissionField, check permission
    const permissionFieldValue = (col as Extract<ColumnDefinition, { permissionField: string }>).permissionField;
    if (permissionFieldValue) {
      return hasPermission(permissionFieldValue);
    }
    
    // If no permissionField defined, don't show (strict mode)
    return false;
  });

  // Check if there are any permissioned fields (excluding custom fields)
  const hasPermissionedFields = columns.some(col => 'group' in col && col.group !== 'Custom Fields');

  // Get country options from constants (show name, store code)
  const countryOptions = constants?.spec?.COUNTRY || [];
  
  // Get sim options based on selected country (will be filtered per row)
  const getSimOptionsForCountry = (countryCode: string) => {
    if (!constants?.spec?.COUNTRY) return [];
    const country = constants.spec.COUNTRY.find(c => c.code === countryCode);
    return country?.SIM || [];
  };
  
  // Status options for isStatus field (active/nonactive)
  const statusOptions = [
    { code: 'active', name: 'Active' },
    { code: 'nonactive', name: 'Non Active' }
  ];
  
  // Get lockStatus options from constants (show name, store code)
  const lockUnlockOptions = constants?.lockStatus || [];
  
  // Get packing options from constants (show name, store code)
  const packingOptions = constants?.packing || [];
  
  // Get currentLocation options from constants (show name, store code)
  const currentLocationOptions = constants?.currentLocation || [];
  
  // Get deliveryLocation options from constants (show name, store code)
  const deliveryLocationOptions = constants?.deliveryLocation || [];
  
  // Get paymentTerm and paymentMethod options from constants
  const paymentTermOptions = constants?.paymentTerm || [];
  const paymentMethodOptions = constants?.paymentMethod || [];
  
  // NegotiableStatus - using negotiableStatus from constants
  const negotiableFixedOptions = constants?.negotiableStatus || [];
  
  // Get vendor options from constants (show name, store code)
  const vendorOptions = constants?.vendor || [];
  
  // Get carrier options from constants (show name, store code)
  const carrierOptions = constants?.carrier || [];
  
  // Get flashDeal options from constants (show name, store code)
  const flashDealOptions = constants?.flashDeal || [];

  const renderCell = (row: ProductRowData, rowIndex: number, column: typeof columns[0]) => {
    const value = row[column.key as keyof ProductRowData];
    const cellId = `${rowIndex}-${column.key}`;

    const isMultiVariant = variantType === 'multi';
    const isGroupLevelField =
      isMultiVariant && groupLevelFields.includes(column.key as keyof ProductRowData);
    const isMasterRow = rowIndex === 0;

    // For group-level fields in multi-variant mode, non-master rows always display the master row's value
    const groupDisplayValue =
      isGroupLevelField && !isMasterRow && rows.length > 0
        ? (rows[0][column.key as keyof ProductRowData] as any)
        : value;

    switch (column.key) {
      case 'skuFamilyId':
        const selectedSkuFamily = skuFamilies.find(sku => sku._id === value);
        const displayValue = selectedSkuFamily?.name || '';
        const isRowSearchActive = rowSkuFamilySearch?.rowIndex === rowIndex;
        const rowSearchQuery = isRowSearchActive ? rowSkuFamilySearch.query : '';
        
        return (
          <div className="min-w-[150px] relative" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <div className="relative">
              <input
                ref={(el) => { cellRefs.current[cellId] = el; }}
                type="text"
                value={isRowSearchActive ? rowSearchQuery : displayValue}
                onChange={(e) => {
                  const query = e.target.value;
                  setRowSkuFamilySearch({ rowIndex, query, showResults: true });
                }}
                onFocus={() => {
                  setFocusedCell({ row: rowIndex, col: column.key });
                  setSelectedRowIndex(rowIndex);
                  if (!isRowSearchActive) {
                    // Start with empty query to show all options or current value
                    setRowSkuFamilySearch({ rowIndex, query: '', showResults: false });
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on results
                  setTimeout(() => {
                    if (rowSkuFamilySearch?.rowIndex === rowIndex) {
                      setRowSkuFamilySearch(null);
                    }
                  }, 200);
                }}
                placeholder="Click to search SKU Family..."
                className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
              />
              {isRowSearchActive && (
                <i className="fas fa-search absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
              )}
            </div>
            {/* Row-specific Search Results Dropdown */}
            {isRowSearchActive && rowSkuFamilySearch?.showResults && rowSkuFamilySearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 w-[270px] border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-96 overflow-y-auto z-[100]">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Row {rowIndex + 1} - Select SKU Family
                  </div>
                </div>
                {rowSkuFamilySearchResults.map((option, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleRowSkuFamilySearchSelect(option, rowIndex)}
                    className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                          {option.skuFamilyName}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {option.subModelName && <span className="mr-2">Model: {option.subModelName}</span>}
                          {option.storage && <span className="mr-2">Storage: {option.storage}</span>}
                          {option.colour && <span className="mr-2">Color: {option.colour}</span>}
                          {option.ram && <span>RAM: {option.ram}</span>}
                        </div>
                      </div>
                      <i className="fas fa-arrow-right text-blue-500 text-xs mt-1"></i>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isRowSearchActive && rowSearchQuery && rowSkuFamilySearch?.showResults && rowSkuFamilySearchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-[100]">
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results found
                </div>
              </div>
            )}
          </div>
        );

      case 'subModelName':
      case 'storage':
      case 'colour': {
        const isDisabledForSku = !!row.skuFamilyId; // Disable if SKU Family is selected
        return (
          <input
            ref={(el) => { cellRefs.current[cellId] = el; }}
            type="text"
            value={value as string}
            onChange={(e) => {
              // Only allow change if not disabled (i.e., no skuFamilyId yet)
              if (!isDisabledForSku) {
                updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value);
              }
            }}
            className={`w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400 ${
              isDisabledForSku 
                ? 'text-gray-600 dark:text-gray-400 italic cursor-not-allowed bg-gray-100 dark:bg-gray-800' 
                : ''
            }`}
            required={column.key === 'subModelName' || column.key === 'storage' || column.key === 'colour'}
            disabled={isDisabledForSku}
            readOnly={isDisabledForSku} // Optional: extra safety
            onFocus={() => {
              if (!isDisabledForSku) {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }
            }}
            placeholder={
              isDisabledForSku 
                ? 'Auto-filled from SKU Family' 
                : 'Enter value or use SKU Family search'
            }
          />
        );
      }

      case 'country':
        return (
          <select
            value={value as string}
            onChange={(e) => {
              updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value);
              // Clear sim when country changes
              updateRow(rowIndex, 'sim', '');
            }}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select Country</option>
            {countryOptions.map(opt => (
              <option key={opt.code} value={opt.code} className="bg-white dark:bg-gray-800">
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'sim':
        const selectedCountryCode = row.country || '';
        const availableSimOptions = getSimOptionsForCountry(selectedCountryCode);
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            disabled={!selectedCountryCode}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">
              {!selectedCountryCode ? 'Select Country first' : 'Select SIM'}
            </option>
            {availableSimOptions.map(opt => (
              <option key={opt} value={opt} className="bg-white dark:bg-gray-800">
                {opt}
              </option>
            ))}
          </select>
        );

      case 'grade':
        return (
          <div className="min-w-[120px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              options={grades.map(g => ({ value: g._id, label: g.title }))}
              value={grades.find(g => g._id === value) ? { value: value as string, label: grades.find(g => g._id === value)?.title } : null}
              onChange={(opt) => updateRow(rowIndex, column.key as keyof ProductRowData, opt?.value || '')}
              className="text-xs"
              classNamePrefix="select"
              isSearchable
              placeholder="Select Grade"
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
              }}
            />
          </div>
        );

      case 'status':
        // Handle both 'active'/'nonactive' and legacy values
        const statusValue = value as string;
        const normalizedStatusValue = statusValue === 'non active' ? 'nonactive' : (statusValue || '');
        return (
          <select
            value={normalizedStatusValue}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select Status</option>
            {statusOptions.map(opt => (
              <option key={opt.code} value={opt.code} className="bg-white dark:bg-gray-800">
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'lockUnlock':
      case 'negotiableFixed': {
        const options = column.key === 'lockUnlock' ? lockUnlockOptions : negotiableFixedOptions;
        const fieldValue = column.key === 'negotiableFixed' ? groupDisplayValue : value;
        const normalizedFieldValue = fieldValue as string || '';
        const isDisabledForGroup = column.key === 'negotiableFixed' && isGroupLevelField && !isMasterRow;
        return (
          <select
            value={normalizedFieldValue}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isDisabledForGroup}
            required={column.key === 'lockUnlock'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="" className="text-gray-500">Select</option>
            {options.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );
      }

      case 'packing':
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {packingOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'vendor':
      case 'carrier':
        const selectOptions = column.key === 'vendor' ? vendorOptions : carrierOptions;
        return (
          <select
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {selectOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'flashDeal':
        return (
          <select
            value={groupDisplayValue as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isGroupLevelField && !isMasterRow}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {flashDealOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'paymentTerm':
        // Convert comma-separated string to array for react-select
        const selectedTerms = (typeof groupDisplayValue === 'string' && groupDisplayValue) 
          ? groupDisplayValue.split(',').map(t => t.trim()).filter(t => t)
          : [];
        const selectedTermOptions = paymentTermOptions
          .filter(opt => selectedTerms.includes(opt.code))
          .map(opt => ({ value: opt.code, label: opt.name }));
        
        return (
          <div className="min-w-[200px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={paymentTermOptions.map(opt => ({ value: opt.code, label: opt.name }))}
              value={selectedTermOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value).join(', ') : '';
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select terms..."
              isDisabled={isGroupLevelField && !isMasterRow}
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  minWidth: '200px',
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: isGroupLevelField && !isMasterRow ? '#f3f4f6' : 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
                }),
                multiValueLabel: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  fontWeight: '500',
                }),
                multiValueRemove: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  ':hover': {
                    backgroundColor: '#93c5fd',
                    color: '#fff',
                  },
                }),
              }}
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              required
            />
          </div>
        );

      case 'paymentMethod':
        // Convert comma-separated string to array for react-select
        const selectedMethods = (typeof groupDisplayValue === 'string' && groupDisplayValue) 
          ? groupDisplayValue.split(',').map(m => m.trim()).filter(m => m)
          : [];
        const selectedOptions = paymentMethodOptions
          .filter(opt => selectedMethods.includes(opt.code))
          .map(opt => ({ value: opt.code, label: opt.name }));
        
        return (
          <div className="min-w-[200px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={paymentMethodOptions.map(opt => ({ value: opt.code, label: opt.name }))}
              value={selectedOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value).join(', ') : '';
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select methods..."
              isDisabled={isGroupLevelField && !isMasterRow}
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  minWidth: '200px',
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: isGroupLevelField && !isMasterRow ? '#f3f4f6' : 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
                }),
                multiValueLabel: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  fontWeight: '500',
                }),
                multiValueRemove: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  ':hover': {
                    backgroundColor: '#93c5fd',
                    color: '#fff',
                  },
                }),
              }}
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              required
            />
          </div>
        );

      case 'currentLocation':
        return (
          <select
            value={groupDisplayValue as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1 text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isGroupLevelField && !isMasterRow}
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select</option>
            {currentLocationOptions.map(opt => (
              <option key={opt.code} value={opt.code}>
                {opt.name}
              </option>
            ))}
          </select>
        );

      case 'hkUsd':
      case 'hkXe':
      case 'hkHkd':
      case 'dubaiUsd':
      case 'dubaiXe':
      case 'dubaiAed':
      case 'totalQty':
      case 'moqPerVariant':
      case 'weight':
        return (
          <input
            type="number"
            step={column.key.includes('Xe') || column.key.includes('XE') ? '0.0001' : '0.01'}
            value={value as string | number}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 text-right font-medium placeholder:text-gray-400"
            placeholder="0.00"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          />
        );

      case 'purchaseType':
        return (
          <select
            value={value as string || ''}
            onChange={(e) => {
              updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value);
              // If changed to 'full', set MOQ to equal stock
              if (e.target.value === 'full') {
                updateRow(rowIndex, 'moqPerVariant', row.totalQty || 1);
              }
            }}
            className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
            required
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            <option value="">Select Purchase Type</option>
            <option value="partial">Partial</option>
            <option value="full">Full</option>
          </select>
        );

      case 'deliveryLocation':
        const deliveryValue = Array.isArray(value) ? value : (value ? [value] : []);
        const deliveryDisplayNames = deliveryValue
          .map(code => {
            const option = deliveryLocationOptions.find(opt => opt.code === code);
            return option ? option.name : code;
          })
          .filter(Boolean);
        
        return (
          <div 
            className="w-full px-2 py-1.5 min-h-[32px] flex items-center"
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
          >
            {deliveryDisplayNames.length > 0 ? (
              deliveryDisplayNames.map((name, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md text-xs font-medium text-blue-800 dark:text-blue-300"
                >
                  {/* <i className="fas fa-map-marker-alt mr-1.5 text-[10px]"></i> */}
                  {name}{idx < deliveryDisplayNames.length - 1 ? ',' : ''} 
                </span>
              ))
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                Auto-calculated
              </span>
            )}
          </div>
        );

      case 'startTime':
      case 'endTime':
        const dateValue = groupDisplayValue ? new Date(groupDisplayValue as string) : null;
        const currentRow = rows[rowIndex];
        const startTimeValue = currentRow?.startTime ? new Date(currentRow.startTime) : null;
        const endTimeValue = currentRow?.endTime ? new Date(currentRow.endTime) : null;
        
        // Get minimum date (current date/time - no past dates allowed)
        const minDate = new Date();
        minDate.setSeconds(0, 0); // Reset seconds and milliseconds
        
        // For endTime, minDate should be startTime if it exists, otherwise current time
        const minDateForEndTime = startTimeValue && startTimeValue > minDate ? startTimeValue : minDate;
        
        // For startTime, maxDate should be endTime if it exists (to ensure startTime < endTime)
        const maxDateForStartTime = endTimeValue || undefined;
        
        return (
          <DatePicker
            selected={dateValue}
            onChange={(date) => {
              if (!date) {
                updateRow(rowIndex, column.key as keyof ProductRowData, '');
                return;
              }
              
              // Validate: no past dates allowed
              if (date < minDate) {
                toastHelper.showTost('Cannot select past dates. Please select a future date.', 'error');
                return;
              }
              
              const dateISO = date.toISOString();
              
              if (column.key === 'startTime') {
                // If setting startTime, validate it's before endTime
                if (endTimeValue && date >= endTimeValue) {
                  toastHelper.showTost('Start time must be before end time.', 'error');
                  return;
                }
                updateRow(rowIndex, column.key as keyof ProductRowData, dateISO);
              } else if (column.key === 'endTime') {
                // If setting endTime, validate it's after startTime
                if (startTimeValue && date <= startTimeValue) {
                  toastHelper.showTost('End time must be after start time.', 'error');
                  return;
                }
                updateRow(rowIndex, column.key as keyof ProductRowData, dateISO);
              }
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={30}
            dateFormat="yyyy-MM-dd HH:mm"
            minDate={column.key === 'startTime' ? minDate : minDateForEndTime}
            maxDate={column.key === 'startTime' ? (maxDateForStartTime || undefined) : undefined}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
            placeholderText={column.key === 'startTime' ? "Select date & time (auto: current time)" : "Select date & time *"}
            disabled={isGroupLevelField && !isMasterRow}
            required={column.key === 'endTime'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
            wrapperClassName="w-full"
            popperClassName="inline-datetime-picker"
            popperModifiers={[]}
            calendarClassName="inline-datetime-calendar"
          />
        );

      case 'supplierId':
        // Display current seller (disabled, cannot be changed)
        const currentSeller = getCurrentSellerId();
        const user = StorageService.getItem<any>(STORAGE_KEYS.USER);
        const sellerName = user?.name || user?.businessName || 'Current Seller';
        // Ensure supplierId is set in the row data
        if (value !== currentSeller) {
          updateRow(rowIndex, 'supplierId' as keyof ProductRowData, currentSeller);
        }
        return (
          <div className="relative">
            <input
              type="text"
              value={sellerName}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 cursor-not-allowed"
              readOnly
              disabled
              title={`Seller ID: ${currentSeller}`}
            />
          </div>
        );

      case 'uniqueListingNo':
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              placeholder="Auto-generated"
            />
            <i className="fas fa-barcode absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'supplierListingNumber':
        // Read-only, auto-generated field (same as admin panel)
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              disabled
              placeholder="Auto-generated"
            />
            <i className="fas fa-tag absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'customerListingNumber':
        // Auto-generated, read-only (same as admin panel)
        return (
          <div className="relative">
            <input
              type="text"
              value={value as string}
              className="w-full px-2 py-1.5 text-xs border-0 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 italic"
              readOnly
              placeholder="Auto-generated"
            />
            <i className="fas fa-tag absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs"></i>
          </div>
        );

      case 'tags':
        const tagOptions = constants?.tags || [];
        // Convert comma-separated string of tag codes to array for react-select
        const selectedTagCodes = (value as string) 
          ? (value as string).split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t))
          : [];
        const selectedTagOptions = tagOptions
          .filter(tag => selectedTagCodes.includes(tag.code))
          .map(tag => ({ value: String(tag.code), label: tag.tag }));
        
        return (
          <div className="min-w-[150px]" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            <Select
              isMulti
              options={tagOptions.map(tag => ({ value: String(tag.code), label: tag.tag }))}
              value={selectedTagOptions}
              onChange={(selected) => {
                const selectedValues = selected ? selected.map(opt => opt.value).join(', ') : '';
                updateRow(rowIndex, column.key as keyof ProductRowData, selectedValues);
              }}
              className="text-xs"
              classNamePrefix="select"
              isSearchable={false}
              placeholder="Select tags..."
              styles={{
                control: (provided, state) => ({ 
                  ...provided, 
                  minHeight: '32px', 
                  fontSize: '12px', 
                  border: 'none', 
                  boxShadow: state.isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                  backgroundColor: 'transparent',
                  '&:hover': { border: 'none' }
                }),
                valueContainer: (provided) => ({ ...provided, padding: '4px 8px', minHeight: '32px' }),
                input: (provided) => ({ ...provided, margin: '0', padding: '0' }),
                indicatorsContainer: (provided) => ({ ...provided, height: '32px' }),
                menu: (provided) => ({ ...provided, zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }),
                multiValue: (provided) => ({
                  ...provided,
                  backgroundColor: '#dbeafe',
                  fontSize: '11px',
                }),
                multiValueLabel: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  fontWeight: '500',
                }),
                multiValueRemove: (provided) => ({
                  ...provided,
                  color: '#1e40af',
                  ':hover': {
                    backgroundColor: '#93c5fd',
                    color: '#fff',
                  },
                }),
              }}
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
            />
          </div>
        );

      case 'shippingTime':
        const shippingTimeValue = groupDisplayValue as string;
        
        // Helper function to format date as YYYY-MM-DD
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        // Helper function to get today's date
        const getToday = (): Date => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return today;
        };
        
        // Helper function to get tomorrow's date
        const getTomorrow = (): Date => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          return tomorrow;
        };
        
        // Determine current selected date value and detect mode from value
        let selectedDate: Date | null = null;
        let detectedMode: 'today' | 'tomorrow' | 'calendar' | '' = '';
        
        if (shippingTimeValue) {
          try {
            const dateValue = new Date(shippingTimeValue);
            dateValue.setHours(0, 0, 0, 0);
            selectedDate = dateValue;
            
            // Auto-detect if it's today or tomorrow
            const todayStr = formatDate(getToday());
            const tomorrowStr = formatDate(getTomorrow());
            const valueStr = formatDate(dateValue);
            
            if (valueStr === todayStr) {
              detectedMode = 'today';
            } else if (valueStr === tomorrowStr) {
              detectedMode = 'tomorrow';
            } else {
              detectedMode = 'calendar';
            }
          } catch (e) {
            selectedDate = null;
            detectedMode = '';
          }
        }
        
        // Use stored mode if exists, otherwise use detected mode
        const storedMode = shippingTimeMode[rowIndex];
        const currentMode = storedMode || detectedMode;
        
        return (
          <div className="w-full" onFocus={() => setFocusedCell({ row: rowIndex, col: column.key })}>
            {/* Dropdown for selection */}
            <select
              value={currentMode || ''}
              onChange={(e) => {
                if (isGroupLevelField && !isMasterRow) return; // Prevent changes for non-master rows
                const selectedMode = e.target.value as 'today' | 'tomorrow' | 'calendar' | '';
                const newMode = selectedMode || '';
                
                // Update mode state
                setShippingTimeMode((prev) => {
                  const updated = { ...prev };
                  if (newMode === '' || newMode === 'today' || newMode === 'tomorrow' || newMode === 'calendar') {
                    updated[rowIndex] = newMode;
                  }
                  return updated;
                });
                
                if (selectedMode === 'today') {
                  const today = getToday();
                  const todayStr = formatDate(today);
                  updateRow(rowIndex, column.key as keyof ProductRowData, todayStr);
                } else if (selectedMode === 'tomorrow') {
                  const tomorrow = getTomorrow();
                  const tomorrowStr = formatDate(tomorrow);
                  updateRow(rowIndex, column.key as keyof ProductRowData, tomorrowStr);
                } else if (selectedMode === 'calendar') {
                  // Keep existing value or set to today if empty
                  if (!shippingTimeValue) {
                    const today = getToday();
                    const todayStr = formatDate(today);
                    updateRow(rowIndex, column.key as keyof ProductRowData, todayStr);
                  }
                } else {
                  // Clear value when "Select shipping time" is chosen
                  updateRow(rowIndex, column.key as keyof ProductRowData, '');
                }
              }}
              disabled={isGroupLevelField && !isMasterRow}
              className="w-full px-2 py-1.5 text-xs border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 cursor-pointer appearance-none"
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
            >
              <option value="">Select shipping time</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="calendar">Calendar</option>
            </select>
            
            {/* Show date picker only when calendar is selected */}
            {(currentMode === 'calendar' || currentMode === '') && (
              <div className="mt-1">
                <DatePicker
                  selected={selectedDate}
                  onChange={(date) => {
                    if (isGroupLevelField && !isMasterRow) return; // Prevent changes for non-master rows
                    if (date) {
                      const dateStr = formatDate(date);
                      updateRow(rowIndex, column.key as keyof ProductRowData, dateStr);
                    } else {
                      updateRow(rowIndex, column.key as keyof ProductRowData, '');
                    }
                  }}
                  dateFormat="yyyy-MM-dd"
                  className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
                  placeholderText="Select date"
                  disabled={isGroupLevelField && !isMasterRow}
                  minDate={getToday()}
                  onFocus={() => {
                    setFocusedCell({ row: rowIndex, col: column.key });
                    setSelectedRowIndex(rowIndex);
                  }}
                  wrapperClassName="w-full"
                />
              </div>
            )}
          </div>
        );

      case 'totalMoq':
        // MOQ PER CART field - shows value in each row, editable only in first row
        // Hidden for single-variant products
        if (variantType !== 'multi') {
          return null;
        }

        const isMasterMoqRow = rowIndex === 0;
        const moqValue = totalMoq || '';

        return (
          <div className="w-full flex flex-col items-center justify-center gap-1.5">
            <input
              type="number"
              step="0.01"
              value={moqValue}
              onChange={(e) => {
                if (isMasterMoqRow) {
                  setTotalMoq(e.target.value);
                }
              }}
              className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 text-center font-medium placeholder:text-gray-400"
              placeholder="0.00"
              disabled={!isMasterMoqRow}
              readOnly={!isMasterMoqRow}
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
            />
            {/* Fill button - only show in first row */}
            {isMasterMoqRow && rows.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // For totalMoq, the value is already shared across all rows
                  // This button is for visual consistency with other columns
                  toastHelper.showTost('MOQ PER CART value applies to all variants', 'info');
                }}
                className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded shadow-md hover:bg-blue-700 z-20 transition-all duration-200 flex items-center gap-1"
                title="MOQ PER CART applies to all variants"
              >
                <i className="fas fa-arrow-down text-xs"></i>
                <span className="text-xs font-medium">Fill</span>
              </button>
            )}
          </div>
        );

      default:
        // Handle custom dynamic columns
        if (customColumns.some(cc => cc.key === column.key)) {
          return (
            <input
              type="text"
              value={(value as string) || ''}
              onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
              className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
              onFocus={() => {
                setFocusedCell({ row: rowIndex, col: column.key });
                setSelectedRowIndex(rowIndex);
              }}
              placeholder="Enter value..."
            />
          );
        }
        // Default case for other fields
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => updateRow(rowIndex, column.key as keyof ProductRowData, e.target.value)}
            className="w-full px-2 py-1.5 text-xs border-0 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded transition-all duration-150 placeholder:text-gray-400"
            required={column.key === 'supplierListingNumber'}
            onFocus={() => {
              setFocusedCell({ row: rowIndex, col: column.key });
              setSelectedRowIndex(rowIndex);
            }}
            placeholder={column.key.includes('message') || column.key.includes('Message') ? 'Enter message...' : 'Enter value...'}
          />
        );
    }
  };

  // Function to handle adding a new custom column
  const handleAddCustomColumn = () => {
    if (!newColumnName.trim()) {
      toastHelper.showTost('Please enter a column name', 'error');
      return;
    }

    // Check if column name already exists
    const columnKey = `custom_${newColumnName.trim().toLowerCase().replace(/\s+/g, '_')}`;
    if (columns.some(col => col.key === columnKey)) {
      toastHelper.showTost('A column with this name already exists', 'error');
      return;
    }

    // Add new custom column
    const newColumn = {
      key: columnKey,
      label: newColumnName.trim().toUpperCase(),
      width: 150,
      group: 'Custom Fields',
    };

    setCustomColumns([...customColumns, newColumn]);

    // Initialize the field for all existing rows
    setRows(prevRows => 
      prevRows.map(row => ({
        ...row,
        [columnKey]: '',
      }))
    );

    // Reset modal
    setNewColumnName('');
    setShowAddColumnModal(false);
    toastHelper.showTost(`Column "${newColumnName.trim()}" added successfully`, 'success');
  };

  // Function to handle deleting a custom column
  const handleDeleteCustomColumn = (columnKey: string) => {
    // Show confirmation dialog
    Swal.fire({
      title: 'Delete Custom Column?',
      text: 'Are you sure you want to delete this custom column? This will remove the column and all its data from all rows.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove the column from customColumns
        setCustomColumns(prevColumns => prevColumns.filter(col => col.key !== columnKey));
        
        // Remove the field from all rows
        setRows(prevRows => 
          prevRows.map(row => {
            const newRow = { ...row };
            delete newRow[columnKey as keyof ProductRowData];
            return newRow;
          })
        );
        
        toastHelper.showTost('Custom column deleted successfully', 'success');
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fas fa-spinner text-blue-600 dark:text-blue-400 text-lg animate-spin"></i>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-600 dark:text-gray-400">Loading form data...</p>
      </div>
    );
  }


  const totalWidth = columns.reduce((sum, col) => sum + col.width + 1, 0);

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Enhanced Toolbar */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-700 px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
          <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            {hasPermissionedFields && (
              <>
                <button
                  type="button"
                  onClick={addRow}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  title="Add Row (Ctrl+N or Cmd+N)"
                >
                  <i className="fas fa-plus text-sm"></i>
                  <span>Add Row</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (rows.length > 0) {
                      duplicateRow(rows.length - 1);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  title="Duplicate Last Row"
                >
                  <i className="fas fa-copy text-sm"></i>
                  <span>Duplicate</span>
                </button>
              </>
            )}
          </div>
          <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
          {/* SKU Family Search Field */}
          {/* <div className="relative flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => {
                  if (searchQuery && searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click on results
                  setTimeout(() => setShowSearchResults(false), 200);
                }}
                placeholder="Search SKU Family, SubModel, Storage, Colour..."
                className="w-full px-4 py-2 pl-10 pr-4 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm"></i>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <i className="fas fa-times text-sm"></i>
                </button>
              )}
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {selectedRowIndex !== null 
                      ? `Will fill Row ${selectedRowIndex + 1} (click row number to change)`
                      : focusedCell?.row !== undefined
                      ? `Will fill Row ${focusedCell.row + 1} (click row number to select different row)`
                      : 'Will fill Row 1 (click row number to select different row)'}
                  </div>
                </div>
                {searchResults.map((option, idx) => {
                  const targetRow = selectedRowIndex !== null ? selectedRowIndex : (focusedCell?.row ?? 0);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSearchSelect(option, targetRow)}
                      className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b border-gray-200 dark:border-gray-700 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                            {option.skuFamilyName}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {option.subModelName && <span className="mr-2">Model: {option.subModelName}</span>}
                            {option.storage && <span className="mr-2">Storage: {option.storage}</span>}
                            {option.colour && <span className="mr-2">Color: {option.colour}</span>}
                            {option.ram && <span>RAM: {option.ram}</span>}
                          </div>
                        </div>
                        <i className="fas fa-arrow-right text-blue-500 text-xs mt-1"></i>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {showSearchResults && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-4 z-50">
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results found
                </div>
              </div>
            )}
          </div> */}
          {/* <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1"></div> */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <i className="fas fa-table text-blue-500 text-sm"></i>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {rows.length} {rows.length === 1 ? 'Row' : 'Rows'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <i className="fas fa-columns text-purple-500 text-sm"></i>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {columns.length} Columns
              </span>
            </div>
            {variantType === 'multi' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 rounded-lg border border-purple-300 dark:border-purple-700 shadow-sm">
                <i className="fas fa-layer-group text-purple-600 dark:text-purple-400 text-sm"></i>
                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                  Multi-Variant Mode
                </span>
              </div>
            )}
            {/* <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/40 rounded-lg border border-green-300 dark:border-green-700 shadow-sm">
              <i className="fas fa-save text-green-600 dark:text-green-400 text-sm"></i>
              <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                Auto-saved
              </span>
            </div> */}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all saved form data?')) {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                  toastHelper.showTost('Saved form data cleared', 'success');
                } catch (error) {
                  console.error('Error clearing localStorage:', error);
                  toastHelper.showTost('Error clearing saved data', 'error');
                }
              }
            }}
            className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 border-2 border-yellow-600 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
            title="Clear saved form data from localStorage"
          >
            <i className="fas fa-trash-alt text-sm"></i>
            <span>Clear Saved</span>
          </button> */}
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md transition-all duration-200"
          >
            <i className="fas fa-times mr-2"></i>
            Cancel
          </button>
          {hasPermissionedFields && (
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
            >
              <i className={`fas ${editProducts && editProducts.length > 0 ? 'fa-edit' : 'fa-save'} text-sm`}></i>
              <span>{editProducts && editProducts.length > 0 ? 'Update Product' : 'Save All Products'}</span>
              {!editProducts || editProducts.length === 0 ? (
                <span className="ml-1 px-2 py-0.5 bg-blue-500 rounded-full text-xs font-bold">
                  {rows.length}
                </span>
              ) : null}
            </button>
          )}
        </div>
      </div>

      {/* Excel-like Table with Enhanced Styling */}
      <div 
        ref={tableRef}
        className="flex-1 overflow-auto bg-white dark:bg-gray-900 relative"
        style={{ maxHeight: 'calc(100vh - 136px)' }}
      >
        {/* Scroll Shadow Indicators */}
        {/* <div className="absolute top-0 right-0 w-8 h-full bg-gray-100 dark:bg-gray-800 pointer-events-none z-10 opacity-50"></div> */}
        {/* <div className="absolute bottom-0 left-0 w-full h-8 bg-gray-100 dark:bg-gray-800 pointer-events-none z-10 opacity-50"></div> */}
        <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
          {/* Enhanced Column Headers with Groups */}
          <div className="sticky top-0 z-10 shadow-lg">
            {/* Group Headers for Price Sections */}
            <div className="flex border-b border-gray-300 dark:border-gray-600">
              <div className="min-w-12 border-r-2 border-gray-400 dark:border-gray-600 bg-gray-300 dark:bg-gray-800 sticky left-0 z-10"></div>
              {columns.map((col) => {
                const hkCols = columns.filter((c): c is Extract<ColumnDefinition, { subgroup: string }> => 'subgroup' in c && c.subgroup === 'HK');
                const dubaiCols = columns.filter((c): c is Extract<ColumnDefinition, { subgroup: string }> => 'subgroup' in c && c.subgroup === 'DUBAI');
                const paymentTermCols = columns.filter((c): c is Extract<ColumnDefinition, { subgroup: string }> => 'subgroup' in c && c.subgroup === 'PAYMENT_TERM');
                const paymentMethodCols = columns.filter((c): c is Extract<ColumnDefinition, { subgroup: string }> => 'subgroup' in c && c.subgroup === 'PAYMENT_METHOD');
                const hkWidth = hkCols.reduce((sum, c) => sum + c.width, 0);
                const dubaiWidth = dubaiCols.reduce((sum, c) => sum + c.width, 0);
                const paymentTermWidth = paymentTermCols.reduce((sum, c) => sum + c.width, 0);
                const paymentMethodWidth = paymentMethodCols.reduce((sum, c) => sum + c.width, 0);
                
                // Check if this is the first column of a group
                if (col.key === 'hkUsd') {
                  return (
                    <div
                      key={`group-hk`}
                      className="bg-blue-500 dark:bg-blue-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-blue-600 dark:border-blue-800 shadow-inner"
                      style={{ width: `${hkWidth}px`, minWidth: `${hkWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-dollar-sign text-xs"></i>
                        <span>HK DELIVERY PRICE</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'dubaiUsd') {
                  return (
                    <div
                      key={`group-dubai`}
                      className="bg-green-500 dark:bg-green-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-green-600 dark:border-green-800 shadow-inner"
                      style={{ width: `${dubaiWidth}px`, minWidth: `${dubaiWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-dollar-sign text-xs"></i>
                        <span>DUBAI DELIVERY PRICE</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'paymentTermUsd') {
                  return (
                    <div
                      key={`group-payment-term`}
                      className="bg-purple-500 dark:bg-purple-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-purple-600 dark:border-purple-800 shadow-inner"
                      style={{ width: `${paymentTermWidth}px`, minWidth: `${paymentTermWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-calendar-check text-xs"></i>
                        <span>PAYMENT TERM</span>
                      </div>
                    </div>
                  );
                } else if (col.key === 'paymentMethodUsd') {
                  return (
                    <div
                      key={`group-payment-method`}
                      className="bg-orange-500 dark:bg-orange-700 px-3 py-2 text-xs font-bold text-white text-center border-r-2 border-orange-600 dark:border-orange-800 shadow-inner"
                      style={{ width: `${paymentMethodWidth}px`, minWidth: `${paymentMethodWidth}px` }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <i className="fas fa-credit-card text-xs"></i>
                        <span>PAYMENT METHOD</span>
                      </div>
                    </div>
                  );
                } else if ('subgroup' in col && col.subgroup) {
                  // Skip rendering for other columns in the group (they're covered by the group header)
                  return null;
                } else {
                  // Regular column - show empty space for alignment
                  return (
                    <div
                      key={`group-empty-${col.key}`}
                      className="border-r border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-800"
                      style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                    ></div>
                  );
                }
              })}
            </div>
            {/* Column Headers with Better Styling */}
            <div className="flex border-b-2 border-gray-400 dark:border-gray-600 bg-gray-200 dark:bg-gray-800">
              <div className="min-w-12 border-r-2 border-gray-400 dark:border-gray-600 bg-gray-400 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-800 dark:text-gray-200 sticky left-0 z-10 shadow-md">
                <i className="fas fa-hashtag mr-1"></i>
                #
              </div>
              {columns.map((col) => {
                const isCustomColumn = customColumns.some(cc => cc.key === col.key);
                return (
                  <div
                    key={col.key}
                    className={`px-3 py-3 text-xs font-bold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 whitespace-nowrap hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-default relative group ${
                      ('group' in col && col.group === 'Custom Fields')
                        ? 'bg-yellow-50 dark:bg-yellow-900/30'
                        : ('subgroup' in col && col.subgroup === 'HK')
                        ? 'bg-blue-50 dark:bg-blue-900/30' 
                        : ('subgroup' in col && col.subgroup === 'DUBAI')
                        ? 'bg-green-50 dark:bg-green-900/30'
                        : ('subgroup' in col && col.subgroup === 'PAYMENT_TERM')
                        ? 'bg-purple-50 dark:bg-purple-900/30'
                        : ('subgroup' in col && col.subgroup === 'PAYMENT_METHOD')
                        ? 'bg-orange-50 dark:bg-orange-900/30'
                        : 'bg-gray-200 dark:bg-gray-800'
                    }`}
                    style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                    title={col.label}
                  >
                    <div className="flex items-center gap-1 justify-between">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        {col.label.includes('*') && (
                          <span className="text-red-500 text-xs">*</span>
                        )}
                        <span className="truncate">{col.label.replace('*', '')}</span>
                      </div>
                      {isCustomColumn && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomColumn(col.key);
                          }}
                          className="ml-1 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Delete this custom column"
                        >
                          <i className="fas fa-times text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Add Column Button */}
              {hasPermissionedFields && (
                <div
                  className="px-3 py-3 text-xs font-bold text-gray-800 dark:text-gray-200 border-r border-gray-300 dark:border-gray-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer flex items-center justify-center"
                  style={{ width: '80px', minWidth: '80px' }}
                  onClick={() => setShowAddColumnModal(true)}
                  title="Add Custom Column"
                >
                  <i className="fas fa-plus text-green-600 dark:text-green-400 text-lg"></i>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Rows */}
          <div ref={rowsContainerRef} className="relative">
            {rows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className={`flex border-b border-gray-200 dark:border-gray-700 transition-all duration-150 ${
                  rowIndex % 2 === 0 
                    ? 'bg-white dark:bg-gray-900' 
                    : 'bg-gray-50/50 dark:bg-gray-800/30'
                } ${
                  focusedCell?.row === rowIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20 shadow-inner'
                    : 'hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                }`}
              >
                {/* Enhanced Row Number */}
                <div className="min-w-12 border-r-2 border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-gray-300 sticky left-0 z-5 shadow-sm">
                  <div className="flex flex-col items-center gap-2">
                    <div 
                      onClick={() => setSelectedRowIndex(rowIndex)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-white font-bold shadow-md cursor-pointer transition-all ${
                        selectedRowIndex === rowIndex 
                          ? 'bg-green-600 dark:bg-green-700 ring-2 ring-green-400 ring-offset-2' 
                          : 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600'
                      }`}
                      title={selectedRowIndex === rowIndex ? 'Selected for search fill (click to deselect)' : 'Click to select this row for search fill'}
                    >
                      {rowIndex + 1}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateRow(rowIndex)}
                        className="p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                        title="Duplicate Row"
                      >
                        <i className="fas fa-copy text-xs"></i>
                      </button>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete Row"
                        >
                          <i className="fas fa-trash text-xs"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Enhanced Cells */}
                {columns.map((col) => {
                  // Regular columns including totalMoq (now rendered normally in each row)
                  return (
                    <div
                      key={`${rowIndex}-${col.key}`}
                      className={`px-0 py-1.5 border-r border-gray-200 dark:border-gray-700 relative group transition-all duration-150 flex ${
                        focusedCell?.row === rowIndex && focusedCell?.col === col.key
                          ? ''
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      style={{ 
                        width: `${col.width}px`, 
                        minWidth: `${col.width}px`,
                        justifyContent:'center',
                        alignItems:'center'
                      }}
                      onDoubleClick={() => {
                        if (col.key === 'totalMoq' && variantType === 'multi') {
                          // For totalMoq, fill all below rows with the same value
                          fillAllBelow(rowIndex, col.key);
                        } else {
                          fillAllBelow(rowIndex, col.key);
                        }
                      }}
                      title="Double-click to fill all below"
                    >
                      <div className="px-2 w-full">
                        {renderCell(row, rowIndex, col)}
                      </div>
                      {col.key !== 'totalMoq' && rowIndex < rows.length - 1 && focusedCell?.row === rowIndex && focusedCell?.col === col.key && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fillDown(rowIndex, col.key);
                          }}
                          className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-lg shadow-lg hover:bg-blue-700 z-20 transform hover:scale-110 transition-all duration-200 flex items-center gap-1"
                          title="Fill Down (Ctrl+D)"
                        >
                          <i className="fas fa-arrow-down text-xs"></i>
                          <span className="text-xs font-medium">Fill</span>
                        </button>
                      )}
                      {/* Hover indicator */}
                      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-300 dark:group-hover:border-blue-700 rounded pointer-events-none transition-all duration-150"></div>
                    </div>
                  );
                })}
                {/* Add Column Button Cell */}
                {hasPermissionedFields && (
                  <div
                    className="px-2 py-1.5 border-r border-gray-200 dark:border-gray-700 flex items-center justify-center bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                    style={{ width: '80px', minWidth: '80px' }}
                    onClick={() => setShowAddColumnModal(true)}
                    title="Add Custom Column"
                  >
                    <i className="fas fa-plus text-green-600 dark:text-green-400"></i>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>

      {/* Add Column Modal */}
      {showAddColumnModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50" onClick={() => setShowAddColumnModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Custom Column</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter a name for the new column</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Column Name
                </label>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCustomColumn();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Special Notes, Warranty Info"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddColumnModal(false);
                  setNewColumnName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomColumn}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals removed - sellers don't set margins/costs */}
    </>
  );
};

export default ExcelLikeProductForm;
