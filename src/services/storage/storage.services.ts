import api from '../api/api';
import { env } from '../../utils/env';
import toastHelper from '../../utils/toastHelper';

export interface Storage {
  _id?: string;
  title: string;
  code?: string;
}

export interface ListResponse {
  data: {
    docs: Storage[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
  };
  status: number;
  message: string;
}

export class StorageService {
  static getStorageList = async (
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ): Promise<ListResponse> => {
    const url = `${env.baseUrl}/api/seller/storage/list`;

    try {
      const res = await api.post(url, { page, limit, search });
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch Storage');
      }
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Storage';
      // Don't show toast on initial load
      if (err.response?.status !== 404) {
        toastHelper.showTost(errorMessage, 'error');
      }
      throw new Error(errorMessage);
    }
  };
}
