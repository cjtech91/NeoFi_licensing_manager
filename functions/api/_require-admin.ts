type Env = {
  ADMIN_TOKEN: string;
};

export function requireAdmin(request: Request, env: Env): { ok: true } | { ok: false; status: number; error: string } {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return { ok: false, status: 401, error: 'missing_bearer' };
  const token = auth.slice(7);
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return { ok: false, status: 401, error: 'unauthorized' };
  return { ok: true };
}
