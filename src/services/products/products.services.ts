import api from "../api/api";
import { env } from "../../utils/env";
import toastHelper from "../../utils/toastHelper";

export interface CreateProductRequest {
  specification: string;
  skuFamilyId?: string;
  subSkuFamilyId?: string;
  simType: string;
  color: string;
  ram: string;
  storage: string;
  condition: string;
  price: number;
  stock: number;
  country: string;
  moq: number;
  isNegotiable: boolean;
  isFlashDeal: boolean;
  expiryTime?: string;
  purchaseType: string;
}

export interface GetProductRequest {
  id: string;
}
export interface UpdateProductRequest {
  id: string;
  specification?: string;
  skuFamilyId?: string;
  subSkuFamilyId?: string;
  gradeId?: string;
  simType?: string;
  color?: string;
  ram?: string;
  storage?: string;
  condition?: string;
  price?: number;
  stock?: number;
  country?: string;
  moq?: number;
  isNegotiable?: boolean;
  isFlashDeal?: boolean;
  expiryTime?: string;
  purchaseType?: string;
  countryDeliverables?: any[];
  weight?: number;
  supplierListingNumber?: string;
  customerListingNumber?: string;
  packing?: string;
  currentLocation?: string;
  deliveryLocation?: string[];
  customMessage?: string;
  paymentTerm?: string;
  paymentMethod?: string;
  shippingTime?: string;
  vendor?: string;
  vendorListingNo?: string;
  carrier?: string;
  carrierListingNo?: string;
  uniqueListingNo?: string;
  tags?: string;
  remark?: string;
  warranty?: string;
  batteryHealth?: string;
  lockUnlock?: boolean;
  startTime?: string;
}

export interface ListProductsRequest {
  page: number;
  limit: number;
  search?: string;
  includeExpired?: boolean;
}

export interface ApiResponse<T = any> {
  status: number;
  message: string;
  data?: T;
}

export interface ImportResponse {
  status: number;
  message: string;
  data: {
    imported: string;
  };
}

export class ProductService {
  static create = async (
    payload: CreateProductRequest
  ): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/create`;
    try {
      // Process numeric values and boolean flags
      const processedPayload = {
        skuFamilyId: payload.skuFamilyId, 
        subSkuFamilyId: payload.subSkuFamilyId,
        specification: payload.specification,
        simType: payload.simType,
        color: payload.color,
        ram: payload.ram,
        storage: payload.storage,
        condition: payload.condition,
        price: Number(payload.price),
        stock: Number(payload.stock),
        country: payload.country,
        moq: Number(payload.moq),
        isNegotiable: Boolean(payload.isNegotiable),
        isFlashDeal: Boolean(payload.isFlashDeal),
        purchaseType: payload.purchaseType || "partial",
        expiryTime: payload.isFlashDeal ? payload.expiryTime : undefined,
      };

      // Remove undefined and empty-string values, but always keep subSkuFamilyId if provided (even empty string)
      const cleanPayload = Object.fromEntries(
        Object.entries(processedPayload).filter(([key, value]) => {
          if (key === "subSkuFamilyId") {
            return value !== undefined; // allow empty string to pass through
          }
          return value !== undefined && value !== "";
        })
      );

      const res = await api.post(url, cleanPayload);

      const data: ApiResponse = res.data;
      toastHelper.showTost(
        data.message || "Product created successfully",
        "success"
      );
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create product";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static get = async (payload: GetProductRequest): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/get`;
    try {
      const res = await api.post(url, payload);
      const data: ApiResponse = res.data;
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || err?.message || "Failed to get product";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static update = async (
    payload: UpdateProductRequest
  ): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/update`;
    try {
      // Build processed payload - only include fields that are actually provided
      // This ensures we only update fields the seller has permission for
      const processedPayload: any = {
        id: payload.id, // Always required
      };
      
      // Only process and include fields that are present in the payload
      if (payload.skuFamilyId !== undefined) {
        processedPayload.skuFamilyId = payload.skuFamilyId;
      }
      if (payload.subSkuFamilyId !== undefined) {
        processedPayload.subSkuFamilyId = payload.subSkuFamilyId;
      }
      if (payload.gradeId !== undefined) {
        processedPayload.gradeId = payload.gradeId;
      }
      if (payload.specification !== undefined) {
        processedPayload.specification = payload.specification;
      }
      if (payload.simType !== undefined) {
        processedPayload.simType = payload.simType;
      }
      if (payload.color !== undefined) {
        processedPayload.color = payload.color;
      }
      if (payload.ram !== undefined) {
        processedPayload.ram = payload.ram;
      }
      if (payload.storage !== undefined) {
        processedPayload.storage = payload.storage;
      }
      if (payload.condition !== undefined) {
        processedPayload.condition = payload.condition;
      }
      if (payload.price !== undefined) {
        processedPayload.price = Number(payload.price);
      }
      if (payload.stock !== undefined) {
        processedPayload.stock = Number(payload.stock);
      }
      if (payload.country !== undefined) {
        processedPayload.country = payload.country;
      }
      if (payload.moq !== undefined) {
        processedPayload.moq = Number(payload.moq);
      }
      if (payload.isNegotiable !== undefined) {
        processedPayload.isNegotiable = Boolean(payload.isNegotiable);
      }
      if (payload.isFlashDeal !== undefined) {
        processedPayload.isFlashDeal = Boolean(payload.isFlashDeal);
      }
      if (payload.purchaseType !== undefined) {
        processedPayload.purchaseType = payload.purchaseType;
      }
      if (payload.expiryTime !== undefined) {
        processedPayload.expiryTime = payload.expiryTime;
      }
      if (payload.weight !== undefined) {
        processedPayload.weight = payload.weight;
      }
      if (payload.supplierListingNumber !== undefined) {
        processedPayload.supplierListingNumber = payload.supplierListingNumber;
      }
      if (payload.customerListingNumber !== undefined) {
        processedPayload.customerListingNumber = payload.customerListingNumber;
      }
      if (payload.packing !== undefined) {
        processedPayload.packing = payload.packing;
      }
      if (payload.currentLocation !== undefined) {
        processedPayload.currentLocation = payload.currentLocation;
      }
      if (payload.deliveryLocation !== undefined) {
        processedPayload.deliveryLocation = payload.deliveryLocation;
      }
      if (payload.customMessage !== undefined) {
        processedPayload.customMessage = payload.customMessage;
      }
      if (payload.paymentTerm !== undefined) {
        processedPayload.paymentTerm = payload.paymentTerm;
      }
      if (payload.paymentMethod !== undefined) {
        processedPayload.paymentMethod = payload.paymentMethod;
      }
      if (payload.shippingTime !== undefined) {
        processedPayload.shippingTime = payload.shippingTime;
      }
      if (payload.vendor !== undefined) {
        processedPayload.vendor = payload.vendor;
      }
      if (payload.vendorListingNo !== undefined) {
        processedPayload.vendorListingNo = payload.vendorListingNo;
      }
      if (payload.carrier !== undefined) {
        processedPayload.carrier = payload.carrier;
      }
      if (payload.carrierListingNo !== undefined) {
        processedPayload.carrierListingNo = payload.carrierListingNo;
      }
      if (payload.uniqueListingNo !== undefined) {
        processedPayload.uniqueListingNo = payload.uniqueListingNo;
      }
      if (payload.tags !== undefined) {
        processedPayload.tags = payload.tags;
      }
      if (payload.remark !== undefined) {
        processedPayload.remark = payload.remark;
      }
      if (payload.warranty !== undefined) {
        processedPayload.warranty = payload.warranty;
      }
      if (payload.batteryHealth !== undefined) {
        processedPayload.batteryHealth = payload.batteryHealth;
      }
      if (payload.lockUnlock !== undefined) {
        processedPayload.lockUnlock = Boolean(payload.lockUnlock);
      }
      if (payload.startTime !== undefined) {
        processedPayload.startTime = payload.startTime;
      }
      
      // Include countryDeliverables if provided (for price updates)
      if (payload.countryDeliverables && Array.isArray(payload.countryDeliverables) && payload.countryDeliverables.length > 0) {
        processedPayload.countryDeliverables = payload.countryDeliverables;
      }
      
      const res = await api.post(url, processedPayload);
      const data: ApiResponse = res.data;
      toastHelper.showTost(
        data.message || "Product updated successfully",
        "success"
      );
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to update product";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static list = async (payload: ListProductsRequest): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/list`;
    try {
      const res = await api.post(url, payload);
      const data: ApiResponse = res.data;
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to list products";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static listByName = async (search: string = ""): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/listByName`;
    try {
      const res = await api.post(url, { search });
      const data: ApiResponse = res.data;
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to list by name";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static listByNameSubSkuFamily = async (
    search: string = "",
    skuFamilyId: string
  ): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/listByNameSubSkuFamily`;
    try {
      const res = await api.post(url, { search, skuFamilyId });
      const data: ApiResponse = res.data;
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to list sub sku family by name";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static importExcel = async (file: File): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/import`;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post(url, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data: ApiResponse = res.data;
      toastHelper.showTost(
        data.message || "Products imported successfully",
        "success"
      );
      return data;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to import products";
      toastHelper.showTost(errorMessage, "error");
      throw new Error(errorMessage);
    }
  };

  static verifyProduct = async (id: string): Promise<boolean> => {
    const url = `${env.baseUrl}/api/seller/product/verify`;
    try {
      await api.post(url, { id });
      toastHelper.showTost("Product verified successfully", "success");
      return true;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to verify product";
      toastHelper.showTost(errorMessage, "error");
      return false;
    }
  };

  static approveProduct = async (id: string): Promise<boolean> => {
    const url = `${env.baseUrl}/api/seller/product/approve`;
    try {
      await api.post(url, { id });
      toastHelper.showTost("Product approved successfully", "success");
      return true;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to approve product";
      toastHelper.showTost(errorMessage, "error");
      return false;
    }
  };

    // Upload Excel file for product import
  static uploadExcelFile = async (formData: FormData): Promise<ImportResponse> => {

    const url = `${env.baseUrl}/api/seller/product/import`;

    try {
      const res = await api.post(url, formData);
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to import products');
      }
      toastHelper.showTost(res.data.message || 'Products imported successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to import products';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  // Create seller product request (for new product request system)
  static createSellerProductRequest = async (productData: any): Promise<ApiResponse> => {
    const url = `${env.baseUrl}/api/seller/product/create-request`;
    try {
      const res = await api.post(url, productData);
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to create product request');
      }
      toastHelper.showTost(res.data.message || 'Product request submitted successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorCode = err.response?.data?.code || err.response?.data?.data?.code;
      const errorMessage = err.response?.data?.message || err.response?.data?.data?.message || 'Failed to create product request';
      
      // Check if it's a business profile approval error
      if (errorCode === 'BUSINESS_PROFILE_NOT_APPROVED' || errorMessage.includes('business profile must be approved')) {
        // Don't show toast, let the caller handle it with Swal
        throw new Error(errorMessage);
      }
      
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  // Get next customer listing number
  static getNextCustomerListingNumber = async (isMultiVariant: boolean = false): Promise<any> => {
    const url = `${env.baseUrl}/api/seller/product/get-next-customer-listing-number`;
    try {
      const res = await api.post(url, { isMultiVariant });
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to get next customer listing number';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Get next unique listing number (8-digit)
  static getNextUniqueListingNumber = async (): Promise<any> => {
    const url = `${env.baseUrl}/api/seller/product/get-next-unique-listing-number`;
    try {
      const res = await api.post(url, {});
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to get next unique listing number';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Get next supplier listing number for current seller
  static getNextSupplierListingNumber = async (isMultiVariant: boolean = false): Promise<any> => {
    const url = `${env.baseUrl}/api/seller/product/get-next-supplier-listing-number`;
    try {
      const res = await api.post(url, { isMultiVariant });
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to get next supplier listing number';
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Update product images and videos
  static updateProductImagesVideos = async (_id: string, formData: FormData): Promise<any> => {
    const url = `${env.baseUrl}/api/seller/product/update-images-videos`;
    try {
      const res = await api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toastHelper.showTost(res.data.message || 'Product images and videos updated successfully!', 'success');
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to update product images and videos';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}
