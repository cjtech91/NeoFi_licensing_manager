import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Check, Loader2, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type LicenseRow = {
  license_key: string;
  status: string;
  owner: string | null;
  type: string;
  expires_at: number | null;
  bound_serial: string | null;
  activated_at: number | null;
  created_at: number | null;
  updated_at: number | null;
};

type License = {
  key: string;
  status: 'active' | 'used' | 'revoked';
  type: 'lifetime' | 'subscription' | 'trial';
  owner: string | null;
  system_serial: string | null;
  activated_at: string | null;
  created_at: string;
  last_seen_at: string | null;
};

type CloudflareStatusRecord = {
  status?: unknown;
  bound_serial?: unknown;
  activated_at?: unknown;
  machine_last_seen_at?: unknown;
};

function normalizeStatus(v: unknown): License['status'] {
  const s = String(v || '').toLowerCase();
  if (s === 'used') return 'used';
  if (s === 'revoked') return 'revoked';
  return 'active';
}

function normalizeType(v: unknown): License['type'] {
  const s = String(v || '').toLowerCase();
  if (s === 'subscription') return 'subscription';
  if (s === 'trial') return 'trial';
  return 'lifetime';
}

function toIso(ms: number | null | undefined) {
  if (!ms || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export default function Licenses() {
  const { getAuthHeader } = useAuth();
  const { show } = useToast();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLicenseType, setNewLicenseType] = useState<License['type']>('lifetime');
  const [newLicenseQty, setNewLicenseQty] = useState<number>(1);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const licensesRef = useRef<License[]>([]);

  const allSelected = licenses.length > 0 && selectedKeys.size === licenses.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(licenses.map((l) => l.key)));
  };

  const toggleSelectOne = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchLicenses = async (q?: string) => {
    try {
      setLoading(true);
      const url = new URL('/api/licenses-list', window.location.origin);
      if (q) url.searchParams.set('q', q);
      const res = await fetch(url.toString(), { headers: { ...getAuthHeader() } });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; licenses?: LicenseRow[] };
      if (!res.ok || data.ok !== true) throw new Error('Failed to load licenses');
      const rows = (data.licenses || []).map((r) => ({
        key: r.license_key,
        status: normalizeStatus(r.status),
        type: normalizeType(r.type),
        owner: r.owner ?? null,
        system_serial: r.bound_serial ?? null,
        activated_at: toIso(r.activated_at),
        created_at: toIso(r.created_at) || new Date().toISOString(),
        last_seen_at: null,
      })) as License[];
      const merged = await applyCloudflareStatus(rows);
      setLicenses(merged);
    } catch {
      setLicenses([]);
      show('Failed to load licenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyCloudflareStatus = async (rows: License[]) => {
    try {
      const keys = Array.from(new Set(rows.map((r) => (r.key || '').trim()).filter(Boolean)));
      if (keys.length === 0) return rows;
      const res = await fetch('/api/license-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) return rows;
      const payload = (await res.json().catch(() => ({}))) as { ok?: boolean; records?: unknown };
      const rawRecords =
        payload && payload.ok === true && payload.records && typeof payload.records === 'object' && !Array.isArray(payload.records)
          ? (payload.records as Record<string, unknown>)
          : {};

      const records: Record<string, CloudflareStatusRecord | null> = {};
      for (const [k, v] of Object.entries(rawRecords)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const obj = v as Record<string, unknown>;
          if ('record' in obj) {
            const inner = obj.record;
            records[k] = inner && typeof inner === 'object' && !Array.isArray(inner) ? (inner as CloudflareStatusRecord) : inner === null ? null : null;
          } else {
            records[k] = obj as CloudflareStatusRecord;
          }
        } else {
          records[k] = v === null ? null : null;
        }
      }

      return rows.map((r) => {
        const k = (r.key || '').trim();
        const rec = records[k];
        if (!rec) return r;
        const boundSerial = typeof rec.bound_serial === 'string' && rec.bound_serial.trim() ? rec.bound_serial.trim() : r.system_serial;
        const activatedAt = typeof rec.activated_at === 'number' ? toIso(rec.activated_at) : r.activated_at;
        const lastSeenAt = typeof rec.machine_last_seen_at === 'number' ? toIso(rec.machine_last_seen_at) : r.last_seen_at;
        return {
          ...r,
          status: normalizeStatus(rec.status ?? r.status),
          system_serial: boundSerial,
          activated_at: activatedAt,
          last_seen_at: lastSeenAt,
        };
      });
    } catch {
      return rows;
    }
  };

  useEffect(() => {
    fetchLicenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        return m.status !== o.status || m.system_serial !== o.system_serial || m.activated_at !== o.activated_at || m.last_seen_at !== o.last_seen_at;
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

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const qty = Math.max(1, Math.min(200, Number.isFinite(newLicenseQty) ? Math.floor(newLicenseQty) : 1));
      const res = await fetch('/api/licenses-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ qty, type: newLicenseType }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; licenses?: LicenseRow[]; error?: string };
      if (!res.ok || data.ok !== true) throw new Error(data.error || 'Failed to generate');
      const created = (data.licenses || []).map((r) => ({
        key: r.license_key,
        status: normalizeStatus(r.status),
        type: normalizeType(r.type),
        owner: r.owner ?? null,
        system_serial: r.bound_serial ?? null,
        activated_at: toIso(r.activated_at),
        created_at: toIso(r.created_at) || new Date().toISOString(),
        last_seen_at: null,
      })) as License[];
      const merged = await applyCloudflareStatus(created);
      setLicenses((prev) => [...merged, ...prev]);
      setShowModal(false);
      show('License(s) generated', 'success');
    } catch {
      show('Failed to generate licenses', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSearch = async () => {
    await fetchLicenses(searchQuery.trim() || undefined);
  };

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopySuccess(key);
      setTimeout(() => setCopySuccess(null), 1500);
    } catch {
      show('Copy failed', 'error');
    }
  };

  const updateLicense = async (key: string, action: 'revoke' | 'unbind' | 'bind', systemSerial?: string) => {
    const res = await fetch('/api/licenses-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ key, action, system_serial: systemSerial }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.ok !== true) throw new Error(data.error || 'Failed');
  };

  const handleRevoke = async (key: string) => {
    try {
      const ok = window.confirm(`Revoke license ${key}?`);
      if (!ok) return;
      await updateLicense(key, 'revoke');
      setLicenses((prev) => prev.map((l) => (l.key === key ? { ...l, status: 'revoked' } : l)));
      show('License revoked', 'success');
    } catch {
      show('Failed to revoke license', 'error');
    }
  };

  const handleUnbind = async (key: string) => {
    try {
      const ok = window.confirm(`Unbind serial for ${key}?`);
      if (!ok) return;
      await updateLicense(key, 'unbind');
      setLicenses((prev) => prev.map((l) => (l.key === key ? { ...l, status: 'active', system_serial: null, activated_at: null } : l)));
      show('License unbound', 'success');
    } catch {
      show('Failed to unbind', 'error');
    }
  };

  const handleBind = async (key: string) => {
    try {
      const serial = window.prompt('Enter System Serial to bind:');
      if (!serial) return;
      await updateLicense(key, 'bind', serial);
      setLicenses((prev) =>
        prev.map((l) => (l.key === key ? { ...l, status: 'used', system_serial: serial, activated_at: l.activated_at || new Date().toISOString() } : l))
      );
      show('Serial bound', 'success');
    } catch {
      show('Failed to bind serial', 'error');
    }
  };

  const deleteKeys = async (keys: string[]) => {
    const res = await fetch('/api/licenses-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ keys }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || data.ok !== true) throw new Error(data.error || 'Failed');
  };

  const handleDeleteSelected = async () => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    const ok = window.confirm(`Delete ${keys.length} selected license(s)? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteKeys(keys);
      setLicenses((prev) => prev.filter((l) => !selectedKeys.has(l.key)));
      setSelectedKeys(new Set());
      show('Selected licenses deleted', 'success');
    } catch {
      show('Failed to delete selected licenses', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (licenses.length === 0) return;
    const phrase = window.prompt('Type DELETE to confirm deleting ALL licenses currently loaded in this list.');
    if (phrase !== 'DELETE') return;
    try {
      await deleteKeys(licenses.map((l) => l.key));
      setLicenses([]);
      setSelectedKeys(new Set());
      show('All licenses deleted', 'success');
    } catch {
      show('Failed to delete all licenses', 'error');
    }
  };

  const activeBound = useMemo(() => licenses.filter((l) => (l.system_serial !== null || l.status === 'used') && l.status !== 'revoked'), [licenses]);
  const unusedOrRevoked = useMemo(() => licenses.filter((l) => ((l.status === 'active' && !l.system_serial) || l.status === 'revoked')), [licenses]);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Licenses</h1>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <button
            onClick={() => fetchLicenses(searchQuery.trim() || undefined)}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50"
            disabled={licenses.length === 0}
          >
            {allSelected ? 'Unselect All' : 'Select All'}
          </button>
          <button
            onClick={handleDeleteSelected}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
            disabled={selectedKeys.size === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedKeys.size})
          </button>
          <button
            onClick={handleDeleteAll}
            className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm bg-white text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={licenses.length === 0}
          >
            Delete All
          </button>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by key or serial"
            className="inline-flex px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            Search
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Generate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Unused / Revoked Licenses</h3>
            </div>
            <div className="h-[520px] overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {unusedOrRevoked.map((l) => (
                  <li key={l.key} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center space-x-3 mb-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={selectedKeys.has(l.key)}
                        onChange={() => toggleSelectOne(l.key)}
                      />
                      <p className="text-sm font-medium text-blue-600 truncate font-mono">{l.key}</p>
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{l.status}</span>
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{l.type}</span>
                      <button
                        onClick={() => handleCopy(l.key)}
                        className="ml-2 px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {copySuccess === l.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleBind(l.key)}
                        className="ml-2 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                      >
                        Bind Serial
                      </button>
                      {l.status !== 'revoked' && (
                        <button
                          onClick={() => handleRevoke(l.key)}
                          className="ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>Created: {new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  </li>
                ))}
                {unusedOrRevoked.length === 0 && <li className="px-4 py-10 text-center text-gray-500">No unused/revoked licenses</li>}
              </ul>
            </div>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Active (Bound)</h3>
            </div>
            <div className="h-[520px] overflow-y-auto">
              <ul className="divide-y divide-gray-200">
                {activeBound.map((l) => {
                  const online = l.last_seen_at ? Date.now() - new Date(l.last_seen_at).getTime() < 2 * 60 * 1000 : false;
                  return (
                    <li key={l.key} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center space-x-3 mb-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={selectedKeys.has(l.key)}
                          onChange={() => toggleSelectOne(l.key)}
                        />
                        <p className="text-sm font-medium text-blue-600 truncate font-mono">{l.key}</p>
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{l.status}</span>
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">{l.type}</span>
                        {online && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">online</span>
                        )}
                        <button
                          onClick={() => handleCopy(l.key)}
                          className="ml-2 px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                        >
                          {copySuccess === l.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleUnbind(l.key)}
                          className="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                        >
                          Unbind
                        </button>
                        <button
                          onClick={() => handleRevoke(l.key)}
                          className="ml-2 px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          Revoke
                        </button>
                      </div>
                      <div className="mt-2 text-sm text-gray-500 space-y-1">
                        <div className="flex items-center">
                          <span className="font-medium mr-2">System Serial:</span>
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono text-xs">{l.system_serial || 'N/A'}</code>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium mr-2">Activated:</span>
                          <span>{l.activated_at ? new Date(l.activated_at).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium mr-2">Last Seen:</span>
                          <span>{l.last_seen_at ? new Date(l.last_seen_at).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center text-xs text-gray-500">
                        <ShieldCheck className="h-4 w-4 mr-2 text-green-600" />
                        Verified by Cloudflare
                      </div>
                    </li>
                  );
                })}
                {activeBound.length === 0 && <li className="px-4 py-10 text-center text-gray-500">No active/bound licenses</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Generate Licenses</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={newLicenseType}
                      onChange={(e) => setNewLicenseType(e.target.value as License['type'])}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    >
                      <option value="lifetime">lifetime</option>
                      <option value="subscription">subscription</option>
                      <option value="trial">trial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={newLicenseQty}
                      onChange={(e) => setNewLicenseQty(Number(e.target.value))}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 px-3 border shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
