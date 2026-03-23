import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import { useToast } from '../context/ToastContext';

type LicenseLogRecord = {
  event?: string;
  status?: string;
  key?: string;
  system_serial?: string;
  device_model?: string;
  message?: string | null;
  ts?: string;
};

type LicenseLogItem = {
  name: string;
  record: LicenseLogRecord;
};

type ApiResponse = {
  ok: boolean;
  prefix?: string;
  cursor: string | null;
  list_complete: boolean;
  items: LicenseLogItem[];
};

function parseLogTs(item: LicenseLogItem) {
  if (item.record.ts) {
    const d = new Date(item.record.ts);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const parts = item.name.split(':');
  const last = parts[parts.length - 1] || '';
  const ms = Number(last);
  if (Number.isFinite(ms) && ms > 0) return new Date(ms);
  return null;
}

export default function LicenseLogs() {
  const { show } = useToast();
  const [keyFilter, setKeyFilter] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'activate' | 'validate' | 'revoke' | 'heartbeat' | 'subvendo' | 'other'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'used' | 'active' | 'revoked' | 'expired' | 'denied'>('all');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<LicenseLogItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [listComplete, setListComplete] = useState(false);

  const filtered = useMemo(() => {
    const normEvent = (v: string) => v.trim().toLowerCase();
    return items.filter((it) => {
      const e = normEvent(it.record.event || '');
      const st = normEvent(it.record.status || '');
      const matchesEvent =
        eventFilter === 'all'
          ? true
          : eventFilter === 'other'
            ? !['activate', 'validate', 'revoke', 'heartbeat', 'subvendo'].includes(e)
            : e === eventFilter;
      const matchesStatus = statusFilter === 'all' ? true : st === statusFilter;
      return matchesEvent && matchesStatus;
    });
  }, [items, eventFilter, statusFilter]);

  const fetchLogs = async (opts: { reset: boolean }) => {
    try {
      setLoading(true);
      const body = {
        key: keyFilter.trim() || undefined,
        cursor: opts.reset ? undefined : cursor || undefined,
        limit: 100,
      };
      const res = await fetch('/api/license-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) throw new Error('Request failed');

      const next = opts.reset ? data.items : [...items, ...data.items];
      setItems(next);
      setCursor(data.cursor);
      setListComplete(data.list_complete);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      show(`Failed to load logs: ${msg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">License Logs</h1>
          <p className="mt-1 text-sm text-gray-500">Activations, validations, revocations, and heartbeats (Cloudflare KV).</p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <button
            onClick={() => fetchLogs({ reset: true })}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">License Key</label>
            <div className="flex items-center gap-2">
              <input
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                placeholder="NEO-XXXX-XXXX-XXXX (optional)"
                className="w-full px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => fetchLogs({ reset: true })}
                className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Event</label>
            <div className="relative">
              <Filter className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value as typeof eventFilter)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="activate">activate</option>
                <option value="validate">validate</option>
                <option value="revoke">revoke</option>
                <option value="heartbeat">heartbeat</option>
                <option value="subvendo">subvendo</option>
                <option value="other">other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full px-3 py-2 border border-gray-300 text-sm rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="ok">ok</option>
              <option value="active">active</option>
              <option value="used">used</option>
              <option value="revoked">revoked</option>
              <option value="expired">expired</option>
              <option value="denied">denied</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="h-[520px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No logs found.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filtered.map((it) => {
                const ts = parseLogTs(it);
                return (
                  <li key={it.name} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold rounded-full bg-gray-100 text-gray-800 px-2 py-0.5">
                            {it.record.event || 'event'}
                          </span>
                          {it.record.status && (
                            <span className="text-xs font-semibold rounded-full bg-blue-100 text-blue-800 px-2 py-0.5">
                              {it.record.status}
                            </span>
                          )}
                          {it.record.key && (
                            <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">
                              {it.record.key}
                            </span>
                          )}
                          {it.record.system_serial && (
                            <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded">
                              {it.record.system_serial}
                            </span>
                          )}
                          {it.record.device_model && (
                            <span className="text-xs text-gray-600">{it.record.device_model}</span>
                          )}
                        </div>
                        {it.record.message && (
                          <div className="mt-1 text-sm text-gray-600 break-words">{it.record.message}</div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        {ts ? ts.toLocaleString() : it.record.ts || 'N/A'}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Showing {filtered.length} / {items.length}
          </div>
          <button
            onClick={() => fetchLogs({ reset: false })}
            disabled={loading || listComplete || !cursor}
            className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Load more
          </button>
        </div>
      </div>
    </div>
  );
}
