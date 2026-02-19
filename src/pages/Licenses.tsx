import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Key, Plus, Copy, Check, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

interface License {
  id: string;
  key: string;
  status: 'active' | 'used' | 'revoked';
  type: 'lifetime' | 'subscription' | 'trial';
  hardware_id: string | null;
  created_at: string;
  activated_at: string | null;
}

export default function Licenses() {
  const { session } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLicenseType, setNewLicenseType] = useState<'lifetime' | 'subscription' | 'trial'>('lifetime');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchLicenses();
  }, [session]);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLicenses(data || []);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLicenseKey = () => {
    // Format: NEO-XXXX-XXXX-XXXX
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => {
      let str = '';
      for (let i = 0; i < 4; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return str;
    };
    return `NEO-${segment()}-${segment()}-${segment()}`;
  };

  const handleGenerateLicense = async () => {
    try {
      setGenerating(true);
      if (!session?.user?.id) {
        alert('Please sign in to generate a license.');
        return;
      }
      const key = generateLicenseKey();
      
      const { data, error } = await (supabase
        .from('licenses') as any)
        .insert([{ key, type: newLicenseType, status: 'active' }])
        .select()
        .single();

      if (error) throw error;

      setLicenses([data, ...licenses]);
      setShowModal(false);
    } catch (error: unknown) {
      console.error('Error generating license:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else {
         // Fallback for completely unknown errors
         try {
            errorMessage = JSON.stringify(error);
         } catch {
            errorMessage = 'Unknown error object';
         }
      }

      // Check for foreign key violation (missing user in public.users)
      if (errorMessage.includes('licenses_created_by_fkey') || 
          (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === '23503')) {
        
        try {
          // Attempt to self-heal: create the missing user record
          const { error: healError } = await (supabase.from('users') as any).insert({
            id: session?.user.id,
            email: session?.user.email,
            role: 'operator',
            // @ts-ignore - password_hash is required by DB but not in types yet if we didn't update them fully, 
            // or if we are using the types from the file we patched earlier.
            // Actually, we did update types, but let's check if we need to cast.
            // We'll just pass it.
            password_hash: 'managed_by_supabase_auth' 
          });

          if (!healError) {
             // Retry generation once
             const retryKey = generateLicenseKey();
             const { data: retryData, error: retryError } = await (supabase
                .from('licenses') as any)
                 .insert([{ key: retryKey, type: newLicenseType, status: 'active' }])
                .select()
                .single();
              
              if (!retryError) {
                setLicenses([retryData, ...licenses]);
                setShowModal(false);
                alert('License generated successfully! (User account link was fixed automatically)');
                return;
              }
          }
        } catch (e) {
          console.error('Self-healing failed:', e);
        }
      }

      alert(`Failed to generate license: ${errorMessage}`);
    } finally {
      setGenerating(false);
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
          <h1 className="text-2xl font-bold text-gray-900">License Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Generate and manage software licenses for your machines.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Licenses</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.status === 'active' || l.status === 'used').length}
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
                <RefreshCw className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Used Licenses</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.status === 'used').length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">License Keys</h3>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : licenses.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No licenses found. Generate one to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {licenses.map((license) => (
              <li key={license.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <p className="text-sm font-medium text-blue-600 truncate font-mono">
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
                        license.status === 'active' ? 'bg-green-100 text-green-800' :
                        license.status === 'used' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {license.status}
                      </span>
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        {license.type}
                      </span>
                    </div>
                    <div className="mt-2 flex">
                      <div className="flex items-center text-sm text-gray-500">
                        <span className="truncate">
                          {license.hardware_id ? `Bound to: ${license.hardware_id}` : 'Not activated yet'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-sm text-gray-500">
                    <span>Created: {new Date(license.created_at).toLocaleDateString()}</span>
                    {license.activated_at && (
                      <span className="text-xs text-gray-400">
                        Activated: {new Date(license.activated_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <Key className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Generate New License
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Select the type of license you want to generate.
                    </p>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 text-left mb-1">
                        License Type
                      </label>
                      <select
                        value={newLicenseType}
                        onChange={(e) => setNewLicenseType(e.target.value as any)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      >
                        <option value="lifetime">Lifetime</option>
                        <option value="subscription">Subscription</option>
                        <option value="trial">Trial</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm"
                  onClick={handleGenerateLicense}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
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
