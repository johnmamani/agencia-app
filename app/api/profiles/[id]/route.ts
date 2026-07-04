import { NextResponse } from "next/server";

import { getProfileById, updateProfile } from "@/backend/store/profile-store";
import type { UpdateProfileInput } from "@/shared/profile";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const profile = await getProfileById(id);

  if (!profile) {
    return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as UpdateProfileInput;
    const profile = await updateProfile(id, payload);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el perfil.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
