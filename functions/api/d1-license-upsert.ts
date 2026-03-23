type Env = {
  LICENSE_DB: D1Database;
};

type InputLicense = {
  key: string;
  status?: string;
  owner?: string | null;
  type?: string;
  expires_at?: number | null;
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

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { licenses?: unknown };
  const arr = Array.isArray(body.licenses) ? (body.licenses as InputLicense[]) : [];
  if (arr.length === 0) return json({ ok: false, error: 'missing_licenses' }, 400);

  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];

  for (const row of arr) {
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    if (!key) continue;
    const status = typeof row.status === 'string' && row.status.trim() ? row.status.trim() : 'active';
    const owner = typeof row.owner === 'string' ? row.owner : null;
    const type = typeof row.type === 'string' && row.type.trim() ? row.type.trim() : 'PAID';
    const expiresAt = row.expires_at === null || row.expires_at === undefined ? null : toInt(row.expires_at);

    const stmt = env.LICENSE_DB.prepare(
      "INSERT INTO licenses (license_key, status, owner, type, expires_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(license_key) DO UPDATE SET status=excluded.status, owner=excluded.owner, type=excluded.type, expires_at=excluded.expires_at, updated_at=excluded.updated_at"
    ).bind(key, status, owner, type, expiresAt, now);
    stmts.push(stmt);
  }

  if (stmts.length === 0) return json({ ok: false, error: 'no_valid_keys' }, 400);

  await env.LICENSE_DB.batch(stmts);
  return json({ ok: true, upserted: stmts.length });
};
