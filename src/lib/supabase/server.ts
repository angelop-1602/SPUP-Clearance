import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseServerAuthEnv } from "@/lib/supabase/server-env";

export async function createSupabaseServerClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseServerAuthEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
