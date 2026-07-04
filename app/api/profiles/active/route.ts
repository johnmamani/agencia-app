import { NextResponse } from "next/server";

import { getActiveProfile } from "@/backend/store/profile-store";

export async function GET() {
  const profile = await getActiveProfile();

  if (!profile) {
    return NextResponse.json({ error: "No hay perfil visible." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
