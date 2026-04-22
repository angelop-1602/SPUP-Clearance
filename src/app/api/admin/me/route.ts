import { NextResponse } from "next/server";

import { jsonError, requireAdmin } from "@/lib/api/admin";

export async function GET() {
  try {
    const user = await requireAdmin();
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
