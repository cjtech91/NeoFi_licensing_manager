type Env = {
  ADMIN_PASSWORD: string;
  ADMIN_TOKEN: string;
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
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!env.ADMIN_PASSWORD || !env.ADMIN_TOKEN) return json({ ok: false, error: 'server_not_configured' }, 500);
  if (!password) return json({ ok: false, error: 'missing_password' }, 400);

  if (password !== env.ADMIN_PASSWORD) return json({ ok: false, error: 'invalid_credentials' }, 401);

  return json({ ok: true, token: env.ADMIN_TOKEN, email: email || 'admin' });
};
