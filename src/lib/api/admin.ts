import "server-only";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, "Authentication required");
  }

  const { data: adminUser, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id,email")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    throw new ApiError(500, adminError.message);
  }

  if (!adminUser) {
    throw new ApiError(403, "This account is not authorized for admin access");
  }

  return {
    uid: data.user.id,
    email: data.user.email ?? adminUser.email,
  };
}
