type Env = {
  LICENSE_DB: D1Database;
  LICENSE_KV: KVNamespace;
};

type LicenseRecord = {
  status?: string;
  bound_serial?: string;
  activated_at?: number;
  updated_at?: number;
  machine_last_seen_at?: number;
  machine_device_model?: string;
  owner?: string;
  type?: string;
  expires_at?: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function getRecord(env: Env, key: string): Promise<LicenseRecord | null> {
  const row = await env.LICENSE_DB.prepare(
    'SELECT status, bound_serial, activated_at, updated_at, owner, type, expires_at FROM licenses WHERE license_key = ? LIMIT 1'
  )
    .bind(key)
    .first<{
      status: string;
      bound_serial: string | null;
      activated_at: number | null;
      updated_at: number | null;
      owner: string | null;
      type: string;
      expires_at: number | null;
    }>();

  if (!row) return null;

  const rec: LicenseRecord = {
    status: row.status,
    bound_serial: row.bound_serial,
    activated_at: row.activated_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
    owner: row.owner,
    type: row.type,
    expires_at: row.expires_at,
  };

  const serial = typeof rec.bound_serial === 'string' ? rec.bound_serial.trim() : '';
  if (serial) {
    const machineRaw = await env.LICENSE_KV.get(`machine:${serial}`);
    if (machineRaw) {
      const m = JSON.parse(machineRaw) as { last_seen_at?: unknown; device_model?: unknown };
      if (typeof m.last_seen_at === 'number') rec.machine_last_seen_at = m.last_seen_at;
      if (typeof m.device_model === 'string') rec.machine_device_model = m.device_model;
    }
  }

  return rec;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { key?: string; keys?: string[] };
  const singleKey = typeof body.key === 'string' ? body.key.trim() : '';
  const keys = Array.isArray(body.keys) ? body.keys.map((k) => String(k || '').trim()).filter(Boolean) : [];

  if (!singleKey && keys.length === 0) return json({ ok: false, error: 'missing_key' }, 400);

  if (singleKey) {
    const rec = await getRecord(env, singleKey);
    return json({ ok: true, key: singleKey, record: rec });
  }

  const out: Record<string, LicenseRecord | null> = {};
  await Promise.all(
    keys.map(async (k) => {
      out[k] = await getRecord(env, k);
    })
  );

  return json({ ok: true, records: out });
};
