import { NextResponse } from "next/server";

import { createProfile, listProfiles } from "@/backend/store/profile-store";
import type { CreateProfileInput } from "@/shared/profile";

export async function GET() {
  const profiles = await listProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateProfileInput;
    const profile = await createProfile(payload);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el perfil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
