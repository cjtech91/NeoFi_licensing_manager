import { requireAdmin } from './_require-admin';

type Env = {
  ADMIN_TOKEN: string;
  LICENSE_DB: D1Database;
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = requireAdmin(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const body = (await request.json().catch(() => ({}))) as {
    key?: unknown;
    action?: unknown;
    system_serial?: unknown;
  };
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';
  const serial = typeof body.system_serial === 'string' ? body.system_serial.trim() : '';

  if (!key || !action) return json({ ok: false, error: 'bad_request' }, 400);

  const now = Date.now();

  if (action === 'revoke') {
    await env.LICENSE_DB.prepare("UPDATE licenses SET status='revoked', updated_at=? WHERE license_key=?").bind(now, key).run();
    return json({ ok: true });
  }

  if (action === 'unbind') {
    await env.LICENSE_DB.prepare("UPDATE licenses SET status='active', bound_serial=NULL, activated_at=NULL, updated_at=? WHERE license_key=?")
      .bind(now, key)
      .run();
    return json({ ok: true });
  }

  if (action === 'bind') {
    if (!serial) return json({ ok: false, error: 'missing_serial' }, 400);
    await env.LICENSE_DB.prepare("UPDATE licenses SET status='used', bound_serial=?, activated_at=COALESCE(activated_at, ?), updated_at=? WHERE license_key=?")
      .bind(serial, now, now, key)
      .run();
    return json({ ok: true });
  }

  return json({ ok: false, error: 'unknown_action' }, 400);
};
