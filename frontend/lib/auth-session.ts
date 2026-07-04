import type { Client } from "@/shared/client";

export const SESSION_KEY = "agencia-aurora-client-session";

export type UserRole = "client" | "admin";

export type AuthSession = {
  email: string;
  fullName: string;
  role: UserRole;
};

export const ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() || "admin@agenciaaurora.com";
export const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD?.trim() || "Admin1234";
export const DEMO_ADMIN_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL?.trim().toLowerCase() || "demo@agenciaaurora.com";
export const DEMO_ADMIN_PASSWORD = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD?.trim() || "Demo1234";
const ADMIN_FULL_NAME = "Administrador Agencia";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminCredential(email: string, password: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = password.trim();

  const isPrimaryAdmin =
    normalizedEmail === normalizeEmail(ADMIN_EMAIL) && normalizedPassword === ADMIN_PASSWORD;
  const isDemoAdmin =
    normalizedEmail === normalizeEmail(DEMO_ADMIN_EMAIL) && normalizedPassword === DEMO_ADMIN_PASSWORD;

  return isPrimaryAdmin || isDemoAdmin;
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

export function saveAdminSession(email?: string): AuthSession {
  const normalizedEmail = email ? normalizeEmail(email) : ADMIN_EMAIL;
  const session: AuthSession = {
    email: normalizedEmail,
    fullName: ADMIN_FULL_NAME,
    role: "admin",
  };

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}
