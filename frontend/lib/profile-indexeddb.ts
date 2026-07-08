import type { CreateProfileInput, Profile, UpdateProfileInput } from "@/shared/profile";

const DB_NAME = "agencia-aurora-db";
const STORE_NAME = "profiles";
const DB_VERSION = 1;

const DEFAULT_PHOTOS = [
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517365830460-955ce3ccd263?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1506869640319-fe1a24fd76dc?auto=format&fit=crop&w=1200&q=80",
];

function normalizePhotos(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeVideos(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function assertMediaRules(photos: string[]): void {
  if (photos.length < 1) {
    throw new Error("Cada perfil necesita al menos 1 foto.");
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

function getInitialProfile(): Profile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    displayName: "Aurora",
    age: 22,
    nationality: "Peruana",
    schedule: "Disponible de 13:00 a 20:00",
    serviceDetails: "Acompanamiento legal para cenas, eventos privados y actividades sociales.",
    treatmentStyle: "Trato cordial, puntual y con protocolo profesional.",
    costText: "Desde S/ 450 por bloque de 2 horas.",
    locationText: "Miraflores, San Isidro, Barranco.",
    serviceTypeText: "Night lounge, rooftop, after office VIP.",
    whatsappNumber: "51999999999",
    photos: DEFAULT_PHOTOS,
    videos: [],
    isVisible: true,
    isLanding: true,
    createdAt: now,
    updatedAt: now,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function getStore(mode: IDBTransactionMode) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);
  return { database, transaction, store };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function ensureSeeded(): Promise<void> {
  const { database, transaction, store } = await getStore("readwrite");
  const count = await requestResult(store.count());

  if (count === 0) {
    await requestResult(store.add(getInitialProfile()));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo inicializar IndexedDB."));
    };
  });
}

export async function listProfiles(): Promise<Profile[]> {
  await ensureSeeded();
  const { database, transaction, store } = await getStore("readonly");
  const profiles = await requestResult(store.getAll()) as Profile[];

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudieron listar los perfiles."));
    };
  });

  return profiles
    .map((profile) => ({
      ...profile,
      age: typeof profile.age === "number" ? profile.age : 18,
      nationality: profile.nationality?.trim() ? profile.nationality : "Peruana",
      schedule:
        typeof profile.schedule === "string" && profile.schedule.trim()
          ? profile.schedule
          : "Disponible de 13:00 a 20:00",
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getActiveProfile(): Promise<Profile | null> {
  const profiles = await listProfiles();
  return profiles.find((profile) => profile.isLanding) ?? null;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const photos = normalizePhotos(input.photos);
  const videos = normalizeVideos(input.videos);
  assertMediaRules(photos);

  const now = new Date().toISOString();
  const profile: Profile = {
    id: crypto.randomUUID(),
    displayName: input.displayName.trim(),
    age: normalizeAge(input.age),
    nationality: normalizeNationality(input.nationality),
    schedule: input.schedule?.trim() || "Disponible de 13:00 a 20:00",
    serviceDetails: input.serviceDetails.trim(),
    treatmentStyle: input.treatmentStyle.trim(),
    costText: input.costText.trim(),
    locationText: input.locationText.trim(),
    serviceTypeText: input.serviceTypeText.trim(),
    whatsappNumber: input.whatsappNumber.replace(/\D/g, ""),
    photos,
    videos,
    isVisible: Boolean(input.isVisible),
    isLanding: Boolean(input.isLanding),
    createdAt: now,
    updatedAt: now,
  };

  const { database, transaction, store } = await getStore("readwrite");
  const existing = (await requestResult(store.getAll())) as Profile[];

  if (profile.isLanding) {
    for (const item of existing) {
      item.isLanding = false;
      item.updatedAt = now;
      await requestResult(store.put(item));
    }
  }

  await requestResult(store.put(profile));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo guardar el perfil."));
    };
  });

  return profile;
}

export async function updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
  const profiles = await listProfiles();
  const profile = profiles.find((item) => item.id === id);

  if (!profile) {
    throw new Error("Perfil no encontrado.");
  }

  const photos = input.photos ? normalizePhotos(input.photos) : profile.photos;
  const videos = input.videos ? normalizeVideos(input.videos) : profile.videos;

  if (input.photos || input.videos) {
    assertMediaRules(photos);
  }

  const updated: Profile = {
    ...profile,
    ...input,
    displayName: input.displayName?.trim() ?? profile.displayName,
    age: input.age !== undefined ? normalizeAge(input.age) : profile.age,
    nationality: input.nationality !== undefined ? normalizeNationality(input.nationality) : profile.nationality,
    schedule: input.schedule?.trim() || profile.schedule,
    serviceDetails: input.serviceDetails?.trim() ?? profile.serviceDetails,
    treatmentStyle: input.treatmentStyle?.trim() ?? profile.treatmentStyle,
    costText: input.costText?.trim() ?? profile.costText,
    locationText: input.locationText?.trim() ?? profile.locationText,
    serviceTypeText: input.serviceTypeText?.trim() ?? profile.serviceTypeText,
    whatsappNumber: input.whatsappNumber?.replace(/\D/g, "") ?? profile.whatsappNumber,
    photos,
    videos,
    updatedAt: new Date().toISOString(),
  };

  const { database, transaction, store } = await getStore("readwrite");
  await requestResult(store.put(updated));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo actualizar el perfil."));
    };
  });

  return updated;
}

export async function setProfileVisibility(id: string, isVisible: boolean): Promise<Profile> {
  const profiles = await listProfiles();
  const target = profiles.find((profile) => profile.id === id);

  if (!target) {
    throw new Error("Perfil no encontrado.");
  }

  const now = new Date().toISOString();
  const updatedProfiles = profiles.map((profile) => ({
    ...profile,
    isVisible: profile.id === id ? isVisible : profile.isVisible,
    updatedAt: profile.id === id ? now : profile.updatedAt,
  }));

  const { database, transaction, store } = await getStore("readwrite");

  for (const profile of updatedProfiles) {
    await requestResult(store.put(profile));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo cambiar la visibilidad."));
    };
  });

  return updatedProfiles.find((profile) => profile.id === id) ?? target;
}

export async function setProfileLanding(id: string): Promise<void> {
  const profiles = await listProfiles();
  const now = new Date().toISOString();
  const updated = profiles.map((profile) => ({
    ...profile,
    isLanding: profile.id === id,
    updatedAt: profile.id === id ? now : profile.updatedAt,
  }));

  const { database, transaction, store } = await getStore("readwrite");
  for (const profile of updated) {
    await requestResult(store.put(profile));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("No se pudo actualizar landing.")); };
  });
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = await listProfiles();
  const remainingProfiles = profiles.filter((profile) => profile.id !== id);

  const { database, transaction, store } = await getStore("readwrite");
  await requestResult(store.clear());

  for (const profile of remainingProfiles) {
    await requestResult(store.put(profile));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo eliminar el perfil."));
    };
  });
}

export async function exportProfiles(): Promise<Profile[]> {
  return listProfiles();
}

export async function importProfiles(profiles: Profile[]): Promise<void> {
  const { database, transaction, store } = await getStore("readwrite");

  await requestResult(store.clear());

  for (const profile of profiles) {
    await requestResult(store.put(profile));
  }

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo importar la base."));
    };
  });
}

export async function resetProfiles(): Promise<void> {
  await importProfiles([getInitialProfile()]);
}
