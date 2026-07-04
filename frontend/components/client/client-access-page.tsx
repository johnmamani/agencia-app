"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authenticateClient, registerClient } from "@/frontend/lib/client-indexeddb";
import { getActiveProfile } from "@/frontend/lib/profile-indexeddb";
import {
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

  useEffect(() => {
    async function loadInitial() {
      const [activeProfile, persistedSession] = await Promise.all([getActiveProfile(), Promise.resolve(readSession())]);
      setProfile(activeProfile);
      setSession(persistedSession);
      setLoading(false);

      if (persistedSession?.role === "admin") {
        router.replace("/admin");
      }
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
      const adminSession = saveAdminSession();
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
      setMessage(`Bienvenido, ${client.fullName}. Acceso habilitado.`);
      setLoginForm({ email: "", password: "" });
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

    const adminSession = saveAdminSession();
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

  function useDemoCredentials() {
    setActiveTab("login");
    setError("");
    setMessage("Credenciales demo cargadas. Ahora pulsa Ingresar.");
    setLoginForm({ email: "demo@agenciaaurora.com", password: "Demo1234" });
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-20 md:px-10">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-10 backdrop-blur-sm">
          <p className="text-white/75">Cargando acceso de clientes...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10 md:py-14">
      <section className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/70">Acceso de clientes</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${session ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"}`}>
            {session ? `Sesion activa (${session.role === "admin" ? "admin" : "cliente"})` : "Sesion no iniciada"}
          </span>
        </div>
        <h1 className="mt-3 font-[var(--font-heading)] text-4xl md:text-5xl">Registro, validacion y acceso</h1>
        <p className="mt-4 max-w-3xl text-white/85">
          El cliente se registra, espera validacion del admin y luego ingresa con su correo y clave.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-black/20 p-4">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/65">Paso 1</p>
            <p className="mt-1 text-sm font-semibold text-white">Registrate</p>
            <p className="mt-1 text-xs text-white/70">Completa tus datos personales y crea tu clave.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-black/20 p-4">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/65">Paso 2</p>
            <p className="mt-1 text-sm font-semibold text-white">Validacion admin</p>
            <p className="mt-1 text-xs text-white/70">Tu cuenta queda pendiente hasta aprobacion.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-black/20 p-4">
            <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/65">Paso 3</p>
            <p className="mt-1 text-sm font-semibold text-white">Ingresa</p>
            <p className="mt-1 text-xs text-white/70">Accede con correo y clave para ver zona privada.</p>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === "register" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-white"
              }`}
            >
              Registrarse
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === "login" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-white"
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === "admin" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-white/10 text-white"
              }`}
            >
              Admin
            </button>
          </div>

          <p className="mt-4 text-sm text-white/70">
            {activeTab === "register"
              ? "Completa el formulario para enviar tu solicitud de acceso."
              : activeTab === "login"
                ? "Inicia sesion solo si tu cuenta ya fue aprobada por administracion."
                : "Usa este acceso solo para gestion interna de la agencia."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={useDemoCredentials}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition"
            >
              Usar cuenta demo
            </button>
            <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-xs text-white/70">
              demo@agenciaaurora.com / Demo1234
            </span>
          </div>

          {activeTab === "register" ? (
            <form className="mt-6 grid gap-3" onSubmit={handleRegister}>
              <label className="grid gap-2 text-sm text-white/85">
                Nombre completo
              <input
                value={registerForm.fullName}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, fullName: event.target.value }))}
                placeholder="Ej: Valeria Luna"
                className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                required
              />
              </label>
              <label className="grid gap-2 text-sm text-white/85">
                Correo
              <input
                value={registerForm.email}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Ej: cliente@email.com"
                type="email"
                className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                required
              />
              </label>
              <label className="grid gap-2 text-sm text-white/85">
                Telefono
              <input
                value={registerForm.phone}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Ej: 51987654321"
                className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                required
              />
              </label>
              <label className="grid gap-2 text-sm text-white/85">
                Clave
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Minimo 4 caracteres"
                    type={showRegisterPassword ? "text" : "password"}
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((prev) => !prev)}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold"
                  >
                    {showRegisterPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
                <span className="text-xs text-white/60">Minimo 4 caracteres.</span>
              </label>
              <button
                type="submit"
                disabled={isSubmittingRegister}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingRegister ? "Enviando..." : "Enviar registro"}
              </button>
            </form>
          ) : activeTab === "login" ? (
            <form className="mt-6 grid gap-3" onSubmit={handleLogin}>
              <label className="grid gap-2 text-sm text-white/85">
                Correo
              <input
                value={loginForm.email}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Tu correo registrado"
                type="email"
                className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                required
              />
              </label>
              <label className="grid gap-2 text-sm text-white/85">
                Clave
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Tu clave"
                    type={showLoginPassword ? "text" : "password"}
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold"
                  >
                    {showLoginPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingLogin ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          ) : (
            <form className="mt-6 grid gap-3" onSubmit={handleAdminLogin}>
              <label className="grid gap-2 text-sm text-white/85">
                Correo admin
                <input
                  value={adminForm.email}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="admin@agenciaaurora.com"
                  type="email"
                  className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm text-white/85">
                Clave admin
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={adminForm.password}
                    onChange={(event) => setAdminForm((prev) => ({ ...prev, password: event.target.value }))}
                    placeholder="Clave de administrador"
                    type={showAdminPassword ? "text" : "password"}
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-semibold"
                  >
                    {showAdminPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={isSubmittingAdmin}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingAdmin ? "Validando..." : "Ingresar como admin"}
              </button>
            </form>
          )}

          {message ? (
            <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </article>

        <aside className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm md:p-8">
          <h2 className="font-[var(--font-heading)] text-3xl">Estado de acceso</h2>

          {session ? (
            <div className="mt-5 rounded-2xl border border-white/20 bg-black/20 p-5">
              <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/65">Acceso activo</p>
              <h3 className="mt-3 font-[var(--font-heading)] text-2xl">{session.fullName}</h3>
              <p className="mt-2 text-sm text-white/75">{session.email}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
                Rol: {session.role === "admin" ? "Administrador" : "Cliente"}
              </p>
              <p className="mt-4 text-white/85">
                Tu cuenta ya puede ingresar a la zona privada de clientes una vez validada por administracion.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-white/75">
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">Cuenta autenticada</li>
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">Sesion guardada en este navegador</li>
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">Acceso listo para zona privada</li>
              </ul>
              {profile ? (
                <div className="mt-5 rounded-2xl border border-white/15 bg-white/7 p-4">
                  <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/65">Perfil visible hoy</p>
                  <p className="mt-2 text-xl font-semibold text-white">{profile.displayName}</p>
                  <p className="text-sm text-white/75">{profile.tagline}</p>
                  {session.role === "admin" ? (
                    <Link
                      href="/admin"
                      className="mt-4 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
                    >
                      Ir al panel admin
                    </Link>
                  ) : (
                    <Link
                      href="/"
                      className="mt-4 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
                    >
                      Volver a la landing
                    </Link>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-5 rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-semibold"
              >
                Cerrar sesion
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/20 bg-black/20 p-5">
              <p className="text-white/80">
                Registro pendiente, validacion por admin y acceso con clave.
              </p>
              <p className="mt-3 text-sm text-white/65">
                Si perdiste tu clave, el admin puede restablecerla desde el panel.
              </p>
              <ul className="mt-4 grid gap-2 text-sm text-white/75">
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">1) Registrate</li>
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">2) Espera aprobacion</li>
                <li className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">3) Ingresa con tu correo y clave</li>
              </ul>
              <Link
                href="/"
                className="mt-5 inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
              >
                Volver a la landing
              </Link>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
