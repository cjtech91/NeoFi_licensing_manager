import { createClient } from 'jsr:@supabase/supabase-js@2';

type LicenseRow = {
  id: string;
  key: string;
  status: 'active' | 'used' | 'revoked';
  type: 'lifetime' | 'subscription' | 'trial';
  machine_id: string | null;
  hardware_id: string | null;
  system_serial: string | null;
  hwid: string | null;
  created_by: string | null;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type ValidateRequest = {
  key: string;
  system_serial?: string;
  hwid?: string;
  device_model?: string;
};

type ValidateResponse = {
  allowed: boolean;
  status: 'active' | 'used' | 'revoked' | 'not_found' | 'expired' | 'mismatch';
  message: string;
  license?: {
    key: string;
    status: 'active' | 'used' | 'revoked' | 'trial' | 'lifetime' | 'subscription';
    hardware_id: string | null;
    hwid: string | null;
    system_serial: string | null;
    activated_at: string | null;
    expires_at: string | null;
  };
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
    const deviceId = body.system_serial;

    if (!deviceId) {
      return json({ allowed: false, status: 'not_found', message: 'Missing system_serial' }, 400);
    }

    let lic: LicenseRow | null = null;
    let error = null;

    // Scenario A: Key is provided (Activation or explicit validation)
    if (body.key) {
      const result = await supabase
        .from<LicenseRow>('licenses')
        .select('*')
        .eq('key', body.key)
        .single();
      lic = result.data;
      error = result.error;
    } 
    // Scenario B: No key provided, restore/validate by system_serial
    else {
      const result = await supabase
        .from<LicenseRow>('licenses')
        .select('*')
        .eq('system_serial', deviceId)
        .in('status', ['active', 'used'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      lic = result.data;
      error = result.error;
    }

    if (error || !lic) {
      return json({ allowed: false, status: 'not_found', message: 'License not found' }, 404);
    }

    // Expiration check
    if (lic.expires_at && new Date(lic.expires_at).getTime() < Date.now()) {
      await logValidation(supabase, lic.id, deviceId, false, 'expired', 'License is expired', body.device_model, req);
      return json({ allowed: false, status: 'expired', message: 'License is expired', license: toPublic(lic) }, 403);
    }

    // Revocation check
    if (lic.status === 'revoked') {
      await logValidation(supabase, lic.id, deviceId, false, 'revoked', 'License revoked', body.device_model, req);
      return json({ allowed: false, status: 'revoked', message: 'License revoked', license: toPublic(lic) }, 403);
    }

    const existingDeviceId = lic.system_serial;
    const hasBinding = !!existingDeviceId;
    if (hasBinding && existingDeviceId !== deviceId) {
      await logValidation(supabase, lic.id, deviceId, false, 'mismatch', 'License bound to a different device', body.device_model, req);
      return json({ allowed: false, status: 'mismatch', message: 'License bound to a different device', license: toPublic(lic) }, 409);
    }

    // First activation path: bind deviceId
    if (!hasBinding && (lic.status === 'active' || lic.status === 'used')) {
      const { data: updated, error: updErr } = await supabase
        .from<LicenseRow>('licenses')
        .update({ 
          system_serial: deviceId,
          status: 'used',
          activated_at: lic.activated_at || new Date().toISOString()
        })
        .eq('id', lic.id)
        .select()
        .single();

      if (updErr?.code === '23505') {
        await logValidation(supabase, lic.id, deviceId, false, 'mismatch', 'Device ID already bound to another license', body.device_model, req);
        return json({ allowed: false, status: 'mismatch', message: 'Device ID already bound to another license', license: toPublic(lic) }, 409);
      }

      if (updErr || !updated) {
        await logValidation(supabase, lic.id, deviceId, false, 'not_found', 'Failed to bind device', body.device_model, req);
        return json({ allowed: false, status: 'not_found', message: 'Failed to bind device', license: toPublic(lic) }, 500);
      }

      await logValidation(supabase, updated.id, deviceId, true, updated.status, 'License activated and bound to device', body.device_model, req);
      try {
        const { error: actErr } = await supabase.from('activations').insert({
          license_id: updated.id,
          license_key: updated.key,
          system_serial: deviceId,
          device_model: body.device_model || null,
          status: updated.status,
          activated_at: updated.activated_at,
          message: 'Activated and bound to device'
        });
        if (actErr) {
          await logValidation(supabase, updated.id, deviceId, true, updated.status, `Activation log insert failed: ${actErr.message}`, body.device_model, req);
        }
      } catch {
        await logValidation(supabase, updated.id, deviceId, true, updated.status, 'Activation log insert failed: unexpected error', body.device_model, req);
      }
      return json({ allowed: true, status: updated.status, message: 'License activated and bound to device', license: toPublic(updated) });
    }

    // Success path (Already bound or recovered via serial)
    await logValidation(supabase, lic.id, deviceId, true, lic.status, 'License valid', body.device_model, req);
    return json({ allowed: true, status: lic.status, message: 'License valid', license: toPublic(lic) });
  } catch {
    return json({ allowed: false, status: 'not_found', message: 'Unexpected error' }, 500);
  }
}

function toPublic(lic: LicenseRow): ValidateResponse['license'] {
  const deviceId = lic.system_serial;
  return {
    key: lic.key,
    status: lic.status,
    hardware_id: null,
    hwid: null,
    system_serial: deviceId,
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
  system_serial: string,
  allowed: boolean,
  status: string,
  message: string,
  device_model: string | undefined,
  req: Request
) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  const { error } = await supabase.from('license_validations').insert({
    license_id,
    system_serial,
    allowed,
    status,
    message,
    device_model: device_model || null,
    ip,
  });
  if (error) {
    return;
  }
}
