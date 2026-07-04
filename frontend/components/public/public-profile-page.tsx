"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getActiveProfile } from "@/frontend/lib/profile-indexeddb";
import { getRatingSummary, upsertRating } from "@/frontend/lib/rating-indexeddb";
import { readSession, type AuthSession } from "@/frontend/lib/auth-session";
import type { Profile } from "@/shared/profile";
import type { RatingSummary } from "@/shared/rating";

function whatsappHref(number: string): string {
  const clean = number.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=Hola%2C%20quiero%20informacion%20del%20perfil%20disponible`;
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
  if (value.includes("boliv")) return "🇧🇴";
  if (value.includes("paragu")) return "🇵🇾";
  if (value.includes("uruguay")) return "🇺🇾";
  if (value.includes("mexic")) return "🇲🇽";
  if (value.includes("espa") || value.includes("spanish")) return "🇪🇸";
  if (value.includes("dominican") || value.includes("dominicana") || value.includes("rd")) return "🇩🇴";

  return "🌎";
}

export function PublicProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Rating data kept for future feature expansion
  const _trustItems = [
    { label: "Resenas verificadas", value: String(ratingSummary?.total ?? 0) },
    { label: "Servicios completados", value: ratingSummary && ratingSummary.total > 0 ? `${ratingSummary.total * 3}+` : "0" },
    {
      label: "Actualizado",
      value: new Intl.DateTimeFormat("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(currentDate),
    },
    { label: "Tiempo de respuesta", value: "< 5 min" },
  ];

  const _safetyItems = [
    "Cobertura de seguro activa",
    "Check-in y check-out con control interno",
    "Protocolo GPS de ruta seguro",
    "Canal de asistencia 24/7",
  ];

  useEffect(() => {
    async function loadProfile() {
      const activeProfile = await getActiveProfile();
      const persistedSession = readSession();
      setProfile(activeProfile);
      setSession(persistedSession);

      if (activeProfile) {
        const summary = await getRatingSummary(activeProfile.id);
        setRatingSummary(summary);
      } else {
        setRatingSummary(null);
      }

      setLoading(false);
    }

    void loadProfile();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const syncTick = () => {
      setCurrentDate(new Date());
      const now = Date.now();
      const msToNextSecond = 1000 - (now % 1000);
      timer = setTimeout(syncTick, msToNextSecond);
    };

    syncTick();

    return () => clearTimeout(timer);
  }, []);

  // Auto-rotate photos
  useEffect(() => {
    if (!profile || profile.photos.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length);
    }, 5000); // Cambiar foto cada 5 segundos
    
    return () => clearInterval(interval);
  }, [profile]);



  async function _handleRate(stars: number) {
    if (!profile) {
      return;
    }

    if (!session || session.role !== "client") {
      return;
    }

    try {
      await upsertRating({
        profileId: profile.id,
        clientEmail: session.email,
        clientName: session.fullName,
        stars,
      });
      const summary = await getRatingSummary(profile.id);
      setRatingSummary(summary);
      // Rating saved silently for future display
    } catch (error) {
      // Error handling for rating update
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10 md:py-14">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-10 backdrop-blur-sm">
          <p className="text-white/75">Cargando landing...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-6xl overflow-x-hidden px-6 py-10 pt-28 md:px-10 md:py-14 md:pt-32">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes carouselSlide {
          0%, 100% {
            opacity: 1;
            transform: translateX(0);
          }
          45%, 55% {
            opacity: 0;
            transform: translateX(10px);
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
          }
          50% {
            box-shadow: 0 0 40px rgba(217, 70, 239, 0.2);
          }
        }
        
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        
        .animate-slide-in {
          animation: slideIn 0.6s ease-out forwards;
        }

        .animate-fade-in-scale {
          animation: fadeInScale 0.5s ease-out;
        }

        .carousel-image {
          animation: carouselSlide 0.8s ease-in-out;
        }

        .glow-border {
          animation: glow-pulse 3s ease-in-out infinite;
        }
      `}</style>
      <header className="fixed left-6 right-6 top-4 z-50 flex flex-col gap-4">
        <div className="flex items-center justify-between md:justify-start md:gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-lg shadow-lg">
              ✨
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/70">Agencia Aurora</p>
            </div>
          </div>

          <nav className="hidden md:flex flex-wrap items-center gap-2">
            <a href="#galeria" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Galeria
            </a>
            <a href="#reels" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Reels
            </a>
            <a href="#confianza" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Confianza
            </a>
          </nav>

          <div className="flex items-center gap-2 md:ms-auto">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="md:hidden rounded-full border border-white/25 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20 transition"
            >
              ≡
            </button>
            <Link
              href="/client"
              className="hidden md:flex rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-4 py-2 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/40"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden mt-4 flex flex-col gap-2 border-t border-white/15 pt-4">
            <a
              href="#galeria"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-4 py-2 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/40"
            >
              Galeria
            </a>
            <a
              href="#reels"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Reels
            </a>
            <a
              href="#confianza"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Confianza
            </a>
            <Link
              href="/client"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-4 py-2 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/40"
            >
              Iniciar sesión
            </Link>
          </nav>
        )}
      </header>

      <section className="grid gap-8 rounded-3xl border border-white/25 bg-gradient-to-br from-white/12 via-white/8 to-white/6 p-6 backdrop-blur-xl shadow-2xl md:grid-cols-[1.15fr_0.85fr] md:p-10">
        <div className="animate-fade-in-up">
          <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/70">
            ✨ Landing principal
          </p>
          <h1 className="mt-3 font-[var(--font-heading)] font-extrabold text-6xl leading-tight md:text-7xl bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            Elegancia, presencia y coordinacion premium para una noche inolvidable.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/85 leading-relaxed">
            Acceso a perfil disponible con validacion de cliente.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={profile ? whatsappHref(profile.whatsappNumber) : "https://wa.me/51999999999?text=Hola%2C%20quiero%20consultar%20la%20disponibilidad"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-6 py-3 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/40"
            >
              📱 Consultar por WhatsApp
            </a>
            <Link
              href="/client"
              className="inline-flex rounded-full border border-white/30 bg-gradient-to-r from-white/12 to-white/6 px-6 py-3 text-sm font-semibold hover:from-white/20 hover:to-white/12 transition shadow-lg"
            >
              🔑 Entrar como cliente
            </Link>
          </div>
        </div>

        <aside className="animate-slide-in rounded-3xl border-2 border-white/25 overflow-hidden shadow-2xl relative h-[600px] w-full max-w-md mx-auto">
          {profile ? (
            <div className="relative h-full w-full">
              {/* Foto de fondo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photos[currentPhotoIndex]}
                alt={profile.displayName}
                className="absolute inset-0 h-full w-full object-cover"
              />
              
              {/* Gradiente oscuro para legibilidad */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Botones de navegar fotos */}
              <div className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                  onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + profile.photos.length) % profile.photos.length)}
                  className="rounded-full border border-white/50 bg-black/60 backdrop-blur px-3 py-2 text-xs font-semibold hover:bg-black/80 transition text-white"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length)}
                  className="rounded-full border border-white/50 bg-black/60 backdrop-blur px-3 py-2 text-xs font-semibold hover:bg-black/80 transition text-white"
                >
                  →
                </button>
              </div>

              {/* Contador de fotos */}
              <p className="absolute top-4 left-4 text-xs font-bold text-white/90 z-10 rounded-full bg-black/60 backdrop-blur px-3 py-1">
                {currentPhotoIndex + 1}/{profile.photos.length}
              </p>

              {/* Información superpuesta abajo */}
              <div className="absolute inset-x-0 bottom-0 p-6 z-20">
                {/* Nombre y edad */}
                <h2 className="font-[var(--font-heading)] font-extrabold text-5xl text-white leading-tight">
                  {profile.displayName}
                </h2>
                <p className="mt-1 text-2xl font-bold text-white">
                  {profile.age}
                </p>

                {/* Nacionalidad con bandera */}
                <p className="mt-2 text-sm font-bold tracking-wide text-white/95">
                  {getFlagFromNationality(profile.nationality)} {profile.nationality.toUpperCase()}
                </p>

                {/* Horario y precio en badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--accent)]/60 bg-[var(--accent)]/20 backdrop-blur px-3 py-1 text-xs font-extrabold tracking-wide text-[var(--accent)]">
                    Disponible de 13:00 a 18:00
                  </span>
                  <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 backdrop-blur px-3 py-1 text-xs font-extrabold tracking-wide text-emerald-200">
                    Precio: hora 200 soles
                  </span>
                </div>

                {/* Botones de acción */}
                <div className="mt-4 flex gap-3">
                  <a
                    href={whatsappHref(profile.whatsappNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-4 py-3 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/50 text-center"
                  >
                    📱 WhatsApp
                  </a>
                  <Link
                    href="/client"
                    className="flex-1 rounded-full border border-white/40 bg-white/15 backdrop-blur px-4 py-3 text-sm font-bold text-white transition hover:bg-white/25 text-center"
                  >
                    🔑 Entrar
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/5 to-black/40">
              <div className="text-center">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/65">
                  ⏳ Status
                </p>
                <h2 className="mt-3 font-[var(--font-heading)] text-4xl text-white">No hay perfil visible</h2>
                <p className="mt-4 text-white/85">
                  Regresa en unos minutos.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>

      {profile ? (
        <section id="galeria" className="mt-12 animate-fade-in-up">
          <h2 className="font-[var(--font-heading)] font-bold text-5xl">💫 Caracteristicas y trato</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/25 bg-gradient-to-br from-white/10 to-white/5 p-5 hover:border-white/40 hover:from-white/15 hover:to-white/10 transition shadow-lg">
              <p className="leading-7 text-white/85">{profile.physicalTraits}</p>
            </div>
            <div className="rounded-2xl border border-white/25 bg-gradient-to-br from-white/10 to-white/5 p-5 hover:border-white/40 hover:from-white/15 hover:to-white/10 transition shadow-lg">
              <p className="leading-7 text-white/85">{profile.treatmentStyle}</p>
            </div>
          </div>
        </section>
      ) : null}

      {profile ? (
        <section id="reels" className="mt-12 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-[var(--font-heading)] font-bold text-5xl">🖼️ Galeria de fotos ({currentPhotoIndex + 1}/{profile.photos.length})</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + profile.photos.length) % profile.photos.length)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length)}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/20 transition"
              >
                Siguiente →
              </button>
            </div>
          </div>

          {/* Imagen destacada grande */}
          <article className="rounded-2xl border-2 border-white/30 bg-white/5 overflow-hidden shadow-2xl hover:border-white/50 transition carousel-image mb-6">
            <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/10" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photos[currentPhotoIndex]}
                alt={`Foto ${currentPhotoIndex + 1} de ${profile.displayName}`}
                className="h-full w-full object-cover animate-fade-in-scale"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>
          </article>

          {/* Grid de 5 fotos cuadradas grandes */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {profile.photos.slice(0, 5).map((photo, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPhotoIndex(idx)}
                className={`relative rounded-2xl overflow-hidden border-2 transition hover:border-white/50 group aspect-square ${
                  idx === currentPhotoIndex
                    ? "border-[var(--accent)] shadow-2xl shadow-[var(--accent)]/20"
                    : "border-white/25"
                }`}
              >
                {/* Cuadrado grande con foto completa */}
                <div className="w-full h-full overflow-hidden bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Overlay con número */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition rounded-2xl">
                  <span className="text-white font-bold text-lg opacity-0 group-hover:opacity-100 transition">
                    {idx + 1}
                  </span>
                </div>
              </button>
            ))}

            {/* Indicador de más fotos */}
            {profile.photos.length > 5 && (
              <div className="rounded-2xl border-2 border-white/25 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center aspect-square">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">+{profile.photos.length - 5}</p>
                  <p className="text-xs text-white/70">más</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress indicators */}
          <div className="mt-6 flex justify-center gap-2 flex-wrap">
            {profile.photos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPhotoIndex(idx)}
                className={`transition rounded-full ${
                  idx === currentPhotoIndex
                    ? "bg-[var(--accent)] w-3 h-3 shadow-lg shadow-[var(--accent)]/40"
                    : "bg-white/30 hover:bg-white/50 w-2 h-2"
                }`}
                title={`Foto ${idx + 1}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {profile && profile.videos.length > 0 ? (
        <section id="videos" className="mt-12 animate-fade-in-up">
          <h2 className="font-[var(--font-heading)] font-bold text-5xl">🎬 Videos ({profile.videos.length})</h2>
          
          {/* Grid de videos cuadrados con reproductor */}
          <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {profile.videos.map((video, idx) => (
              <article
                key={idx}
                className="relative rounded-2xl overflow-hidden border-2 border-white/25 bg-black/40 hover:border-white/50 transition group aspect-square shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/20"
              >
                {/* Video player */}
                <video
                  src={video}
                  controls
                  className="w-full h-full object-cover"
                  preload="metadata"
                />

                {/* Overlay con información */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition">
                  <p className="text-xs font-bold text-white">Video {idx + 1}</p>
                  <p className="text-[10px] text-white/70 mt-0.5">Click para reproducir</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="confianza" className="mt-12 rounded-3xl border border-white/25 bg-gradient-to-r from-white/12 via-white/8 to-white/6 p-6 backdrop-blur-xl shadow-2xl md:p-8 animate-fade-in-up">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/70">
              🔐 Zona privada
            </p>
            <h2 className="mt-2 font-[var(--font-heading)] font-bold text-4xl text-white">Acceso para clientes</h2>
            <p className="mt-2 max-w-2xl text-white/80">
              Registra tu cuenta, espera validacion del admin e ingresa a la zona de clientes para mas detalles.
            </p>
          </div>
          <a
            href="/client"
            className="inline-flex rounded-full border border-white/30 bg-gradient-to-r from-white/12 to-white/6 px-5 py-3 text-sm font-semibold hover:from-white/20 hover:to-white/12 transition shadow-lg whitespace-nowrap"
          >
            → Ir a clientes
          </a>
        </div>
      </section>

      <footer className="mt-6 rounded-3xl border border-white/20 bg-black/25 p-6 backdrop-blur-xl shadow-2xl md:p-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/65">Agencia Aurora</p>
            <p className="mt-2 text-sm text-white/80">
              Experiencias premium con protocolo, puntualidad y atencion personalizada.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/65">Navegacion</p>
            <div className="mt-2 grid gap-2 text-sm text-white/80">
              <a href="#galeria" className="hover:text-white transition">Ver galeria</a>
              <a href="#reels" className="hover:text-white transition">Ver reels</a>
              <a href="#confianza" className="hover:text-white transition">Confianza y seguridad</a>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-white/65">Contacto</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={profile ? whatsappHref(profile.whatsappNumber) : "https://wa.me/51999999999?text=Hola%2C%20quiero%20consultar%20la%20disponibilidad"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-ink)] hover:brightness-110 transition"
              >
                WhatsApp directo
              </a>
              <Link
                href="/client"
                className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/20 transition"
              >
                Area clientes
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-white/15 pt-4 text-xs text-white/60">
          © {new Date().getFullYear()} Agencia Aurora. Plataforma privada de coordinacion y atencion premium.
        </div>
      </footer>
    </main>
  );
}
