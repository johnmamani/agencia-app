"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listProfiles } from "@/frontend/lib/profile-indexeddb";
import { clearSession, readSession, type AuthSession } from "@/frontend/lib/auth-session";
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

export function MembersPage() {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
      setProfiles(all.filter((p) => p.isVisible));
      setLoading(false);
    }

    void load();
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-white/50 text-sm">Cargando...</p>
      </main>
    );
  }

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

      {/* Grid de perfiles */}
      {profiles.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-white/40">No hay perfiles disponibles en este momento.</p>
          <p className="mt-1 text-xs text-white/30">Vuelve pronto.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    if (profile.photos.length <= 1) return;
    const interval = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % profile.photos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [profile.photos.length]);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/15 bg-black/30">
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
        <p className="text-xs text-white/60 leading-5">{profile.physicalTraits}</p>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Horario</p>
            <p className="mt-0.5 text-xs font-semibold text-white/80">{profile.schedule}</p>
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
      </div>
    </article>
  );
}
