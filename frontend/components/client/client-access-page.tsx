"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authenticateClient, registerClient } from "@/frontend/lib/client-indexeddb";
import { getActiveProfile } from "@/frontend/lib/profile-indexeddb";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  clearSession,
  isAdminCredential,
  readSession,
  saveAdminSession,
  saveClientSession,
  type AuthSession,
} from "@/frontend/lib/auth-session";
import type { Profile } from "@/shared/profile";

export function ClientAccessPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"register" | "login" | "admin">("register");
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isSubmittingAdmin, setIsSubmittingAdmin] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [selectedRole, setSelectedRole] = useState<"client" | "admin" | null>(null);

  useEffect(() => {
    async function loadInitial() {
      const [activeProfile, persistedSession] = await Promise.all([getActiveProfile(), Promise.resolve(readSession())]);
      setProfile(activeProfile);
      setSession(persistedSession);

      setLoading(false);
    }

    void loadInitial();
  }, [router]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmittingRegister(true);

    const normalizedRegister = {
      fullName: registerForm.fullName.trim(),
      email: registerForm.email.trim().toLowerCase(),
      phone: registerForm.phone.trim(),
      password: registerForm.password,
    };

    if (!normalizedRegister.fullName) {
      setError("Ingresa tu nombre completo.");
      setIsSubmittingRegister(false);
      return;
    }

    if (!normalizedRegister.email.includes("@")) {
      setError("Ingresa un correo valido.");
      setIsSubmittingRegister(false);
      return;
    }

    if (normalizedRegister.password.length < 4) {
      setError("La clave debe tener al menos 4 caracteres.");
      setIsSubmittingRegister(false);
      return;
    }

    try {
      await registerClient(normalizedRegister);
      setMessage("Registro enviado. Tu cuenta queda pendiente de validacion por el admin.");
      setRegisterForm({ fullName: "", email: "", phone: "", password: "" });
      setActiveTab("login");
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "No se pudo registrar el cliente.");
    } finally {
      setIsSubmittingRegister(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmittingLogin(true);

    const normalizedEmail = loginForm.email.trim().toLowerCase();
    const normalizedPassword = loginForm.password;

    if (!normalizedEmail || !normalizedPassword) {
      setError("Completa correo y clave para ingresar.");
      setIsSubmittingLogin(false);
      return;
    }

    if (isAdminCredential(normalizedEmail, normalizedPassword)) {
      const adminSession = saveAdminSession(normalizedEmail);
      setSession(adminSession);
      setMessage("Acceso de administrador concedido. Redirigiendo al panel...");
      setLoginForm({ email: "", password: "" });
      router.replace("/admin");
      setIsSubmittingLogin(false);
      return;
    }

    try {
      const client = await authenticateClient(normalizedEmail, normalizedPassword);
      if (!client) {
        setError("Credenciales invalidas o cuenta pendiente de validacion.");
        setIsSubmittingLogin(false);
        return;
      }

      saveClientSession(client);
      setSession({ email: client.email, fullName: client.fullName, role: "client" });
      setLoginForm({ email: "", password: "" });
      router.replace("/members");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion.");
    } finally {
      setIsSubmittingLogin(false);
    }
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmittingAdmin(true);

    const normalizedEmail = adminForm.email.trim().toLowerCase();
    const normalizedPassword = adminForm.password;

    if (!normalizedEmail || !normalizedPassword) {
      setError("Completa correo y clave de administrador.");
      setIsSubmittingAdmin(false);
      return;
    }

    if (!isAdminCredential(normalizedEmail, normalizedPassword)) {
      setError("Credenciales de administrador invalidas.");
      setIsSubmittingAdmin(false);
      return;
    }

    const adminSession = saveAdminSession(normalizedEmail);
    setSession(adminSession);
    setAdminForm({ email: "", password: "" });
    setMessage("Acceso de administrador concedido. Redirigiendo al panel...");
    router.replace("/admin");
    setIsSubmittingAdmin(false);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setMessage("Sesion cerrada.");
  }

  function useAdminCredentials() {
    setActiveTab("admin");
    setError("");
    setMessage("Credenciales de admin cargadas. Ahora pulsa Ingresar como admin.");
    setAdminForm({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-white/50">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-xs font-semibold tracking-[0.2em] uppercase text-white/40 hover:text-white/70 transition">
        ← Agencia Aurora
      </Link>

      {/* ROLE SELECTOR */}
      {selectedRole === null ? (
        <div className="w-full max-w-sm">
          <h1 className="text-center font-[var(--font-heading)] text-3xl font-bold text-white">Selecciona tu rol</h1>
          <p className="mt-2 text-center text-sm text-white/50">¿Como deseas ingresar?</p>

          <div className="mt-8 grid gap-3">
            <button
              type="button"
              onClick={() => { setSelectedRole("client"); setActiveTab("login"); setError(""); setMessage(""); }}
              className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-left hover:border-white/40 hover:bg-white/10 transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg">👤</span>
              <div>
                <p className="text-sm font-semibold text-white">Soy cliente</p>
                <p className="text-xs text-white/50">Inicia sesion o registrate para acceder</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedRole("admin"); setActiveTab("admin"); setError(""); setMessage(""); }}
              className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/5 px-5 py-4 text-left hover:border-white/40 hover:bg-white/10 transition"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg">🔑</span>
              <div>
                <p className="text-sm font-semibold text-white">Soy administrador</p>
                <p className="text-xs text-white/50">Accede al panel de gestion</p>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          {/* HEADER */}
          <div className="mb-6 text-center">
            <h1 className="font-[var(--font-heading)] text-3xl font-bold text-white">
              {selectedRole === "admin" ? "Panel admin" : activeTab === "register" ? "Crear cuenta" : "Iniciar sesion"}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {selectedRole === "admin"
                ? "Acceso restringido al administrador"
                : activeTab === "register"
                  ? "Completa tus datos para solicitar acceso"
                  : "Ingresa con tu correo y clave"}
            </p>
          </div>

          {/* CLIENT TOGGLE */}
          {selectedRole === "client" ? (
            <div className="mb-6 flex rounded-2xl border border-white/15 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => { setActiveTab("login"); setError(""); setMessage(""); }}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  activeTab === "login" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                Iniciar sesion
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab("register"); setError(""); setMessage(""); }}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  activeTab === "register" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                Registrarse
              </button>
            </div>
          ) : null}

          {/* FORMS */}
          {activeTab === "register" ? (
            <form className="grid gap-3" onSubmit={handleRegister}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Nombre completo</label>
                <input
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="Ej: Valeria Luna"
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/40"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Correo</label>
                <input
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="cliente@email.com"
                  type="email"
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/40"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Telefono</label>
                <input
                  value={registerForm.phone}
                  onChange={(e) => setRegisterForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="51987654321"
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/40"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Clave</label>
                <div className="relative">
                  <input
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Minimo 4 caracteres"
                    type={showRegisterPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-12 text-sm outline-none focus:border-white/40"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((p) => !p)}
                    aria-label={showRegisterPassword ? "Ocultar clave" : "Mostrar clave"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/60 transition hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
                      {showRegisterPassword ? (
                        <>
                          <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9.36 5.47A10.83 10.83 0 0 1 12 5c5 0 8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56 13.17 13.17 0 0 1-4.16 4.36" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.23 6.23A13.22 13.22 0 0 0 2.47 10.22a1.52 1.52 0 0 0 0 1.56C3.73 13.89 7 17 12 17c1.26 0 2.4-.2 3.42-.53" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      ) : (
                        <>
                          <path d="M2.47 10.22C3.73 8.11 7 5 12 5s8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56C20.27 13.89 17 17 12 17s-8.27-3.11-9.53-5.22a1.52 1.52 0 0 1 0-1.56Z" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="11" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmittingRegister}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-60 hover:brightness-110 transition"
              >
                {isSubmittingRegister ? "Enviando..." : "Registrarse"}
              </button>
            </form>
          ) : activeTab === "login" ? (
            <form className="grid gap-3" onSubmit={handleLogin}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Correo</label>
                <input
                  value={loginForm.email}
                  onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="Tu correo registrado"
                  type="email"
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/40"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Clave</label>
                <div className="relative">
                  <input
                    value={loginForm.password}
                    onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Tu clave"
                    type={showLoginPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-12 text-sm outline-none focus:border-white/40"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    aria-label={showLoginPassword ? "Ocultar clave" : "Mostrar clave"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/60 transition hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
                      {showLoginPassword ? (
                        <>
                          <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9.36 5.47A10.83 10.83 0 0 1 12 5c5 0 8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56 13.17 13.17 0 0 1-4.16 4.36" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.23 6.23A13.22 13.22 0 0 0 2.47 10.22a1.52 1.52 0 0 0 0 1.56C3.73 13.89 7 17 12 17c1.26 0 2.4-.2 3.42-.53" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      ) : (
                        <>
                          <path d="M2.47 10.22C3.73 8.11 7 5 12 5s8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56C20.27 13.89 17 17 12 17s-8.27-3.11-9.53-5.22a1.52 1.52 0 0 1 0-1.56Z" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="11" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-60 hover:brightness-110 transition"
              >
                {isSubmittingLogin ? "Ingresando..." : "Iniciar sesion"}
              </button>
            </form>
          ) : (
            <form className="grid gap-3" onSubmit={handleAdminLogin}>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Correo admin</label>
                <input
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={ADMIN_EMAIL}
                  type="email"
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/40"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/60">Clave</label>
                <div className="relative">
                  <input
                    value={adminForm.password}
                    onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Clave de administrador"
                    type={showAdminPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 pr-12 text-sm outline-none focus:border-white/40"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((p) => !p)}
                    aria-label={showAdminPassword ? "Ocultar clave" : "Mostrar clave"}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/60 transition hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-none stroke-current" strokeWidth="1.8" aria-hidden="true">
                      {showAdminPassword ? (
                        <>
                          <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M10.58 10.58a2 2 0 0 0 2.84 2.84" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M9.36 5.47A10.83 10.83 0 0 1 12 5c5 0 8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56 13.17 13.17 0 0 1-4.16 4.36" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M6.23 6.23A13.22 13.22 0 0 0 2.47 10.22a1.52 1.52 0 0 0 0 1.56C3.73 13.89 7 17 12 17c1.26 0 2.4-.2 3.42-.53" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      ) : (
                        <>
                          <path d="M2.47 10.22C3.73 8.11 7 5 12 5s8.27 3.11 9.53 5.22a1.52 1.52 0 0 1 0 1.56C20.27 13.89 17 17 12 17s-8.27-3.11-9.53-5.22a1.52 1.52 0 0 1 0-1.56Z" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="11" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmittingAdmin}
                className="mt-2 w-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-60 hover:brightness-110 transition"
              >
                {isSubmittingAdmin ? "Validando..." : "Ingresar"}
              </button>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={useAdminCredentials} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition">Admin principal</button>
              </div>
            </form>
          )}

          {message ? (
            <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          {session ? (
            <button type="button" onClick={handleLogout} className="mt-4 w-full rounded-full border border-white/20 py-2.5 text-xs font-semibold text-white/60 hover:text-white transition">
              Cerrar sesion
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => { setSelectedRole(null); setError(""); setMessage(""); }}
            className="mt-4 w-full text-center text-xs text-white/35 hover:text-white/60 transition"
          >
            ← Cambiar rol
          </button>
        </div>
      )}
    </main>
  );
}
