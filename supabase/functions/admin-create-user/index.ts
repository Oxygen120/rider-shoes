import { errorResponse, isRecord, json, optionsResponse, parseJson } from '../_shared/http.ts';
import { createAdminClient, AuthenticationError, requireUser } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return optionsResponse();
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let callerId: string;
  try {
    callerId = (await requireUser(request)).user.id;
  } catch (error) {
    if (error instanceof AuthenticationError) return json({ error: error.message }, error.status);
    return errorResponse(error);
  }

  try {
    const body = await parseJson(request);
    if (!isRecord(body) || typeof body.email !== 'string' || typeof body.password !== 'string') {
      return json({ error: 'email and password are required' }, 400);
    }
    const email = body.email.trim().toLowerCase();
    const password = body.password;
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const roleCodes = Array.isArray(body.roleCodes)
      ? body.roleCodes.filter((value): value is string => typeof value === 'string').map((value) => value.trim().toLowerCase()).filter(Boolean)
      : ['staff'];

    if (!email || password.length < 8) return json({ error: 'Use a valid email and a password of at least 8 characters.' }, 400);
    if (roleCodes.length === 0) return json({ error: 'At least one role is required.' }, 400);

    const admin = createAdminClient();
    const { data: callerPermission } = await admin
      .from('profile_roles')
      .select('roles!inner(code, is_active, role_permissions!inner(permissions!inner(code)))')
      .eq('profile_id', callerId)
      .eq('roles.is_active', true)
      .eq('roles.role_permissions.permissions.code', 'roles.manage')
      .limit(1);
    if (!callerPermission?.length) return json({ error: 'Role management permission required' }, 403);

    const { data: roleRows, error: roleError } = await admin
      .from('roles')
      .select('id, code, is_active')
      .in('code', roleCodes);
    if (roleError) throw roleError;
    if (!roleRows || roleRows.length !== roleCodes.length || roleRows.some((role) => !role.is_active)) {
      return json({ error: 'One or more requested roles are invalid or inactive.' }, 400);
    }

    if (roleCodes.includes('owner') && !roleCodes.includes('owner')) return json({ error: 'Invalid role request' }, 400);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || undefined, phone: phone || undefined },
    });
    if (createError || !created.user) {
      return json({ error: createError?.message || 'Unable to create user' }, 409);
    }

    const userId = created.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      email,
      full_name: fullName || null,
      phone: phone || null,
      is_active: true,
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: rolesError } = await admin.from('profile_roles').insert(
      roleRows.map((role) => ({ profile_id: userId, role_id: role.id, assigned_by: callerId })),
    );
    if (rolesError) throw rolesError;

    return json({ ok: true, user: { id: userId, email, roles: roleCodes } }, 201);
  } catch (error) {
    console.error('admin-create-user failed');
    return errorResponse(error);
  }
});
