import { useEffect, useState } from "react";
import {
  BoxIcon,
  // BoxIconLine,
  CheckCircleIcon,
  // TimeIcon,
  TaskIcon,
  // ErrorIcon,
} from "../../icons";
import { DashboardService, SellerDashboardStats } from "../../services/dashboard/dashboard.services";
import { useNavigate } from "react-router";

export default function EcommerceMetrics() {
  const [stats, setStats] = useState<SellerDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await DashboardService.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded mb-3"></div>
                <div className="h-8 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-20 bg-gray-200 rounded"></div>
              </div>
              <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-800 p-6">
        <p className="text-gray-600 dark:text-gray-400">Failed to load dashboard statistics</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {/* All Products Card */}
      <div 
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/products')}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                All Products
              </p>
            </div>
            <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              {formatNumber(stats.products.all)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Total products created
            </p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
            <BoxIcon className="text-indigo-600 dark:text-indigo-400 size-6" />
          </div>
        </div>
      </div>

      {/* Active Products Card */}
      <div 
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/products')}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Active Products
              </p>
            </div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              {formatNumber(stats.products.active)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Approved & Verified
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl">
            <CheckCircleIcon className="text-green-600 dark:text-green-400 size-6" />
          </div>
        </div>
      </div>

      {/* Under Approval Card */}
      {/* <div 
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/products')}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Under Approval
              </p>
            </div>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
              {formatNumber(stats.products.underApproval)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Awaiting admin approval
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-xl">
            <TaskIcon className="text-yellow-600 dark:text-yellow-400 size-6" />
          </div>
        </div>
      </div> */}

      {/* Under Verification Card */}
      <div 
        className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/products')}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Under Verification
              </p>
            </div>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {formatNumber(stats.products.all - stats.products.active)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              All products except active
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
            <TaskIcon className="text-blue-600 dark:text-blue-400 size-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
