import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Key, Plus, Copy, Check, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface License {
  id: string;
  key: string;
  status: 'active' | 'used' | 'revoked';
  type: 'lifetime' | 'subscription' | 'trial';
  system_serial: string | null;
  machine_id: string | null;
  created_at: string;
  activated_at: string | null;
  last_seen_at?: string | null;
}

interface Activation {
  id: string;
  created_at: string;
  license_id: string | null;
  license_key: string | null;
  system_serial: string | null;
  device_model: string | null;
  status: string | null;
  activated_at: string | null;
  message: string | null;
}

export default function Licenses() {
  const { session } = useAuth();
  const { show } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivations, setLoadingActivations] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLicenseType, setNewLicenseType] = useState<'lifetime' | 'subscription' | 'trial'>('lifetime');
  const [newLicenseQty, setNewLicenseQty] = useState<number>(1);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activationSearch, setActivationSearch] = useState<string>('');
  const [activationModel, setActivationModel] = useState<string>('all');
  const licensesRef = useRef<License[]>([]);

  const applyCloudflareStatus = async (rows: License[]) => {
    try {
      const keys = Array.from(new Set(rows.map(r => r.key).filter(Boolean)));
      if (keys.length === 0) return rows;

      const res = await fetch('/api/license-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) return rows;
      type CloudflareLicenseRecord = {
        status?: unknown;
        bound_serial?: unknown;
        activated_at?: unknown;
        machine_last_seen_at?: unknown;
      };
      const payload = (await res.json()) as { ok?: boolean; records?: Record<string, CloudflareLicenseRecord | null> };
      if (!payload || payload.ok !== true || !payload.records) return rows;

      const normalizeStatus = (s: unknown): License['status'] | null => {
        if (s === 'active' || s === 'used' || s === 'revoked') return s;
        return null;
      };

      return rows.map((r) => {
        const rec = payload.records?.[r.key];
        if (!rec) return r;
        const nextStatus = normalizeStatus(rec.status);
        const boundSerial = typeof rec.bound_serial === 'string' && rec.bound_serial.trim().length > 0 ? rec.bound_serial.trim() : null;
        const activatedAt =
          typeof rec.activated_at === 'number' && Number.isFinite(rec.activated_at) ? new Date(rec.activated_at).toISOString() : r.activated_at;
        const lastSeenAt =
          typeof rec.machine_last_seen_at === 'number' && Number.isFinite(rec.machine_last_seen_at)
            ? new Date(rec.machine_last_seen_at).toISOString()
            : r.last_seen_at ?? null;

        return {
          ...r,
          status: nextStatus ?? r.status,
          system_serial: boundSerial ?? r.system_serial,
          activated_at: activatedAt,
          last_seen_at: lastSeenAt,
        };
      });
    } catch {
      return rows;
    }
  };

  useEffect(() => {
    licensesRef.current = licenses;
  }, [licenses]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const current = licensesRef.current;
      if (current.length === 0) return;
      const merged = await applyCloudflareStatus(current);
      if (cancelled) return;
      const changed = merged.some((m, i) => {
        const o = current[i];
        return m.status !== o.status || m.system_serial !== o.system_serial || m.activated_at !== o.activated_at;
      });
      if (changed) setLicenses(merged);
    };

    const id = window.setInterval(run, 15000);
    window.setTimeout(run, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    fetchLicenses();
    fetchActivations();
    const channel = supabase
      .channel('licenses-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'licenses' },
        () => {
          fetchLicenses();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activations' },
        () => {
          fetchActivations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const merged = await applyCloudflareStatus((data || []) as License[]);
      setLicenses(merged);
    } catch (error) {
      console.error('Error fetching licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivations = async () => {
    try {
      setLoadingActivations(true);
      const { data, error } = await supabase
        .from('activations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setActivations(data || []);
    } catch (error) {
      console.error('Error fetching activations:', error);
    } finally {
      setLoadingActivations(false);
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
        .from('licenses')
        .select('*')
        .or(`key.ilike.%${q}%,system_serial.ilike.%${q}%`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const merged = await applyCloudflareStatus((data || []) as License[]);
      setLicenses(merged);
    } catch (error) {
      console.error('Error searching licenses:', error);
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
      const qty = Math.max(1, Math.min(100, Number.isFinite(newLicenseQty) ? Math.floor(newLicenseQty) : 1));
      const items = Array.from({ length: qty }, () => ({
        key: generateLicenseKey(),
        type: newLicenseType,
        status: 'active',
      }));
      const { data, error } = await (supabase
        .from('licenses') as any)
        .insert(items)
        .select();

      if (error) throw error;

      setLicenses([...(data || []), ...licenses]);
      setShowModal(false);
    } catch (error: unknown) {
      console.error('Error generating license:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        const maybeMsg = error as { message?: string };
        if (typeof maybeMsg.message === 'string') {
          errorMessage = maybeMsg.message;
        }
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
      const maybeCode = (typeof error === 'object' && error !== null && 'code' in (error as Record<string, unknown>))
        ? (error as { code?: string }).code
        : undefined;
      if (errorMessage.includes('licenses_created_by_fkey') || maybeCode === '23503') {
        
        try {
          // Attempt to self-heal: create the missing user record
          const { error: healError } = await (supabase
            .from('users') as any)
            .insert({
              id: session?.user.id as string,
              email: session?.user.email as string,
              role: 'operator',
              password_hash: 'managed_by_supabase_auth'
            });

          if (!healError) {
             // Retry generation once
             const retryItems = [{
               key: generateLicenseKey(),
               type: newLicenseType,
               status: 'active'
             }];
             const { data: retryData, error: retryError } = await (supabase
                .from('licenses') as any)
                 .insert(retryItems)
                .select();
              
              if (!retryError) {
                setLicenses([...(retryData || []), ...licenses]);
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

  const handleRevokeLicense = async (licenseId: string) => {
    try {
      if (!session?.user?.id) return;
      const ok = window.confirm('Revoke this license? This will lock the device immediately.');
      if (!ok) return;
      const { data, error } = await (supabase
        .from('licenses') as any)
        .update({ status: 'revoked' })
        .eq('id', licenseId)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.id === licenseId ? data : l)));
      show('License revoked successfully', 'success');
    } catch (e) {
      console.error('Error revoking license:', e);
      show('Failed to revoke license', 'error');
    }
  };

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopySuccess(key);
    setTimeout(() => setCopySuccess(null), 2000);
  };
  
  const handleBindHardware = async (licenseId: string) => {
    try {
      if (!session?.user?.id) return;
      const systemSerial = window.prompt('Enter System Serial to bind');
      if (!systemSerial) return;
      const { data, error } = await (supabase
        .from('licenses') as any)
        .update({ system_serial: systemSerial })
        .eq('id', licenseId)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.id === licenseId ? data : l)));
      alert('License bound to System Serial successfully');
    } catch (e) {
      console.error('Error binding System Serial:', e);
      alert('Failed to bind System Serial');
    }
  };
  
  const handleUnbindHardware = async (licenseId: string) => {
    try {
      if (!session?.user?.id) return;
      const lic = licenses.find(l => l.id === licenseId);
      const isRevoked = lic?.status === 'revoked';
      const ok = window.confirm(isRevoked 
        ? 'This license is revoked. Unbind the serial so the key can be reused?' 
        : 'Unbind this license from its System Serial?');
      if (!ok) return;
      if (isRevoked) {
        const ok2 = window.confirm('Are you sure? The license will remain revoked, only the serial is removed.');
        if (!ok2) return;
      }
      const { data, error } = await (supabase
        .from('licenses') as any)
        .update({ system_serial: null, activated_at: null, machine_id: null, status: 'active' })
        .eq('id', licenseId)
        .select()
        .single();
      if (error) throw error;
      setLicenses(licenses.map(l => (l.id === licenseId ? data : l)));
      show('Serial unbound. License is reusable.', 'success');
    } catch (e) {
      console.error('Error unbinding System Serial:', e);
      show('Failed to unbind System Serial', 'error');
    }
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
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by key or serial"
            className="inline-flex px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearchLicenses}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Search
          </button>
          <button
            onClick={clearSearchLicenses}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Clear
          </button>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Active (Bound)</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.system_serial !== null || l.status === 'used').length}
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Unused Licenses</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {licenses.filter(l => l.status === 'active' && !l.system_serial).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Licenses Tables */}
      {loading ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Unused / Revoked Licenses */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Unused / Revoked Licenses</h3>
            </div>
            {licenses.filter(l => (l.status === 'active' && !l.system_serial) || l.status === 'revoked').length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No unused / revoked licenses found. Generate one to get started.
              </div>
            ) : (
              <div className="h-96 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {licenses
                    .filter(l => (l.status === 'active' && !l.system_serial) || l.status === 'revoked')
                    .map((license) => (
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
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                license.status === 'revoked'
                                  ? 'bg-red-100 text-red-800'
                                  : (!license.system_serial && license.status === 'active')
                                    ? 'bg-green-100 text-green-800'
                                    : license.status === 'used'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {!license.system_serial && license.status === 'active' ? 'unused' : license.status}
                            </span>
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              {license.type}
                            </span>
                            {license.status !== 'revoked' && (
                              <button
                                onClick={() => handleBindHardware(license.id)}
                                className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                              >
                                Bind Serial
                              </button>
                            )}
                            {license.status !== 'revoked' && license.system_serial && (
                              <button
                                onClick={() => handleUnbindHardware(license.id)}
                                className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                              >
                                Unbind Serial
                              </button>
                            )}
                            {license.status === 'revoked' && (
                              <button
                                onClick={() => handleUnbindHardware(license.id)}
                                className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                              >
                                Unbind Serial
                              </button>
                            )}
                          </div>
                          <div className="mt-2 flex">
                            <div className="flex items-center text-sm text-gray-500">
                              <span className="truncate">
                                {license.system_serial ? `Bound to: ${license.system_serial}` : 'Not activated yet'}
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
              </div>
            )}
          </div>

          {/* Active Bound / Used Licenses */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Active Bound Licenses</h3>
            </div>
            {licenses.filter(l => (l.system_serial !== null || l.status === 'used') && l.status !== 'revoked').length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No active bound licenses found.
              </div>
            ) : (
              <div className="h-96 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {licenses.filter(l => (l.system_serial !== null || l.status === 'used') && l.status !== 'revoked').map((license) => (
                    <li key={license.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <p className="text-sm font-medium text-blue-600 truncate font-mono">
                              {license.key}
                            </p>
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {license.status}
                            </span>
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              {license.type}
                            </span>
                            {license.last_seen_at && Date.now() - new Date(license.last_seen_at).getTime() < 2 * 60 * 1000 && (
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                online
                              </span>
                            )}
                            <button
                              onClick={() => handleRevokeLicense(license.id)}
                              className="ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Revoke
                            </button>
                            {license.system_serial && (
                              <button
                                onClick={() => handleUnbindHardware(license.id)}
                                className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                              >
                                Unbind Serial
                              </button>
                            )}
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
                            <p className="mt-1 flex items-center">
                              <span className="font-medium mr-2">Last Seen:</span>
                              <span>
                                {license.last_seen_at
                                  ? new Date(license.last_seen_at).toLocaleString()
                                  : 'N/A'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end text-sm text-gray-500">
                          <span>Created: {new Date(license.created_at).toLocaleDateString()}</span>
                          {license.machine_id && (
                            <span className="text-xs text-gray-400 mt-1">
                              Machine ID: {license.machine_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          


          {/* Recent Activations */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activations</h3>
            </div>
            <div className="px-4 py-4 sm:px-6 flex items-center gap-2">
              <input
                value={activationSearch}
                onChange={(e) => setActivationSearch(e.target.value)}
                placeholder="Search by key, serial, or model"
                className="inline-flex px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={activationModel}
                onChange={(e) => setActivationModel(e.target.value)}
                className="inline-flex px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All models</option>
                {[...new Set(activations.map(a => a.device_model).filter(Boolean))].map((m) => (
                  <option key={m as string} value={m as string}>{m as string}</option>
                ))}
              </select>
              <button
                onClick={() => { setActivationSearch(''); setActivationModel('all'); }}
                className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Clear
              </button>
            </div>
            {loadingActivations ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : activations.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No activations recorded yet.
              </div>
            ) : (
              <div className="h-96 overflow-y-auto">
                <ul className="divide-y divide-gray-200">
                  {activations
                    .filter((a) => {
                      const q = activationSearch.trim().toLowerCase();
                      const matchesQuery = !q || [
                        a.license_key || '',
                        a.system_serial || '',
                        a.device_model || ''
                      ].some(v => v.toLowerCase().includes(q));
                      const matchesModel = activationModel === 'all' || (a.device_model || '') === activationModel;
                      return matchesQuery && matchesModel;
                    })
                    .map((a) => (
                    <li key={a.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <p className="text-sm font-medium text-blue-600 truncate font-mono">
                              {a.license_key || 'N/A'}
                            </p>
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              a.status === 'used' ? 'bg-blue-100 text-blue-800' :
                              a.status === 'active' ? 'bg-green-100 text-green-800' :
                              a.status === 'revoked' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {a.status || 'unknown'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            <p className="flex items-center">
                              <span className="font-medium mr-2">System Serial:</span>
                              <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono text-xs">
                                {a.system_serial || 'N/A'}
                              </code>
                            </p>
                            <p className="mt-1 flex items-center">
                              <span className="font-medium mr-2">Device Model:</span>
                              <span>{a.device_model || 'N/A'}</span>
                            </p>
                            <p className="mt-1 flex items-center">
                              <span className="font-medium mr-2">Activated:</span>
                              <span>
                                {a.activated_at 
                                  ? new Date(a.activated_at).toLocaleString() 
                                  : (a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A')}
                              </span>
                            </p>
                            {a.message && (
                              <p className="mt-1 text-xs text-gray-400">{a.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
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
                        onChange={(e) => setNewLicenseType(e.target.value as 'lifetime' | 'subscription' | 'trial')}
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
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Up to 100 at once.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
