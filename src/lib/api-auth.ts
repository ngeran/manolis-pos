import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  role?: string;
} & Record<string, unknown>;

/** Returns the session user, or null when unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export function isAdminUser(user: SessionUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
