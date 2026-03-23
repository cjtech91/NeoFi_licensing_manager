type Env = {
  LICENSE_KV: KVNamespace;
};

type LicenseLogRecord = {
  event?: string;
  status?: string;
  key?: string;
  system_serial?: string;
  device_model?: string;
  message?: string | null;
  ts?: string;
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

function normalizeLimit(n: unknown) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(1, Math.min(200, Math.floor(v)));
}

function safeString(v: unknown) {
  return typeof v === 'string' ? v : '';
}

async function readLog(env: Env, name: string): Promise<LicenseLogRecord | null> {
  const raw = await env.LICENSE_KV.get(name);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LicenseLogRecord;
  } catch {
    return null;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as {
    key?: unknown;
    cursor?: unknown;
    limit?: unknown;
  };

  const key = safeString(body.key).trim();
  const cursor = safeString(body.cursor).trim();
  const limit = normalizeLimit(body.limit);

  const prefix = key ? `log:${key}:` : 'log:';
  const listed = await env.LICENSE_KV.list({ prefix, cursor: cursor || undefined, limit });

  const names = listed.keys.map((k) => k.name);
  names.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

  const itemsRaw = await Promise.all(names.map(async (name) => ({ name, record: await readLog(env, name) })));
  const items = itemsRaw
    .filter((x) => x.record)
    .map((x) => ({ name: x.name, record: x.record as LicenseLogRecord }));

  return json({
    ok: true,
    prefix,
    cursor: listed.cursor || null,
    list_complete: listed.list_complete,
    items,
  });
};
