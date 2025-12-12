import api from '../api/api';
import { env } from '../../utils/env';
import toastHelper from '../../utils/toastHelper';

export interface SellerProductFieldPermission {
  fieldName: string;
  label: string;
  hasPermission: boolean;
  isRequired: boolean;
  group: 'productDetail' | 'pricing' | 'otherInfo';
}

export interface SellerProductPermission {
  _id?: string;
  sellerId?: string;
  permissions: SellerProductFieldPermission[];
  createdAt?: string;
  updatedAt?: string;
}

export class SellerProductPermissionService {
  // Get permissions for current seller (for seller panel)
  static getCurrentSellerPermissions = async (): Promise<SellerProductFieldPermission[]> => {
    const url = `${env.baseUrl}/api/seller/product-permission/get`;

    try {
      const res = await api.post(url, {});
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch product permissions');
      }
      return res.data.data?.permissions || [];
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch product permissions';
      // Return empty array if no permissions set yet
      if (err.response?.status === 404) {
        return [];
      }
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  // Get all available product fields (for reference)
  static getAvailableFields = (): SellerProductFieldPermission[] => {
    return [
      // Supplier Info Group (system fields - should always be visible)
      { fieldName: 'supplierId', label: 'Supplier ID', hasPermission: true, isRequired: true, group: 'productDetail' },
      { fieldName: 'supplierListingNumber', label: 'Supplier Listing Number', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'customerListingNumber', label: 'Customer Listing Number', hasPermission: true, isRequired: true, group: 'productDetail' },
      
      // Product Detail Group
      { fieldName: 'skuFamilyId', label: 'SKU Family', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'subModelName', label: 'Sub Model Name', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'storage', label: 'Storage', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'colour', label: 'Colour', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'country', label: 'Country (specs)', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'sim', label: 'SIM', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'version', label: 'Version', hasPermission: false, isRequired: false, group: 'productDetail' },
      { fieldName: 'grade', label: 'Grade', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'status', label: 'Status', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'condition', label: 'Condition', hasPermission: false, isRequired: false, group: 'productDetail' },
      { fieldName: 'lockUnlock', label: 'Lock/Unlock', hasPermission: false, isRequired: true, group: 'productDetail' },
      { fieldName: 'warranty', label: 'Warranty', hasPermission: false, isRequired: false, group: 'productDetail' },
      { fieldName: 'batteryHealth', label: 'Battery Health', hasPermission: false, isRequired: false, group: 'productDetail' },
      
      // Pricing / Delivery / Payment Method Group
      { fieldName: 'packing', label: 'Packing', hasPermission: false, isRequired: true, group: 'pricing' },
      { fieldName: 'currentLocation', label: 'Current Location', hasPermission: false, isRequired: true, group: 'pricing' },
      { fieldName: 'hkUsd', label: 'HK USD', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'hkXe', label: 'HK XE', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'hkHkd', label: 'HK HKD', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'dubaiUsd', label: 'Dubai USD', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'dubaiXe', label: 'Dubai XE', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'dubaiAed', label: 'Dubai AED', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'deliveryLocation', label: 'Delivery Location', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'customMessage', label: 'Custom Message', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'totalQty', label: 'Total Qty', hasPermission: false, isRequired: true, group: 'pricing' },
      { fieldName: 'moqPerVariant', label: 'MOQ/Variant', hasPermission: false, isRequired: true, group: 'pricing' },
      { fieldName: 'totalMoq', label: 'Total MOQ (Multi-Variant)', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'weight', label: 'Weight', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'supplierListingNumber', label: 'Supplier Listing Number', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'paymentTerm', label: 'Payment Term', hasPermission: false, isRequired: false, group: 'pricing' },
      { fieldName: 'paymentMethod', label: 'Payment Method', hasPermission: false, isRequired: false, group: 'pricing' },
      
      // Other Information Group
      { fieldName: 'negotiableFixed', label: 'Negotiable/Fixed', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'tags', label: 'Tags', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'flashDeal', label: 'Flash Deal', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'shippingTime', label: 'Shipping Time', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'deliveryTime', label: 'Delivery Time', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'vendor', label: 'Vendor', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'vendorListingNo', label: 'Vendor Listing No', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'carrier', label: 'Carrier', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'carrierListingNo', label: 'Carrier Listing No', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'uniqueListingNo', label: 'Unique Listing No', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'adminCustomMessage', label: 'Admin Custom Message', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'startTime', label: 'Start Time', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'endTime', label: 'End Time', hasPermission: false, isRequired: false, group: 'otherInfo' },
      { fieldName: 'remark', label: 'Remark', hasPermission: false, isRequired: false, group: 'otherInfo' },
    ];
  };
}

export default SellerProductPermissionService;
