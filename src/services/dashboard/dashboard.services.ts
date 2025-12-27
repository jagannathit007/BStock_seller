import api from "../api/api";

export interface SellerDashboardStats {
  products: {
    all: number;
    active: number;
    underApproval: number;
    underVerification: number;
    pendingAdminDetails: number;
    rejected: number;
    nonActive: number;
    verified: number;
    unverified: number;
    approved: number;
    unapproved: number;
    today: number;
  };
  statusBreakdown: {
    pending_admin_details: number;
    under_verification: number;
    under_approval: number;
    approved: number;
    rejected: number;
  };
  isStatusBreakdown: {
    active: number;
    nonactive: number;
  };
  recentProducts: Array<{
    _id: string;
    name?: string;
    status: string;
    isStatus: string;
    isVerified: boolean;
    isApproved: boolean;
    createdAt: string;
  }>;
}

export interface DashboardResponse {
  status: number;
  message: string;
  data?: SellerDashboardStats;
}

export class DashboardService {
  static getDashboardStats = async (): Promise<SellerDashboardStats> => {
    try {
      const res = await api.post('/api/seller/dashboard/stats', {});
      const data: DashboardResponse = res.data;

      if (data.status === 200 && data.data) {
        return data.data;
      }

      throw new Error(data.message || 'Failed to fetch dashboard statistics');
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch dashboard statistics';
      throw new Error(errorMessage);
    }
  };
}

