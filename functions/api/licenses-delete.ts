import { requireAdmin } from './_require-admin';

type Env = {
  ADMIN_TOKEN: string;
  LICENSE_DB: D1Database;
  LICENSE_KV?: KVNamespace;
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

async function deleteKv(env: Env, key: string) {
  if (!env.LICENSE_KV) return;
  await Promise.all([env.LICENSE_KV.delete(`lic:${key}`), env.LICENSE_KV.delete(`license:${key}`)]);
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const body = (await request.json().catch(() => ({}))) as { keys?: unknown };
  const keys = Array.isArray(body.keys) ? body.keys.map((k) => String(k || '').trim()).filter(Boolean) : [];
  if (keys.length === 0) return json({ ok: false, error: 'missing_keys' }, 400);

  const placeholders = keys.map(() => '?').join(',');
  await env.LICENSE_DB.prepare(`DELETE FROM licenses WHERE license_key IN (${placeholders})`).bind(...keys).run();

  await Promise.all(keys.map((k) => deleteKv(env, k)));

  return json({ ok: true, deleted: keys.length });
};
