import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

type Machine = {
  system_serial: string;
  device_model: string | null;
  last_seen_at: number;
  metadata: unknown;
};

export default function Machines() {
  const { getAuthHeader } = useAuth();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMachines = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/machines-list', { headers: { ...getAuthHeader() } });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; machines?: Machine[] };
      if (!res.ok || data.ok !== true) throw new Error('Failed to load machines');
      setMachines(data.machines || []);
    } catch {
      setMachines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines();
    const id = window.setInterval(fetchMachines, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Machine Status</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : machines.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <WifiOff className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No machines</h3>
          <p className="mt-1 text-sm text-gray-500">No heartbeat records found yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {machines.map((m) => {
            const online = m.last_seen_at > 0 && Date.now() - m.last_seen_at < 2 * 60 * 1000;
            return (
              <div key={m.system_serial} className="bg-white rounded-lg shadow overflow-hidden border">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={online ? 'p-2 rounded-lg bg-green-100' : 'p-2 rounded-lg bg-gray-100'}>
                        {online ? <Wifi className="h-6 w-6 text-green-600" /> : <WifiOff className="h-6 w-6 text-gray-600" />}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">{m.device_model || 'NeoFi Device'}</h3>
                        <div className="text-xs text-gray-500 font-mono">{m.system_serial}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Status</span>
                      <span className={online ? 'font-medium text-green-600' : 'font-medium text-gray-600'}>
                        {online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">Last Seen</span>
                      <span className="text-gray-900">{m.last_seen_at ? format(new Date(m.last_seen_at), 'MMM d, HH:mm') : 'Never'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
