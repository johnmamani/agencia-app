import type { Client } from "@/shared/client";

export const SESSION_KEY = "agencia-aurora-client-session";

export type UserRole = "client" | "admin";

export type AuthSession = {
  email: string;
  fullName: string;
  role: UserRole;
};

const ADMIN_EMAIL = "admin@agenciaaurora.com";
const ADMIN_PASSWORD = "Admin1234";
const ADMIN_FULL_NAME = "Administrador Agencia";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminCredential(email: string, password: string): boolean {
  return normalizeEmail(email) === ADMIN_EMAIL && password.trim() === ADMIN_PASSWORD;
}

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;

    if (typeof parsed.email !== "string" || typeof parsed.fullName !== "string") {
      return null;
    }

    return {
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role === "admin" ? "admin" : "client",
    };
  } catch {
    return null;
  }
}

export function saveClientSession(client: Client): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      email: normalizeEmail(client.email),
      fullName: client.fullName,
      role: "client",
    } satisfies AuthSession),
  );
}

export function saveAdminSession(): AuthSession {
  const session: AuthSession = {
    email: ADMIN_EMAIL,
    fullName: ADMIN_FULL_NAME,
    role: "admin",
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
