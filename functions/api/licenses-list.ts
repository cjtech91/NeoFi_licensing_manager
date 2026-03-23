import { requireAdmin } from './_require-admin';

type Env = {
  ADMIN_TOKEN: string;
  LICENSE_DB: D1Database;
};

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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();

  let res;
  if (q) {
    res = await env.LICENSE_DB.prepare(
      "SELECT license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at FROM licenses WHERE license_key LIKE ? OR bound_serial LIKE ? ORDER BY created_at DESC LIMIT 500"
    ).bind(`%${q}%`, `%${q}%`).all<LicenseRow>();
  } else {
    res = await env.LICENSE_DB.prepare(
      "SELECT license_key, status, owner, type, expires_at, bound_serial, activated_at, created_at, updated_at FROM licenses ORDER BY created_at DESC LIMIT 500"
    ).all<LicenseRow>();
  }

  return json({ ok: true, licenses: res.results || [] });
};
