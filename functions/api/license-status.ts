type Env = {
  LICENSE_KV: KVNamespace;
};

type LicenseRecord = {
  status?: string;
  bound_serial?: string;
  activated_at?: number;
  updated_at?: number;
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
  const k1 = `lic:${key}`;
  const k2 = `license:${key}`;
  const raw1 = await env.LICENSE_KV.get(k1);
  if (raw1) return JSON.parse(raw1) as LicenseRecord;
  const raw2 = await env.LICENSE_KV.get(k2);
  if (raw2) return JSON.parse(raw2) as LicenseRecord;
  return null;
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
