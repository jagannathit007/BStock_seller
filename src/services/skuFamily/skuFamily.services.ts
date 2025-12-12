import api from '../api/api';
import { env } from '../../utils/env';
import toastHelper from '../../utils/toastHelper';

interface SkuFamily {
  _id?: string;
  name: string;
  subSkuFamilies?: Array<{
    _id: string;
    subName?: string;
    storageId?: { _id: string; title: string; code?: string } | null;
    ramId?: { _id: string; title: string; code?: string } | null;
    colorId?: { _id: string; title: string; code?: string } | null;
  }>;
}

export class SkuFamilyService {
  static getSkuFamilyListByName = async (): Promise<SkuFamily[]> => {
    const url = `${env.baseUrl}/api/seller/product/listByName`;

    try {
      const res = await api.post(url, { search: '' });
      return res.data.data || [];
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch SKU Families';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };

  static getSubSkuFamilyListByName = async (skuFamilyId?: string): Promise<{ _id: string; name: string }[]> => {
    const url = `${env.baseUrl}/api/seller/product/listByNameSubSkuFamily`;

    try {
      const res = await api.post(url, { search: '', skuFamilyId: skuFamilyId || '' });
      const subSkuFamilies = res.data?.data || [];
      return subSkuFamilies.map((item: any) => ({
        _id: item._id,
        name: item.value || item.name || item._id
      }));
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Sub SKU Families';
      toastHelper.showTost(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  };
}
