import { requireAdmin } from './_require-admin';

type Env = {
  ADMIN_TOKEN: string;
  LICENSE_KV: KVNamespace;
};

type MachineRecord = {
  system_serial: string;
  device_model: string | null;
  last_seen_at: number;
  metadata: unknown;
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

  const listed = await env.LICENSE_KV.list({ prefix: 'machine:', limit: 200 });
  const names = listed.keys.map((k) => k.name);
  const raws = await Promise.all(names.map((n) => env.LICENSE_KV.get(n)));
  const items: MachineRecord[] = [];

  for (let i = 0; i < names.length; i++) {
    const raw = raws[i];
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { system_serial?: unknown; device_model?: unknown; last_seen_at?: unknown; metadata?: unknown };
      const systemSerial = typeof parsed.system_serial === 'string' ? parsed.system_serial : '';
      const lastSeen = typeof parsed.last_seen_at === 'number' ? parsed.last_seen_at : 0;
      items.push({
        system_serial: systemSerial || names[i].slice('machine:'.length),
        device_model: typeof parsed.device_model === 'string' ? parsed.device_model : null,
        last_seen_at: lastSeen,
        metadata: parsed.metadata ?? null,
      });
    } catch {
      continue;
    }
  }

  items.sort((a, b) => b.last_seen_at - a.last_seen_at);

  return json({ ok: true, machines: items });
};
