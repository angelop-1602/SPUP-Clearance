"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/supabase/public-env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();
  browserClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
