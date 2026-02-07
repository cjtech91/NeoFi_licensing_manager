import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  DollarSign, 
  Ticket, 
  Wifi, 
  TrendingUp, 
  AlertCircle 
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { format, startOfDay, subDays } from 'date-fns';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    salesToday: 0,
    activeVouchers: 0,
    totalMachines: 0,
    onlineMachines: 0
  });
  const [salesData, setSalesData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = startOfDay(new Date()).toISOString();

      // 1. Sales Today
      const { data: salesTodayData, error: salesError } = await supabase
        .from('sales')
        .select('amount')
        .gte('sale_time', today);
      
      if (salesError) throw salesError;
      const salesToday = (salesTodayData as { amount: number }[])?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

      // 2. Active Vouchers
      const { count: activeVouchers, error: vouchersError } = await supabase
        .from('vouchers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (vouchersError) throw vouchersError;

      // 3. Machine Status
      const { data: machines, error: machinesError } = await supabase
        .from('machines')
        .select('status');
      
      if (machinesError) throw machinesError;
      
      const totalMachines = machines?.length || 0;
      const onlineMachines = (machines as { status: string }[])?.filter(m => m.status === 'online').length || 0;

      setStats({
        salesToday,
        activeVouchers: activeVouchers || 0,
        totalMachines,
        onlineMachines
      });

      // 4. Sales Chart Data (Last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: recentSales, error: chartError } = await supabase
        .from('sales')
        .select('amount, sale_time')
        .gte('sale_time', sevenDaysAgo)
        .order('sale_time', { ascending: true });

      if (chartError) throw chartError;

      // Process chart data
      const chartMap = new Map();
      // Initialize last 7 days with 0
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'MMM dd');
        chartMap.set(date, 0);
      }

      (recentSales as { amount: number; sale_time: string }[])?.forEach(sale => {
        const date = format(new Date(sale.sale_time), 'MMM dd');
        if (chartMap.has(date)) {
          chartMap.set(date, chartMap.get(date) + sale.amount);
        }
      });

      const processedChartData = Array.from(chartMap).map(([date, amount]) => ({
        date,
        amount
      }));

      setSalesData(processedChartData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Sales Today */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-blue-500 p-3">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Sales Today
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    ₱{stats.salesToday.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Vouchers */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-green-500 p-3">
                  <Ticket className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Vouchers
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.activeVouchers}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Machine Status */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-indigo-500 p-3">
                  <Wifi className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Machines Online
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {stats.onlineMachines} / {stats.totalMachines}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Growth/Trend (Placeholder for now) */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md bg-yellow-500 p-3">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Growth Rate
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    +12.5%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Revenue Overview (Last 7 Days)
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickFormatter={(value) => `₱${value}`}
              />
              <Tooltip 
                formatter={(value: number) => [`₱${value}`, 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#2563eb" 
                strokeWidth={3} 
                dot={{ fill: '#2563eb', strokeWidth: 2, r: 4, stroke: '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
