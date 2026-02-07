import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/supabase';
import { Download, Calendar } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

type Sale = Database['public']['Tables']['sales']['Row'];

export default function Reports() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchSales();
  }, [range]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      let startDate = new Date();
      
      if (range === 'today') {
        startDate = startOfDay(new Date());
      } else if (range === 'week') {
        startDate = subDays(new Date(), 7);
      } else if (range === 'month') {
        startDate = subDays(new Date(), 30);
      }

      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_time', startDate.toISOString())
        .order('sale_time', { ascending: false });

      if (error) throw error;
      setSales(data || []);
      processChartData(data || [], range);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (data: Sale[], range: string) => {
    const chartMap = new Map();
    
    // Initialize map based on range
    if (range === 'today') {
      for (let i = 0; i < 24; i++) {
        chartMap.set(`${i}:00`, 0);
      }
      data.forEach(sale => {
        const hour = new Date(sale.sale_time).getHours();
        const key = `${hour}:00`;
        if (chartMap.has(key)) {
          chartMap.set(key, chartMap.get(key) + sale.amount);
        }
      });
    } else {
      const days = range === 'week' ? 7 : 30;
      for (let i = days - 1; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'MMM dd');
        chartMap.set(date, 0);
      }
      data.forEach(sale => {
        const date = format(new Date(sale.sale_time), 'MMM dd');
        if (chartMap.has(date)) {
          chartMap.set(date, chartMap.get(date) + sale.amount);
        }
      });
    }

    const processed = Array.from(chartMap).map(([name, amount]) => ({
      name,
      amount
    }));
    setChartData(processed);
  };

  const exportCSV = () => {
    const headers = ['Sale ID', 'Amount', 'Date', 'Machine ID', 'Voucher ID'];
    const csvContent = [
      headers.join(','),
      ...sales.map(sale => [
        sale.id,
        sale.amount,
        format(new Date(sale.sale_time), 'yyyy-MM-dd HH:mm:ss'),
        sale.machine_id || '',
        sale.voucher_id || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales_report_${range}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRevenue = sales.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <select
            className="block rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm border shadow-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
          >
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button
            onClick={exportCSV}
            disabled={sales.length === 0}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-white overflow-hidden shadow rounded-lg p-5">
          <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue ({range})</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">₱{totalRevenue.toLocaleString()}</dd>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg p-5">
          <dt className="text-sm font-medium text-gray-500 truncate">Total Transactions</dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{sales.length}</dd>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
          Sales Trend
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
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
                cursor={{ fill: '#F3F4F6' }}
                formatter={(value: number) => [`₱${value}`, 'Revenue']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
              />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Date & Time
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Voucher Code
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Machine ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      </td>
                    </tr>
                  ) : sales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-gray-500">
                        No sales found for this period
                      </td>
                    </tr>
                  ) : (
                    sales.slice(0, 10).map((sale) => (
                      <tr key={sale.id}>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {format(new Date(sale.sale_time), 'MMM d, yyyy HH:mm')}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                          ₱{sale.amount}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          {sale.voucher_id ? 'VOUCHER' : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                          {sale.machine_id?.substring(0, 8)}...
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {sales.length > 10 && (
                <div className="bg-gray-50 px-4 py-3 border-t text-center text-sm text-gray-500">
                  Showing recent 10 transactions of {sales.length}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
