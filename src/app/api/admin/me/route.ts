import { NextResponse } from "next/server";

import { ApiError, jsonError, requireAdmin } from "@/lib/api/admin";

export async function GET() {
  try {
    const user = await requireAdmin();
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return NextResponse.json({ user: null });
    }

    return jsonError(error);
  }
}
