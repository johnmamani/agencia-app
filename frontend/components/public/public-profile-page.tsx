"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getActiveProfile } from "@/frontend/lib/profile-indexeddb";
import { getRatingSummary, upsertRating } from "@/frontend/lib/rating-indexeddb";
import { readSession, type AuthSession } from "@/frontend/lib/auth-session";
import { readHeroCoverImage } from "@/frontend/lib/landing-settings";
import type { Profile } from "@/shared/profile";
import type { RatingSummary } from "@/shared/rating";

function whatsappHref(number: string): string {
  const clean = number.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=Hola%2C%20quiero%20informacion%20del%20perfil%20disponible`;
}

function getYouTubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }

      if (url.pathname.startsWith("/embed/")) {
        return value;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getVideoRenderer(value: string): { kind: "video" | "iframe"; src: string } {
  const normalized = value.trim();
  const youtubeEmbed = getYouTubeEmbedUrl(normalized);

  if (youtubeEmbed) {
    return { kind: "iframe", src: youtubeEmbed };
  }

  return { kind: "video", src: normalized };
}

function getHourlyPriceLabel(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "Consultar";
  }

  return normalized.replace(/2\s*horas?/gi, "1 hora").replace(/Desde\s*/gi, "").trim();
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

export function PublicProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ratingSummary, setRatingSummary] = useState<RatingSummary | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [heroCoverImage, setHeroCoverImage] = useState<string | null>(null);
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
      const landingHeroCover = readHeroCoverImage();
      setProfile(activeProfile);
      setSession(persistedSession);
      setHeroCoverImage(landingHeroCover);

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
    <main className="relative mx-auto w-full max-w-6xl overflow-x-hidden px-6 py-6 md:px-10 md:py-14 md:pt-32">
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

        @keyframes whatsapp-pulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.32);
            transform: translateY(0);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(37, 211, 102, 0);
            transform: translateY(-1px);
          }
        }

        @keyframes whatsapp-float-pulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(37, 211, 102, 0.55),
              0 0 0 0 rgba(37, 211, 102, 0.32),
              0 10px 26px rgba(0, 0, 0, 0.35);
            transform: scale(1);
          }
          35% {
            box-shadow:
              0 0 0 14px rgba(37, 211, 102, 0.18),
              0 0 0 0 rgba(37, 211, 102, 0.28),
              0 12px 30px rgba(37, 211, 102, 0.25);
            transform: scale(1.07);
          }
          70% {
            box-shadow:
              0 0 0 20px rgba(37, 211, 102, 0),
              0 0 0 8px rgba(37, 211, 102, 0),
              0 12px 30px rgba(37, 211, 102, 0.18);
            transform: scale(1.02);
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

        .whatsapp-cta {
          animation: whatsapp-pulse 1.9s ease-in-out infinite;
        }

        .whatsapp-float-cta {
          animation: whatsapp-float-pulse 1.15s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          will-change: transform, box-shadow;
        }
      `}</style>
      <header className="sticky top-0 z-50 -mx-6 mb-6 border-b border-white/10 bg-black/35 px-6 py-4 backdrop-blur-xl md:fixed md:left-6 md:right-6 md:top-4 md:mx-0 md:mb-0 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
        <div className="flex items-center justify-between md:justify-start md:gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-lg shadow-lg">
              <span className="text-sm font-bold tracking-[0.2em] text-white/80">AA</span>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/70">Agencia Aurora</p>
            </div>
          </div>

          <nav className="hidden md:flex flex-wrap items-center gap-2">
            <a href="#reels" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Perfiles
            </a>
            <a href="#videos" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Videos
            </a>
            <a href="#galeria" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Imagen y trato
            </a>
            <a href="#confianza" className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition">
              Acceso clientes
            </a>
          </nav>

          <div className="flex items-center gap-2 md:ms-auto md:flex-wrap md:justify-end">
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
              Iniciar sesion
            </Link>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden mt-4 flex flex-col gap-2 border-t border-white/15 pt-4">
            <a
              href="#reels"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Perfiles
            </a>
            <a
              href="#videos"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Videos
            </a>
            <a
              href="#galeria"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Imagen y trato
            </a>
            <a
              href="#confianza"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Acceso clientes
            </a>
            <Link
              href="/client"
              onClick={() => setIsMenuOpen(false)}
              className="rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-4 py-2 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-lg hover:shadow-[var(--accent)]/40"
            >
              Iniciar sesion
            </Link>
          </nav>
        )}
      </header>

      <div className="animate-fade-in-up py-10 md:py-16 text-center flex flex-col items-center">
        <p className="inline-flex rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
          Agencia Aurora
        </p>
        <h1 className="mt-5 max-w-2xl font-[var(--font-heading)] text-4xl font-extrabold leading-[1.05] text-white md:text-5xl lg:text-6xl">
          Modelos, anfitrionas y acompanantes para eventos con imagen, presencia y atencion privada.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-white/70 md:text-lg md:leading-8">
          Seleccion de perfiles para eventos sociales, reuniones privadas, imagen de marca y acompanamiento con trato reservado y coordinacion directa.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {profile ? (
            <a
              href={whatsappHref(profile.whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full border border-[#25D366]/70 bg-gradient-to-r from-[#25D366] to-[#1ebe5d] px-7 py-3.5 text-sm font-bold text-[#04160a] transition hover:brightness-110 hover:shadow-xl hover:shadow-[#25D366]/40"
            >
              Contactar por WhatsApp
            </a>
          ) : null}
        </div>
      </div>

      {profile ? (
        <section id="reels" className="mt-12 animate-fade-in-up">
          <div className="mb-6">
            <h2 className="font-[var(--font-heading)] font-bold text-5xl">Perfiles disponibles hoy</h2>
            <p className="mt-2 max-w-3xl text-sm text-white/70">
              Revisa la disponibilidad visible del momento y conoce cada perfil antes de escribir por WhatsApp.
            </p>
          </div>

          {/* Imagen destacada grande */}
          <article className="rounded-2xl border-2 border-white/30 bg-black/40 overflow-hidden shadow-2xl hover:border-white/50 transition carousel-image mb-6">
            <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "1/1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photos[currentPhotoIndex]}
                alt={`Foto ${currentPhotoIndex + 1} de ${profile.displayName}`}
                className="absolute inset-0 h-full w-full object-cover animate-fade-in-scale"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

              <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between p-3 md:p-4">
                <p className="rounded-full border border-white/35 bg-black/55 px-3 py-1 text-xs font-bold text-white/95 backdrop-blur">
                  {currentPhotoIndex + 1}/{profile.photos.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev - 1 + profile.photos.length) % profile.photos.length)}
                    className="rounded-full border border-white/40 bg-black/55 px-3 py-2 text-xs font-semibold text-white backdrop-blur hover:bg-black/75 transition"
                    aria-label="Foto anterior"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length)}
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
                    {profile.displayName}
                  </h3>

                  <p className="text-3xl font-extrabold leading-none text-white/95 md:text-4xl">
                    {profile.age}
                  </p>

                  <p className="text-sm font-bold tracking-[0.08em] text-white/90">
                    {getFlagFromNationality(profile.nationality)} {profile.nationality.toUpperCase()}
                  </p>

                  <div className="grid justify-items-start gap-2">
                    <div className="w-fit max-w-full rounded-2xl border border-white/25 bg-black/35 px-3 py-2.5 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                        Disponibilidad
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white/90">{formatScheduleDisplay(profile.schedule)}</p>
                    </div>

                    <div className="w-fit max-w-full rounded-2xl border border-[#25D366]/45 bg-[#25D366]/15 px-3 py-2.5 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b7f9d1]">
                        Tarifa por hora
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#d9ffe8]">{getHourlyPriceLabel(profile.costText)}</p>
                    </div>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-2">
                    <a
                      href={whatsappHref(profile.whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whatsapp-cta inline-flex items-center justify-center rounded-full border border-[#25D366]/70 bg-gradient-to-r from-[#25D366] to-[#1ebe5d] px-3.5 py-2 text-xs font-bold text-[#04160a] transition hover:brightness-110 hover:shadow-lg hover:shadow-[#25D366]/40"
                    >
                      WhatsApp
                    </a>
                    <Link
                      href="/client"
                      className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/15 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/25"
                    >
                      Entrar
                    </Link>
                  </div>
                </div>
              </div>
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
                <div className="w-full h-full overflow-hidden bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Foto ${idx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Overlay hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition rounded-2xl" />
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

      {profile ? (
        <section id="galeria" className="mt-12 animate-fade-in-up">
          <div className="mt-0 grid gap-4">
            <div className="rounded-2xl border border-white/15 p-5 hover:border-white/30 transition">
              <p className="leading-7 text-white/85">{profile.treatmentStyle}</p>
            </div>
          </div>
        </section>
      ) : null}

      {profile && profile.videos.length > 0 ? (
        <section id="videos" className="mt-12 animate-fade-in-up">
          <h2 className="text-center font-[var(--font-heading)] font-bold text-5xl md:text-6xl">Videos</h2>
          <div className="mt-8 flex flex-col items-center gap-6">
            {profile.videos.map((video, idx) => (
              <article
                key={idx}
                className={`relative w-full overflow-hidden rounded-3xl border-2 border-white/25 bg-black/40 transition group shadow-lg hover:border-white/50 hover:shadow-xl hover:shadow-[var(--accent)]/20 ${
                  idx === 0
                    ? "max-w-5xl aspect-[4/3] sm:aspect-video lg:col-span-2 lg:row-span-2 lg:min-h-[34rem] xl:min-h-[36rem]"
                    : idx === 1
                      ? "max-w-3xl aspect-[4/3] sm:aspect-video lg:col-span-1 lg:min-h-[16rem]"
                      : "max-w-3xl aspect-[4/3] sm:aspect-video lg:col-span-1 lg:min-h-[16rem] xl:aspect-[16/9]"
                }`}
              >
                {(() => {
                  const player = getVideoRenderer(video);
                  if (player.kind === "iframe") {
                    return (
                      <iframe
                        src={player.src}
                        title={`Video ${idx + 1} de ${profile.displayName}`}
                        className="h-full w-full object-cover"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    );
                  }
                  return (
                    <video
                      src={player.src}
                      controls
                      className="h-full w-full object-cover"
                      preload="metadata"
                    />
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section id="confianza" className="mt-16 animate-fade-in-up text-center flex flex-col items-center gap-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Zona privada</p>
        <h2 className="font-[var(--font-heading)] font-bold text-4xl text-white md:text-5xl">Acceso para clientes</h2>
        <p className="max-w-sm text-sm leading-6 text-white/60">
          Crea tu cuenta y solicita acceso. Una vez aprobado por el administrador podras ver todos los detalles del perfil disponible.
        </p>
        <Link
          href="/client"
          className="inline-flex rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)]/85 px-8 py-3.5 text-sm font-bold text-[var(--accent-ink)] transition hover:brightness-110 hover:shadow-xl hover:shadow-[var(--accent)]/40"
        >
          Iniciar sesion / Registrarse
        </Link>
      </section>

      <footer className="mt-12 border-t border-white/10 py-6 text-center">
        <p className="text-xs text-white/35">© {new Date().getFullYear()} Agencia Aurora</p>
      </footer>

      <a
        href={profile ? whatsappHref(profile.whatsappNumber) : "https://wa.me/51999999999?text=Hola%2C%20quiero%20consultar%20la%20disponibilidad"}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="whatsapp-float-cta fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-[#25D366]/85 bg-[#25D366] text-lg font-black text-[#04160a] shadow-2xl shadow-[#25D366]/30 transition hover:scale-110 hover:brightness-110 md:bottom-6 md:right-6"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-7 w-7 fill-white"
        >
          <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.58 2 2.15 6.42 2.15 11.88c0 1.75.46 3.46 1.32 4.97L2 22l5.3-1.39a9.9 9.9 0 0 0 4.73 1.2h.01c5.45 0 9.88-4.43 9.88-9.88a9.8 9.8 0 0 0-2.87-7.02Zm-7.02 15.23h-.01a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.15.83.84-3.07-.2-.31a8.17 8.17 0 0 1-1.26-4.39c0-4.52 3.68-8.2 8.21-8.2 2.19 0 4.24.85 5.79 2.4a8.13 8.13 0 0 1 2.4 5.8c0 4.53-3.68 8.21-8.14 8.21Zm4.5-6.14c-.25-.13-1.47-.72-1.7-.8-.23-.08-.39-.13-.56.13-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06-.25-.13-1.04-.38-1.99-1.22-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.01-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.85-.2-.48-.4-.41-.56-.42h-.47c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.02 2.56.12.16 1.75 2.67 4.23 3.74.59.26 1.05.42 1.41.54.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.19.21-.59.21-1.1.14-1.19-.06-.1-.22-.16-.47-.29Z" />
        </svg>
      </a>
    </main>
  );
}
