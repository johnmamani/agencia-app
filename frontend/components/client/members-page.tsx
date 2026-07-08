"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getClientByEmail,
  requestClientConsumptionValidationByEmail,
} from "@/frontend/lib/client-indexeddb";
import { listProfiles } from "@/frontend/lib/profile-indexeddb";
import { clearSession, readSession, type AuthSession } from "@/frontend/lib/auth-session";
import type { Client } from "@/shared/client";
import type { Profile } from "@/shared/profile";

function whatsappHref(number: string): string {
  const clean = number.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=Hola%2C%20vi%20tu%20perfil%20en%20Agencia%20Aurora%20y%20quiero%20informacion`;
}

function getFlagFromNationality(nationality: string): string {
  const value = nationality.trim().toLowerCase();
  if (value.includes("peru")) return "🇵🇪";
  if (value.includes("colomb")) return "🇨🇴";
  if (value.includes("venez")) return "🇻🇪";
  if (value.includes("argentin")) return "🇦🇷";
  if (value.includes("chil")) return "🇨🇱";
  if (value.includes("brasil") || value.includes("brasile")) return "🇧🇷";
  if (value.includes("ecuador")) return "🇪🇨";
  return "🌎";
}

function formatScheduleDisplay(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Sin horario";
  }

  const rangeMatch = normalized.match(/(\d{2})\/(\d{2})\/(\d{4}).*?de\s+(\d{2}:\d{2})\s+a\s+(\d{2}:\d{2})/i);
  if (rangeMatch) {
    const [, day, month, year, fromTime, toTime] = rangeMatch;
    return `${day}/${month}/${year} de ${fromTime} a ${toTime}`;
  }

  return normalized.replace(/^disponible\s*/i, "").trim();
}

function getHourlyPriceLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Consultar";
  }

  return normalized.replace(/2\s*horas?/gi, "1 hora").replace(/Desde\s*/gi, "").trim();
}

export function MembersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [clientLoyalty, setClientLoyalty] = useState<Client | null>(null);
  const [loyaltyMessage, setLoyaltyMessage] = useState("");
  const [loyaltyError, setLoyaltyError] = useState("");
  const [isRegisteringConsumption, setIsRegisteringConsumption] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const s = readSession();

      if (!s || (s.role !== "client" && s.role !== "admin")) {
        router.replace("/client");
        return;
      }

      setSession(s);
      const all = await listProfiles();
      const visibleProfiles = all.filter((p) => p.isVisible);
      setProfiles(visibleProfiles);
      setSelectedProfileId("");

      if (s.role === "client") {
        const currentClient = await getClientByEmail(s.email);
        setClientLoyalty(currentClient);
      } else {
        setClientLoyalty(null);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  useEffect(() => {
    setSelectedPhotoIndex(0);
  }, [selectedProfileId]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;

  useEffect(() => {
    if (!selectedProfile || selectedProfile.photos.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setSelectedPhotoIndex((prev) => (prev + 1) % selectedProfile.photos.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedProfile]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-white/50 text-sm">Cargando...</p>
      </main>
    );
  }

  function showPreviousSelectedPhoto() {
    if (!selectedProfile || selectedProfile.photos.length <= 1) {
      return;
    }

    setSelectedPhotoIndex((prev) => {
      const length = selectedProfile.photos.length;
      return (prev - 1 + length) % length;
    });
  }

  function showNextSelectedPhoto() {
    if (!selectedProfile || selectedProfile.photos.length <= 1) {
      return;
    }

    setSelectedPhotoIndex((prev) => (prev + 1) % selectedProfile.photos.length);
  }

  function handleCloseSelectedProfile() {
    setSelectedProfileId("");
  }

  async function handleRequestConsumptionValidation() {
    if (!session || session.role !== "client") {
      return;
    }

    setIsRegisteringConsumption(true);
    setLoyaltyError("");
    setLoyaltyMessage("");

    try {
      const updated = await requestClientConsumptionValidationByEmail(session.email);
      setClientLoyalty(updated);
      setLoyaltyMessage("Solicitud enviada. El administrador debe validar este consumo para sumar puntos.");
    } catch (error) {
      setLoyaltyError(error instanceof Error ? error.message : "No se pudo solicitar la validacion del consumo.");
    } finally {
      setIsRegisteringConsumption(false);
    }
  }

  const cycleProgress = clientLoyalty ? clientLoyalty.totalConsumptions % 5 : 0;
  const consumptionsToNextReward = clientLoyalty
    ? cycleProgress === 0
      ? 5
      : 5 - cycleProgress
    : 5;
  const cyclePercentage = Math.min((cycleProgress / 5) * 100, 100);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-14">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Zona privada</p>
          <p className="mt-0.5 text-sm font-semibold text-white/70">
            Bienvenido, {session?.fullName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white/60 hover:text-white transition"
          >
            Inicio
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-semibold text-white/60 hover:text-white transition"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Título */}
      <div className="mb-8 text-center">
        <h1 className="font-[var(--font-heading)] text-4xl font-extrabold text-white md:text-5xl">
          Perfiles disponibles
        </h1>
        <p className="mt-2 text-sm text-white/50">
          Acceso exclusivo para miembros verificados
        </p>
      </div>

      {session?.role === "client" ? (
        <section className="mb-6 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-3 md:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Fidelizacion cliente</p>
              <p className="mt-0.5 text-sm font-semibold text-white/85">Consumos y beneficios</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRequestConsumptionValidation()}
              disabled={isRegisteringConsumption}
              className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {isRegisteringConsumption ? "Enviando..." : "Solicitar validacion"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-white/85">
              Consumos: <strong>{clientLoyalty?.totalConsumptions ?? 0}</strong>
            </span>
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-white/85">
              Puntos: <strong>{clientLoyalty?.loyaltyPoints ?? 0}</strong>
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              Gratis: <strong>{clientLoyalty?.freeServicesAvailable ?? 0}</strong>
            </span>
            <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2.5 py-1 text-sky-200">
              Pendientes: <strong>{clientLoyalty?.pendingConsumptionValidations ?? 0}</strong>
            </span>
          </div>

          <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-white/60">
              <span>Progreso al siguiente premio</span>
              <span>
                {clientLoyalty && cycleProgress === 0 && clientLoyalty.totalConsumptions > 0
                  ? "Premio desbloqueado"
                  : `Faltan ${consumptionsToNextReward}`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300" style={{ width: `${cyclePercentage}%` }} />
            </div>
          </div>

          {clientLoyalty?.lastConsumptionAt ? (
            <p className="mt-2 text-[11px] text-white/45">
              Ultimo consumo: {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(clientLoyalty.lastConsumptionAt))}
            </p>
          ) : null}

          {clientLoyalty?.lastConsumptionRequestAt ? (
            <p className="mt-1 text-[11px] text-white/45">
              Ultima solicitud: {new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(clientLoyalty.lastConsumptionRequestAt))}
            </p>
          ) : null}

          {loyaltyMessage ? (
            <div className="mt-2 rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
              {loyaltyMessage}
            </div>
          ) : null}
          {loyaltyError ? (
            <div className="mt-2 rounded-lg border border-rose-300/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200">
              {loyaltyError}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedProfile ? (
        <section className="mt-2 mb-10">
          {selectedProfile.photos.length > 0 ? (
            <>
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseSelectedProfile}
                  className="inline-flex items-center justify-center rounded-full border border-rose-300/50 bg-rose-500 px-3 py-1.5 text-xs font-bold text-rose-950 transition hover:brightness-110"
                >
                  Cerrar
                </button>
              </div>
              <article className="mb-6 overflow-hidden rounded-2xl border-2 border-white/30 bg-black/40 shadow-2xl transition hover:border-white/50">
                <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "1/1" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedProfile.photos[selectedPhotoIndex]}
                    alt={`Foto ${selectedPhotoIndex + 1} de ${selectedProfile.displayName}`}
                    className="absolute inset-0 h-full w-full object-contain"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                  <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3 md:p-4">
                    <p className="rounded-full border border-white/35 bg-black/55 px-3 py-1 text-xs font-bold text-white/95 backdrop-blur">
                      {selectedPhotoIndex + 1}/{selectedProfile.photos.length}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={showPreviousSelectedPhoto}
                        className="rounded-full border border-white/40 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/75 transition"
                        aria-label="Foto anterior"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={showNextSelectedPhoto}
                        className="rounded-full border border-white/40 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/75 transition"
                        aria-label="Foto siguiente"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
                    <div className="grid gap-3 md:max-w-xl">
                      <h3 className="font-[var(--font-heading)] text-4xl font-extrabold leading-none text-white drop-shadow-lg md:text-5xl">
                        {selectedProfile.displayName}
                      </h3>

                      <p className="text-3xl font-extrabold leading-none text-white/95 md:text-4xl">
                        {selectedProfile.age}
                      </p>

                      <p className="text-sm font-bold tracking-[0.08em] text-white/90">
                        {getFlagFromNationality(selectedProfile.nationality)} {selectedProfile.nationality.toUpperCase()}
                      </p>

                      <div className="grid justify-items-start gap-2">
                        <div className="w-fit max-w-full rounded-2xl border border-white/25 bg-black/35 px-3 py-2.5 backdrop-blur">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            Disponibilidad
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white/90">{formatScheduleDisplay(selectedProfile.schedule)}</p>
                        </div>

                        <div className="w-fit max-w-full rounded-2xl border border-[#25D366]/45 bg-[#25D366]/15 px-3 py-2.5 backdrop-blur">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b7f9d1]">
                            Tarifa por hora
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#d9ffe8]">{getHourlyPriceLabel(selectedProfile.costText)}</p>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2">
                        <a
                          href={whatsappHref(selectedProfile.whatsappNumber)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-full border border-[#25D366]/70 bg-gradient-to-r from-[#25D366] to-[#1ebe5d] px-3.5 py-2 text-xs font-bold text-[#04160a] transition hover:brightness-110 hover:shadow-lg hover:shadow-[#25D366]/40"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {selectedProfile.photos.slice(0, 5).map((photo, idx) => (
                  <button
                    key={`${selectedProfile.id}-thumb-${idx}`}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`group relative aspect-square overflow-hidden rounded-2xl border-2 transition hover:border-white/50 ${
                      idx === selectedPhotoIndex
                        ? "border-[var(--accent)] shadow-2xl shadow-[var(--accent)]/20"
                        : "border-white/25"
                    }`}
                  >
                    <div className="h-full w-full overflow-hidden bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={`Foto ${idx + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    </div>
                    <div className="absolute inset-0 rounded-2xl bg-black/0 transition group-hover:bg-black/30" />
                  </button>
                ))}

                {selectedProfile.photos.length > 5 ? (
                  <div className="aspect-square rounded-2xl border-2 border-white/25 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">+{selectedProfile.photos.length - 5}</p>
                      <p className="text-xs text-white/70">más</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {selectedProfile.photos.map((_, idx) => (
                  <button
                    key={`${selectedProfile.id}-dot-${idx}`}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`rounded-full transition ${
                      idx === selectedPhotoIndex
                        ? "h-3 w-3 bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/40"
                        : "h-2 w-2 bg-white/30 hover:bg-white/50"
                    }`}
                    title={`Foto ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-white/60">
              Este perfil aún no tiene fotos cargadas.
            </div>
          )}
        </section>
      ) : null}

      {!selectedProfile ? (
        <>
          {/* Grid de perfiles */}
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Selecciona una chica</p>
          </div>
          {profiles.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="text-white/40">No hay perfiles disponibles en este momento.</p>
              <p className="mt-1 text-xs text-white/30">Vuelve pronto.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isSelected={profile.id === selectedProfileId}
                  onSelect={() => setSelectedProfileId(profile.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}

function ProfileCard({
  profile,
  isSelected,
  onSelect,
}: {
  profile: Profile;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (profile.photos.length <= 1) return;
    const interval = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % profile.photos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [profile.photos.length]);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-black/30 transition ${
        isSelected ? "border-[var(--accent)] shadow-lg shadow-[var(--accent)]/25" : "border-white/15"
      }`}
    >
      {/* Foto */}
      <div className="relative aspect-square overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.photos[photoIndex]}
          alt={profile.displayName}
          className="absolute inset-0 h-full w-full object-contain transition-all duration-700"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Nombre sobre imagen */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="font-[var(--font-heading)] text-2xl font-extrabold text-white">
            {profile.displayName}
          </h2>
          <p className="text-sm text-white/75">
            {profile.age} años · {getFlagFromNationality(profile.nationality)} {profile.nationality}
          </p>
        </div>

        {/* Indicador fotos */}
        {profile.photos.length > 1 && (
          <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur">
            {photoIndex + 1}/{profile.photos.length}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Fecha y hora</p>
            <p className="mt-0.5 text-xs font-semibold text-white/80">{formatScheduleDisplay(profile.schedule)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Zona</p>
            <p className="mt-0.5 text-xs font-semibold text-white/80">{profile.locationText}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#25D366]/25 bg-[#25D366]/8 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a3f0c0]">Tarifa</p>
          <p className="mt-0.5 text-xs font-semibold text-[#d9ffe8]">{profile.costText}</p>
        </div>

        <p className="text-xs text-white/50 leading-5">{profile.treatmentStyle}</p>

        <a
          href={whatsappHref(profile.whatsappNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 flex items-center justify-center gap-2 rounded-full border border-[#25D366]/60 bg-gradient-to-r from-[#25D366] to-[#1ebe5d] py-2.5 text-xs font-bold text-[#04160a] hover:brightness-110 transition"
        >
          Contactar por WhatsApp
        </a>

        <button
          type="button"
          onClick={onSelect}
          className={`rounded-full border px-3 py-2 text-xs font-bold transition ${
            isSelected
              ? "border-[var(--accent)] bg-[var(--accent)]/20 text-white"
              : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
          }`}
        >
          {isSelected ? "Viendo perfil" : "Ver perfil"}
        </button>
      </div>
    </article>
  );
}
