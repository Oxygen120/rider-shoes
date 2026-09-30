import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { requireEnv } from './env.ts';

export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export function createUserClient(request: Request): SupabaseClient {
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    throw new AuthenticationError('A bearer token is required');
  }

  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

export async function requireUser(request: Request): Promise<{
  client: SupabaseClient;
  user: User;
}> {
  const client = createUserClient(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new AuthenticationError('Invalid or expired bearer token');
  }
  return { client, user: data.user };
}
