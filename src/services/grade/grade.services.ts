import api from '../api/api';
import { env } from '../../utils/env';
import toastHelper from '../../utils/toastHelper';

export interface Grade {
  _id?: string;
  code?: string;
  title: string;
  description?: string;
}

export interface ListResponse {
  data: {
    docs: Grade[];
    totalDocs: number;
    limit: number;
    totalPages: number;
    page: number;
  };
  status: number;
  message: string;
}

export class GradeService {
  static getGradeList = async (
    page: number = 1,
    limit: number = 10,
    search: string = ''
  ): Promise<ListResponse> => {
    const url = `${env.baseUrl}/api/seller/grade/list`;

    try {
      const res = await api.post(url, { page, limit, search });
      if (res.data?.status !== 200) {
        throw new Error(res.data?.message || 'Failed to fetch Grades');
      }
      return res.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch Grades';
      // Don't show toast on initial load
      if (err.response?.status !== 404) {
        toastHelper.showTost(errorMessage, 'error');
      }
      throw new Error(errorMessage);
    }
  };
}
