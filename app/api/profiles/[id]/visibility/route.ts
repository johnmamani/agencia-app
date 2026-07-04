import { NextResponse } from "next/server";

import { setProfileVisibility } from "@/backend/store/profile-store";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { isVisible?: boolean };

    if (typeof body.isVisible !== "boolean") {
      return NextResponse.json({ error: "isVisible debe ser boolean." }, { status: 400 });
    }

    const profile = await setProfileVisibility(id, body.isVisible);
    return NextResponse.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar visibilidad.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
