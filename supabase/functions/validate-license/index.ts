import { createClient } from 'jsr:@supabase/supabase-js@2';

type LicenseRow = {
  id: string;
  key: string;
  status: 'active' | 'used' | 'revoked';
  type: 'lifetime' | 'subscription' | 'trial';
  machine_id: string | null;
  hardware_id: string | null;
  created_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type ValidateRequest = {
  key: string;
  hwid: string;
  device_model?: string;
};

type ValidateResponse = {
  allowed: boolean;
  status: 'active' | 'used' | 'revoked' | 'not_found' | 'expired' | 'mismatch';
  message: string;
  license?: Pick<LicenseRow, 'key' | 'status' | 'hardware_id' | 'activated_at' | 'expires_at'>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, key);

  try {
    const body = (await req.json()) as ValidateRequest;
    if (!body?.key || !body?.hwid) {
      return json({ allowed: false, status: 'not_found', message: 'Missing key or hwid' }, 400);
    }

    const { data: lic, error } = await supabase
      .from<LicenseRow>('licenses')
      .select('*')
      .eq('key', body.key)
      .single();

    if (error || !lic) {
      return json({ allowed: false, status: 'not_found', message: 'License not found' }, 404);
    }

    // Expiration check
    if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
      await logValidation(supabase, lic.id, body.hwid, false, 'expired', 'License is expired', body.device_model, req);
      return json({ allowed: false, status: 'expired', message: 'License is expired', license: toPublic(lic) }, 403);
    }

    // Revocation check
    if (lic.status === 'revoked') {
      await logValidation(supabase, lic.id, body.hwid, false, 'revoked', 'License is revoked', body.device_model, req);
      return json({ allowed: false, status: 'revoked', message: 'License is revoked', license: toPublic(lic) }, 403);
    }

    // Mismatch check
    if (lic.hardware_id && lic.hardware_id !== body.hwid) {
      await logValidation(supabase, lic.id, body.hwid, false, 'mismatch', 'License bound to a different device', body.device_model, req);
      return json({ allowed: false, status: 'mismatch', message: 'License bound to a different device', license: toPublic(lic) }, 409);
    }

    // First activation path: bind HWID, DB trigger marks used + activated_at
    if (!lic.hardware_id && lic.status === 'active') {
      const { data: updated, error: updErr } = await supabase
        .from<LicenseRow>('licenses')
        .update({ hardware_id: body.hwid })
        .eq('id', lic.id)
        .select()
        .single();

      if (updErr || !updated) {
        await logValidation(supabase, lic.id, body.hwid, false, 'not_found', 'Failed to bind hardware', body.device_model, req);
        return json({ allowed: false, status: 'not_found', message: 'Failed to bind hardware', license: toPublic(lic) }, 500);
      }

      await logValidation(supabase, updated.id, body.hwid, true, updated.status, 'License activated and bound to device', body.device_model, req);
      return json({ allowed: true, status: updated.status, message: 'License activated and bound to device', license: toPublic(updated) });
    }

    await logValidation(supabase, lic.id, body.hwid, true, lic.status, 'License valid', body.device_model, req);
    return json({ allowed: true, status: lic.status, message: 'License valid', license: toPublic(lic) });
  } catch (e) {
    return json({ allowed: false, status: 'not_found', message: 'Unexpected error' }, 500);
  }
}

function toPublic(lic: LicenseRow): Pick<LicenseRow, 'key' | 'status' | 'hardware_id' | 'activated_at' | 'expires_at'> {
  return {
    key: lic.key,
    status: lic.status,
    hardware_id: lic.hardware_id,
    activated_at: lic.activated_at,
    expires_at: lic.expires_at,
  };
}

function json(data: ValidateResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function logValidation(
  supabase: ReturnType<typeof createClient>,
  license_id: string,
  hwid: string,
  allowed: boolean,
  status: string,
  message: string,
  device_model: string | undefined,
  req: Request
) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  await supabase.from('license_validations').insert({
    license_id,
    hwid,
    allowed,
    status,
    message,
    device_model: device_model || null,
    ip,
  });
}
