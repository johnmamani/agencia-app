import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CreateProfileInput, Profile, UpdateProfileInput } from "@/shared/profile";

type ProfileDb = {
  profiles: Profile[];
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const DATA_FILE = path.join(DATA_DIR, "profiles.json");

const DEFAULT_PHOTOS = [
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?auto=format&fit=crop&w=1200&q=80",
];

const DEFAULT_DB: ProfileDb = {
  profiles: [
    {
      id: randomUUID(),
      displayName: "Aurora",
      age: 22,
      nationality: "Peruana",
      schedule: "Disponible de 13:00 a 20:00",
      tagline: "Modelo anfitriona para eventos premium",
      physicalTraits: "Estilo elegante, imagen editorial, presencia social.",
      serviceDetails:
        "Acompanamiento legal para cenas, eventos privados y actividades sociales.",
      treatmentStyle: "Trato cordial, puntual y con protocolo profesional.",
      costText: "Desde S/ 450 por bloque de 2 horas.",
      locationText: "Miraflores, San Isidro, Barranco.",
      serviceTypeText: "Night lounge, rooftop, after office VIP.",
      whatsappNumber: "51999999999",
      photos: DEFAULT_PHOTOS,
      videos: ["https://samplelib.com/lib/preview/mp4/sample-5s.mp4"],
      isVisible: true,
      isLanding: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

async function ensureDbFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
}

async function readDb(): Promise<ProfileDb> {
  await ensureDbFile();
  const raw = await readFile(DATA_FILE, "utf8");
  return JSON.parse(raw) as ProfileDb;
}

async function writeDb(db: ProfileDb): Promise<void> {
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function cleanLines(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function assertMediaRules(photos: string[], videos: string[]): void {
  if (photos.length < 5 || photos.length > 10) {
    throw new Error("Cada perfil necesita entre 5 y 10 fotos.");
  }

  if (videos.length < 1 || videos.length > 2) {
    throw new Error("Cada perfil necesita entre 1 y 2 videos.");
  }
}

function normalizeAge(age: number): number {
  const numeric = Number(age);
  if (!Number.isFinite(numeric)) {
    throw new Error("La edad no es valida.");
  }

  const rounded = Math.floor(numeric);
  if (rounded < 18 || rounded > 65) {
    throw new Error("La edad debe estar entre 18 y 65.");
  }

  return rounded;
}

function normalizeNationality(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("La nacionalidad es obligatoria.");
  }

  return normalized;
}

function mapCreateInput(input: CreateProfileInput): CreateProfileInput {
  const photos = cleanLines(input.photos);
  const videos = cleanLines(input.videos);

  assertMediaRules(photos, videos);

  return {
    ...input,
    displayName: input.displayName.trim(),
    age: normalizeAge(input.age),
    nationality: normalizeNationality(input.nationality),
    schedule: input.schedule?.trim() || "Disponible de 13:00 a 20:00",
    tagline: input.tagline.trim(),
    physicalTraits: input.physicalTraits.trim(),
    serviceDetails: input.serviceDetails.trim(),
    treatmentStyle: input.treatmentStyle.trim(),
    costText: input.costText.trim(),
    locationText: input.locationText.trim(),
    serviceTypeText: input.serviceTypeText.trim(),
    whatsappNumber: input.whatsappNumber.replace(/\D/g, ""),
    photos,
    videos,
  };
}

function mapUpdateInput(input: UpdateProfileInput): UpdateProfileInput {
  const output: UpdateProfileInput = { ...input };

  if (input.age !== undefined) {
    output.age = normalizeAge(input.age);
  }

  if (input.nationality !== undefined) {
    output.nationality = normalizeNationality(input.nationality);
  }

  if (input.photos) {
    output.photos = cleanLines(input.photos);
  }

  if (input.videos) {
    output.videos = cleanLines(input.videos);
  }

  if (input.whatsappNumber) {
    output.whatsappNumber = input.whatsappNumber.replace(/\D/g, "");
  }

  return output;
}

export async function listProfiles(): Promise<Profile[]> {
  const db = await readDb();
  return [...db.profiles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const db = await readDb();
  return db.profiles.find((profile) => profile.id === id) ?? null;
}

export async function getActiveProfile(): Promise<Profile | null> {
  const db = await readDb();
  return db.profiles.find((profile) => profile.isVisible) ?? null;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const db = await readDb();
  const normalized = mapCreateInput(input);
  const now = new Date().toISOString();

  const newProfile: Profile = {
    id: randomUUID(),
    ...normalized,
    schedule: normalized.schedule ?? "Disponible de 13:00 a 20:00",
    isVisible: false,
    isLanding: normalized.isLanding ?? false,
    createdAt: now,
    updatedAt: now,
  };

  db.profiles.push(newProfile);

  if (normalized.isVisible) {
    for (const profile of db.profiles) {
      profile.isVisible = profile.id === newProfile.id;
      profile.updatedAt = now;
    }
  }

  await writeDb(db);
  return newProfile;
}

export async function updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
  const db = await readDb();
  const profile = db.profiles.find((item) => item.id === id);

  if (!profile) {
    throw new Error("Perfil no encontrado.");
  }

  const normalized = mapUpdateInput(input);

  if (normalized.photos || normalized.videos) {
    const photos = normalized.photos ?? profile.photos;
    const videos = normalized.videos ?? profile.videos;
    assertMediaRules(photos, videos);
  }

  Object.assign(profile, normalized, { updatedAt: new Date().toISOString() });

  await writeDb(db);
  return profile;
}

export async function setProfileVisibility(id: string, isVisible: boolean): Promise<Profile> {
  const db = await readDb();
  const target = db.profiles.find((profile) => profile.id === id);

  if (!target) {
    throw new Error("Perfil no encontrado.");
  }

  const now = new Date().toISOString();

  if (isVisible) {
    for (const profile of db.profiles) {
      profile.isVisible = profile.id === id;
      profile.updatedAt = now;
    }
  } else {
    target.isVisible = false;
    target.updatedAt = now;
  }

  await writeDb(db);
  return target;
}
