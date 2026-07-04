import type { Rating, RatingInput, RatingSummary } from "@/shared/rating";

const DB_NAME = "agencia-aurora-ratings-db";
const STORE_NAME = "ratings";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("byProfile", "profileId", { unique: false });
        store.createIndex("byProfileClient", ["profileId", "clientEmail"], { unique: true });
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("No se pudo abrir IndexedDB para calificaciones."));
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertStars(stars: number): void {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error("La calificacion debe ser un entero entre 1 y 5.");
  }
}

export async function upsertRating(input: RatingInput): Promise<Rating> {
  assertStars(input.stars);

  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(input.clientEmail);

  const { database, transaction, store } = await getStore("readwrite");
  const profileClientIndex = store.index("byProfileClient");
  const existing = await requestResult(profileClientIndex.get([input.profileId, normalizedEmail]));

  const rating: Rating = existing
    ? {
        ...(existing as Rating),
        stars: input.stars,
        clientName: input.clientName.trim() || "Cliente",
        updatedAt: now,
      }
    : {
        id: crypto.randomUUID(),
        profileId: input.profileId,
        clientEmail: normalizedEmail,
        clientName: input.clientName.trim() || "Cliente",
        stars: input.stars,
        createdAt: now,
        updatedAt: now,
      };

  await requestResult(store.put(rating));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudo guardar la calificacion."));
    };
  });

  return rating;
}

export async function listRatingsByProfile(profileId: string): Promise<Rating[]> {
  const { database, transaction, store } = await getStore("readonly");
  const index = store.index("byProfile");
  const ratings = await requestResult(index.getAll(profileId));

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("No se pudieron listar las calificaciones."));
    };
  });

  return (ratings as Rating[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRatingSummary(profileId: string): Promise<RatingSummary> {
  const ratings = await listRatingsByProfile(profileId);

  const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  if (ratings.length === 0) {
    return {
      average: 0,
      total: 0,
      counts,
    };
  }

  let totalStars = 0;
  for (const rating of ratings) {
    totalStars += rating.stars;
    counts[rating.stars as 1 | 2 | 3 | 4 | 5] += 1;
  }

  return {
    average: Number((totalStars / ratings.length).toFixed(1)),
    total: ratings.length,
    counts,
  };
}
