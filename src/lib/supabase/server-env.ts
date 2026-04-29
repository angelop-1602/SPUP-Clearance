import "server-only";

export function getSupabaseServerAuthEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Missing Supabase auth environment variables.");
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  };
}

export function getSupabaseAdminEnv() {
  const { supabaseUrl } = getSupabaseServerAuthEnv();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing Supabase service-role environment variable.");
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}
