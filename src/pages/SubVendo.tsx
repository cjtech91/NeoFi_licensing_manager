import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Key, Plus, Copy, Check, Loader2, ShieldCheck, Server } from 'lucide-react';

interface SubVendoLicense {
  key: string;
  system_serial: string | null;
  status: 'unused' | 'active' | 'revoked';
  activated_at: string | null;
  created_at: string;
}

export default function SubVendo() {
  const { session } = useAuth();
  const [licenses, setLicenses] = useState<SubVendoLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLicenseQty, setNewLicenseQty] = useState<number>(1);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchLicenses();
  }, [session]);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sub_vendo_licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error fetching sub vendo licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchLicenses = async () => {
    try {
      setLoading(true);
      const q = searchQuery.trim();
      if (!q) {
        await fetchLicenses();
        return;
      }
      const { data, error } = await supabase
        .from('sub_vendo_licenses')
        .select('*')
        .or(`key.ilike.%${q}%,system_serial.ilike.%${q}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error searching sub vendo licenses:', error);
      alert('Failed to search licenses');
    } finally {
      setLoading(false);
    }
  };

  const clearSearchLicenses = async () => {
    setSearchQuery('');
    await fetchLicenses();
  };

  const generateLicenseKey = () => {
    // Format: 10 random alphanumeric characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let str = '';
    for (let i = 0; i < 10; i++) {
      str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
  };

  const handleGenerateLicense = async () => {
    try {
      setGenerating(true);
      if (!session?.user?.id) {
        alert('Please sign in to generate a license.');
        return;
      }
      const qty = Math.max(1, Math.min(100, Number.isFinite(newLicenseQty) ? Math.floor(newLicenseQty) : 1));
      const items = Array.from({ length: qty }, () => ({
        key: generateLicenseKey(),
        status: 'unused',
      }));
      const { data, error } = await (supabase
        .from('sub_vendo_licenses') as any)
        .insert(items)
        .select();

      if (error) throw error;

      setLicenses([...(data || []), ...licenses]);
      setShowModal(false);
    } catch (error: any) {
      console.error('Error generating license:', error);
      alert(`Failed to generate license: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeLicense = async (key: string) => {
    try {
      if (!session?.user?.id) return;
      const ok = window.confirm('Revoke this license? This will lock the device immediately.');
      if (!ok) return;
      const { data, error } = await (supabase
        .from('sub_vendo_licenses') as any)
        .update({ status: 'revoked' })
        .eq('key', key)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.key === key ? data : l)));
    } catch (e) {
      console.error('Error revoking license:', e);
      alert('Failed to revoke license');
    }
  };

  const handleBindHardware = async (key: string) => {
    try {
      if (!session?.user?.id) return;
      const systemSerial = window.prompt('Enter System Serial to bind');
      if (!systemSerial) return;
      const { data, error } = await (supabase
        .from('sub_vendo_licenses') as any)
        .update({ system_serial: systemSerial, status: 'active', activated_at: new Date().toISOString() })
        .eq('key', key)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.key === key ? data : l)));
      alert('License bound to System Serial successfully');
    } catch (e) {
      console.error('Error binding System Serial:', e);
      alert('Failed to bind System Serial');
    }
  };

  const handleUnbindHardware = async (key: string) => {
    try {
      if (!session?.user?.id) return;
      const ok = window.confirm('Unbind this license from its hardware?');
      if (!ok) return;
      const { data, error } = await (supabase
        .from('sub_vendo_licenses') as any)
        .update({ system_serial: null, activated_at: null, status: 'unused' })
        .eq('key', key)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.key === key ? data : l)));
      alert('License unbound successfully');
    } catch (e) {
      console.error('Error unbinding System Serial:', e);
      alert('Failed to unbind System Serial');
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopySuccess(key);
    setTimeout(() => setCopySuccess(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sub Vendo Licenses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage licenses for ESP8266 Sub Vendo devices.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by key or serial"
            className="inline-flex px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleSearchLicenses}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Search
          </button>
          <button
            onClick={clearSearchLicenses}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Clear
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate License
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Key className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Licenses</dt>
                  <dd className="text-lg font-medium text-gray-900">{licenses.length}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheck className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active (Bound)</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.status === 'active').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Server className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Unused</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.status === 'unused').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Available (Unused) Licenses */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Unused / Revoked Licenses</h3>
            </div>
            {licenses.filter(l => l.status === 'unused' || l.status === 'revoked').length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No unused licenses found. Generate one to get started.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {licenses.filter(l => l.status === 'unused' || l.status === 'revoked').map((license) => (
                  <li key={license.key} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                          <p className="text-sm font-medium text-indigo-600 truncate font-mono">
                            {license.key}
                          </p>
                          <button
                            onClick={() => copyToClipboard(license.key)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copySuccess === license.key ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            license.status === 'unused' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {license.status}
                          </span>
                          <button
                            onClick={() => handleBindHardware(license.key)}
                            className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Bind Serial
                          </button>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            Created: {new Date(license.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active (Bound) Licenses */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Active Licenses</h3>
            </div>
            {licenses.filter(l => l.status === 'active').length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No active licenses found.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {licenses.filter(l => l.status === 'active').map((license) => (
                  <li key={license.key} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <p className="text-sm font-medium text-indigo-600 truncate font-mono">
                            {license.key}
                          </p>
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {license.status}
                          </span>
                          <button
                            onClick={() => handleRevokeLicense(license.key)}
                            className="ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Revoke
                          </button>
                          <button
                            onClick={() => handleUnbindHardware(license.key)}
                            className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                          >
                            Unbind Serial
                          </button>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                          <p className="flex items-center">
                            <span className="font-medium mr-2">System Serial:</span>
                            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono text-xs">
                              {license.system_serial || 'N/A'}
                            </code>
                          </p>
                          <p className="mt-1 flex items-center">
                            <span className="font-medium mr-2">Activated:</span>
                            <span>
                              {license.activated_at 
                                ? new Date(license.activated_at).toLocaleString() 
                                : 'N/A'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setShowModal(false)}></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100">
                  <Plus className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Generate Sub Vendo License
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Generate random 10-character alphanumeric keys.
                    </p>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 text-left mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newLicenseQty}
                      onChange={(e) => setNewLicenseQty(parseInt(e.target.value || '1', 10))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Up to 100 at once.</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                  onClick={handleGenerateLicense}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
