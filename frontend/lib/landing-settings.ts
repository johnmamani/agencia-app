const HERO_COVER_KEY = "agencia-aurora-hero-cover-image";

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readHeroCoverImage(): string | null {
  if (!hasLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(HERO_COVER_KEY);
  const value = raw?.trim() ?? "";
  return value ? value : null;
}

export function saveHeroCoverImage(value: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  const normalized = value.trim();
  if (!normalized) {
    window.localStorage.removeItem(HERO_COVER_KEY);
    return;
  }

  window.localStorage.setItem(HERO_COVER_KEY, normalized);
}

export function clearHeroCoverImage(): void {
  if (!hasLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(HERO_COVER_KEY);
}
