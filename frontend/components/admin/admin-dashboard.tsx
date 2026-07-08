"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, ChangeEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  createProfile,
  deleteProfile,
  exportProfiles,
  importProfiles,
  listProfiles,
  resetProfiles,
  setProfileLanding,
  setProfileVisibility,
  updateProfile,
} from "@/frontend/lib/profile-indexeddb";
import {
  approveClient,
  approveClientPendingConsumption,
  listClients,
  rejectClientPendingConsumption,
  rejectClient,
  resetClientPassword,
} from "@/frontend/lib/client-indexeddb";
import {
  clearHeroCoverImage,
  readHeroCoverImage,
  saveHeroCoverImage,
} from "@/frontend/lib/landing-settings";
import { listRatingsByProfile } from "@/frontend/lib/rating-indexeddb";
import type { CreateProfileInput, Profile } from "@/shared/profile";
import type { Client } from "@/shared/client";
import type { Rating } from "@/shared/rating";

type FormState = {
  displayName: string;
  age: string;
  nationality: string;
  availableDate: string;
  availableFromTime: string;
  availableToTime: string;
  serviceDetails: string;
  treatmentStyle: string;
  costText: string;
  locationText: string;
  serviceTypeText: string;
  whatsappNumber: string;
  photosText: string;
  videosText: string;
  isVisible: boolean;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeInputValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function createScheduleLabel(dateValue: string, fromTimeValue: string, toTimeValue: string): string {
  const [year, month, day] = dateValue.split("-");
  return `Disponible el ${day}/${month}/${year} de ${fromTimeValue} a ${toTimeValue}`;
}

function parseScheduleToDateTimeRange(
  value: string,
): { date: string; fromTime: string; toTime: string } | null {
  const rangeMatch = value.match(/(\d{2})\/(\d{2})\/(\d{4}).*?de\s+(\d{2}:\d{2})\s+a\s+(\d{2}:\d{2})/i);
  if (rangeMatch) {
    const [, day, month, year, fromTime, toTime] = rangeMatch;
    return {
      date: `${year}-${month}-${day}`,
      fromTime,
      toTime,
    };
  }

  const legacyMatch = value.match(/(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}:\d{2})/);
  if (!legacyMatch) {
    return null;
  }

  const [, day, month, year, time] = legacyMatch;
  const [hoursPart = "00", minutesPart = "00"] = time.split(":");
  const startDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hoursPart), Number(minutesPart));
  const endDate = addHours(startDate, 1);

  return {
    date: `${year}-${month}-${day}`,
    fromTime: time,
    toTime: toTimeInputValue(endDate),
  };
}

function createInitialForm(): FormState {
  const now = new Date();

  return {
    displayName: "",
    age: "",
    nationality: "",
    availableDate: toDateInputValue(now),
    availableFromTime: toTimeInputValue(now),
    availableToTime: toTimeInputValue(addHours(now, 1)),
    serviceDetails: "",
    treatmentStyle: "",
    costText: "",
    locationText: "",
    serviceTypeText: "",
    whatsappNumber: "",
    photosText: "",
    videosText: "",
    isVisible: false,
  };
}

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isValidTimeRange(fromTime: string, toTime: string): boolean {
  return fromTime < toTime;
}

function isLikelyImageSource(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.startsWith("data:image/")) {
    return true;
  }

  return /\.(jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|svg)(\?|#|$)/.test(normalized);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("No se pudo leer el archivo."));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("No se pudo leer el archivo."));
    };
    reader.readAsDataURL(file);
  });
}

export function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<FormState>(createInitialForm());
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [editingId, setEditingId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [clientMessage, setClientMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [clientError, setClientError] = useState<string>("");
  const [ratingsByProfile, setRatingsByProfile] = useState<Record<string, Rating[]>>({});
  const [activeTab, setActiveTab] = useState<"perfiles" | "clientes" | "datos">("perfiles");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPwdClientId, setResetPwdClientId] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [heroCoverImage, setHeroCoverImage] = useState<string | null>(null);
  const [confirmUpdateInCard, setConfirmUpdateInCard] = useState(false);
  const photoItems = parseLines(form.photosText);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    const data = await listProfiles();
    setProfiles(data);

    const ratingMap: Record<string, Rating[]> = {};
    for (const profile of data) {
      ratingMap[profile.id] = await listRatingsByProfile(profile.id);
    }
    setRatingsByProfile(ratingMap);

    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    setClientLoading(true);
    const data = await listClients();
    setClients(data);
    setClientLoading(false);
  }, []);

  useEffect(() => {
    void fetchProfiles();
    void fetchClients();
    setHeroCoverImage(readHeroCoverImage());
  }, [fetchProfiles, fetchClients]);

  async function handleHeroCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const dataUrl = await fileToDataUrl(file);
      saveHeroCoverImage(dataUrl);
      setHeroCoverImage(dataUrl);
      setMessage("Portada principal actualizada.");
    } catch {
      setError("No se pudo cargar la portada principal.");
    }
  }

  function handleClearHeroCover() {
    clearHeroCoverImage();
    setHeroCoverImage(null);
    setError("");
    setMessage("Portada principal restablecida al diseño por defecto.");
  }

  function loadProfileIntoForm(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);

    if (!profile) {
      return;
    }

    setEditingId(profile.id);
    setConfirmUpdateInCard(false);
    setShowProfileForm(true);
    const scheduleParts = parseScheduleToDateTimeRange(profile.schedule);
    const now = new Date();
    const defaultFrom = toTimeInputValue(now);
    const defaultTo = toTimeInputValue(addHours(now, 1));

    setForm({
      displayName: profile.displayName,
      age: String(profile.age),
      nationality: profile.nationality,
      availableDate: scheduleParts?.date ?? toDateInputValue(now),
      availableFromTime: scheduleParts?.fromTime ?? defaultFrom,
      availableToTime: scheduleParts?.toTime ?? defaultTo,
      serviceDetails: profile.serviceDetails,
      treatmentStyle: profile.treatmentStyle,
      costText: profile.costText,
      locationText: profile.locationText,
      serviceTypeText: profile.serviceTypeText,
      whatsappNumber: profile.whatsappNumber,
      photosText: profile.photos.join("\n"),
      videosText: profile.videos.join("\n"),
      isVisible: profile.isVisible,
    });
  }

  function resetForm() {
    setEditingId("");
    setConfirmUpdateInCard(false);
    setForm(createInitialForm());
  }

  function handleOpenCreateProfile() {
    setError("");
    setMessage("");
    resetForm();
    setShowProfileForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCloseProfileForm() {
    resetForm();
    setShowProfileForm(false);
  }

  function buildProfilePayload(): CreateProfileInput {
    return {
      displayName: form.displayName,
      age: Number(form.age),
      nationality: form.nationality,
      schedule: createScheduleLabel(form.availableDate, form.availableFromTime, form.availableToTime),
      serviceDetails: form.serviceDetails,
      treatmentStyle: form.treatmentStyle,
      costText: form.costText,
      locationText: form.locationText,
      serviceTypeText: form.serviceTypeText,
      whatsappNumber: form.whatsappNumber,
      photos: parseLines(form.photosText),
      videos: parseLines(form.videosText),
      isVisible: form.isVisible,
    };
  }

  async function persistProfile(isEditing: boolean): Promise<void> {
    const payload = buildProfilePayload();

    try {
      if (isEditing && editingId) {
        await updateProfile(editingId, payload);
      } else {
        await createProfile(payload);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el perfil.");
      return;
    }

    resetForm();
    setShowProfileForm(false);
    setMessage(isEditing ? "Perfil actualizado correctamente." : "Perfil registrado correctamente.");
    await fetchProfiles();
  }

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const isEditing = Boolean(editingId);

    if (!isValidTimeRange(form.availableFromTime, form.availableToTime)) {
      setError("La hora de fin debe ser mayor que la hora de inicio.");
      return;
    }

    if (isEditing) {
      setConfirmUpdateInCard(true);
      return;
    }

    await persistProfile(false);
  }

  function handleCancelUpdateConfirmation() {
    setConfirmUpdateInCard(false);
    setMessage("Actualizacion cancelada.");
  }

  async function handleConfirmUpdateFromPopup() {
    if (!editingId) {
      setConfirmUpdateInCard(false);
      return;
    }

    setError("");
    setMessage("");

    if (!isValidTimeRange(form.availableFromTime, form.availableToTime)) {
      setError("La hora de fin debe ser mayor que la hora de inicio.");
      return;
    }

    setConfirmUpdateInCard(false);
    await persistProfile(true);
  }

  async function handleVisibility(id: string, isVisible: boolean) {
    setError("");
    setMessage("");

    try {
      await setProfileVisibility(id, isVisible);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo actualizar visibilidad.");
      return;
    }

    setMessage(isVisible ? "Perfil visible para clientes." : "Perfil ocultado para clientes.");
    await fetchProfiles();
  }

  async function handleSetLanding(id: string) {
    setError("");
    setMessage("");

    try {
      await setProfileLanding(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo destacar en landing.");
      return;
    }

    setMessage("Perfil destacado en landing principal.");
    await fetchProfiles();
  }

  async function handleDelete(id: string) {
    setError("");
    setMessage("");

    try {
      await deleteProfile(id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo eliminar el perfil.");
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    if (selectedId === id) {
      setSelectedId("");
    }

    setMessage("Perfil eliminado.");
    await fetchProfiles();
  }

  async function handleExport() {
    setError("");
    setMessage("");

    try {
      const profilesToExport = await exportProfiles();
      const blob = new Blob([JSON.stringify(profilesToExport, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "agencia-aurora-backup.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Respaldo exportado correctamente.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo exportar la base.");
    }
  }

  async function handleImport(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const content = await file.text();
      const importedProfiles = JSON.parse(content) as Profile[];
      await importProfiles(importedProfiles);
      setMessage("Respaldo importado correctamente.");
      await fetchProfiles();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo importar la base.");
    }
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;

    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setMessage("");

    const photoUrls: string[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const dataUrl = await fileToDataUrl(file);
        photoUrls.push(dataUrl);
      } catch (err) {
        console.error("Error reading file:", err);
        skipped.push(file.name);
      }
    }

    if (photoUrls.length > 0) {
      const currentPhotos = form.photosText.trim();
      const newPhotosText = currentPhotos
        ? currentPhotos + "\n" + photoUrls.join("\n")
        : photoUrls.join("\n");

      setForm((prev) => ({ ...prev, photosText: newPhotosText }));
      setMessage(
        skipped.length > 0
          ? `${photoUrls.length} foto(s) agregada(s). No se pudieron leer: ${skipped.join(", ")}`
          : `${photoUrls.length} foto(s) agregada(s)`,
      );
    } else {
      setError("No se pudieron leer los archivos seleccionados.");
    }

    event.currentTarget.value = "";
  }

  function handleRemovePhoto(index: number) {
    const nextPhotos = photoItems.filter((_, currentIndex) => currentIndex !== index);
    setForm((prev) => ({ ...prev, photosText: nextPhotos.join("\n") }));
    setError("");
    setMessage("Foto quitada de la lista.");
  }

  async function handleVideoUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;

    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setMessage("");

    const videoUrls: string[] = [];
    const skippedVideos: string[] = [];

    for (let i = 0; i < Math.min(files.length, 2); i++) {
      const file = files[i];
      try {
        const dataUrl = await fileToDataUrl(file);
        videoUrls.push(dataUrl);
      } catch (err) {
        console.error("Error reading file:", err);
        skippedVideos.push(file.name);
      }
    }

    if (videoUrls.length > 0) {
      const currentVideos = form.videosText.trim();
      const newVideosText = currentVideos
        ? currentVideos + "\n" + videoUrls.join("\n")
        : videoUrls.join("\n");

      setForm((prev) => ({ ...prev, videosText: newVideosText }));
      setMessage(
        skippedVideos.length > 0
          ? `${videoUrls.length} video(s) agregado(s). No se pudieron leer: ${skippedVideos.join(", ")}`
          : `${videoUrls.length} video(s) agregado(s)`,
      );
    } else {
      setError("No se pudieron leer los archivos seleccionados.");
    }

    event.currentTarget.value = "";
  }

  async function handleApproveClient(id: string) {
    setClientError("");
    setClientMessage("");

    try {
      await approveClient(id);
      setClientMessage("Cliente aprobado.");
      await fetchClients();
    } catch (approveError) {
      setClientError(approveError instanceof Error ? approveError.message : "No se pudo aprobar el cliente.");
    }
  }

  async function handleRejectClient(id: string) {
    setClientError("");
    setClientMessage("");

    try {
      await rejectClient(id);
      setClientMessage("Cliente rechazado.");
      await fetchClients();
    } catch (rejectError) {
      setClientError(rejectError instanceof Error ? rejectError.message : "No se pudo rechazar el cliente.");
    }
  }

  async function handleResetClientPassword(id: string) {
    if (!newPassword.trim()) {
      setClientError("Ingresa una nueva clave.");
      return;
    }

    setResetPwdClientId("");
    setClientError("");
    setClientMessage("");

    try {
      await resetClientPassword(id, newPassword);
      setNewPassword("");
      setClientMessage("Clave restablecida correctamente.");
      await fetchClients();
    } catch (passwordError) {
      setClientError(
        passwordError instanceof Error ? passwordError.message : "No se pudo restablecer la clave.",
      );
    }
  }

  async function handleApprovePendingConsumption(id: string) {
    setClientError("");
    setClientMessage("");

    try {
      const updatedClient = await approveClientPendingConsumption(id);
      if (updatedClient.totalConsumptions % 5 === 0) {
        setClientMessage("Consumo validado. Cliente desbloqueo un servicio gratis.");
      } else {
        setClientMessage("Consumo validado y sumado al cliente.");
      }
      await fetchClients();
    } catch (validationError) {
      setClientError(validationError instanceof Error ? validationError.message : "No se pudo validar el consumo.");
    }
  }

  async function handleRejectPendingConsumption(id: string) {
    setClientError("");
    setClientMessage("");

    try {
      await rejectClientPendingConsumption(id);
      setClientMessage("Solicitud de consumo rechazada.");
      await fetchClients();
    } catch (validationError) {
      setClientError(validationError instanceof Error ? validationError.message : "No se pudo rechazar la solicitud.");
    }
  }

  async function handleResetBase() {
    setError("");
    setMessage("");

    try {
      await resetProfiles();
      resetForm();
      setSelectedId("");
      setConfirmReset(false);
      await fetchProfiles();
      setMessage("Base local reiniciada correctamente.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo reiniciar la base.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <header className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/70">
            Panel de Administracion
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
            >
              Ver landing
            </Link>
            <Link
              href="/members"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 transition"
            >
              Ver zona clientes
            </Link>
          </div>
        </div>
        <h1 className="mt-3 font-[var(--font-heading)] font-extrabold text-5xl">Mantenimiento</h1>
        <p className="mt-4 max-w-3xl text-white/85">
          Gestiona perfiles, clientes y la base de datos. Solo un perfil puede estar visible a la
          vez.
        </p>
      </header>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-white/20 bg-white/8 px-5 py-4 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Perfiles</p>
          <p className="mt-1 text-3xl font-bold">{profiles.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-4 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
            Visible ahora
          </p>
          <p className="mt-1 truncate text-lg font-bold text-emerald-300">
            {profiles.find((p) => p.isVisible)?.displayName ?? "—"}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-5 py-4 backdrop-blur-sm ${
            clients.filter((c) => c.status === "pending").length > 0
              ? "border-amber-400/30 bg-amber-400/5"
              : "border-white/20 bg-white/8"
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Pendientes</p>
          <p
            className={`mt-1 text-3xl font-bold ${
              clients.filter((c) => c.status === "pending").length > 0 ? "text-amber-300" : ""
            }`}
          >
            {clients.filter((c) => c.status === "pending").length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/20 bg-white/8 px-5 py-4 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">Aprobados</p>
          <p className="mt-1 text-3xl font-bold">
            {clients.filter((c) => c.status === "approved").length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-2xl border border-white/20 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("perfiles")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "perfiles"
              ? "bg-white/15 text-white"
              : "text-white/55 hover:text-white/80"
          }`}
        >
          Perfiles
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/60">
            {profiles.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("clientes")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "clientes"
              ? "bg-white/15 text-white"
              : "text-white/55 hover:text-white/80"
          }`}
        >
          Clientes
          {clients.filter((c) => c.status === "pending").length > 0 ? (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-bold text-amber-200">
              {clients.filter((c) => c.status === "pending").length} pendientes
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/60">
              {clients.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("datos")}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === "datos" ? "bg-white/15 text-white" : "text-white/55 hover:text-white/80"
          }`}
        >
          Base de datos
        </button>
      </div>

      {/* ── TAB: PERFILES ── */}
      {activeTab === "perfiles" && (
        <>
          {showProfileForm ? (
          <section className="mt-6">
            {editingId && confirmUpdateInCard ? (
              <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
                <div className="w-full max-w-md rounded-2xl border border-white/20 bg-[#121212] p-5 shadow-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">Confirmar cambios</p>
                  <h3 className="mt-2 text-lg font-bold text-white">¿Actualizar este perfil?</h3>
                  <p className="mt-1 text-sm text-white/65">Esta accion guardara los cambios en el perfil actual.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmUpdateFromPopup}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-emerald-950 hover:brightness-110 transition"
                    >
                      Si, actualizar
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelUpdateConfirmation}
                      className="rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-rose-950 hover:brightness-110 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/20 px-4 py-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-white/60">
                  Vista previa y navegación
                </p>
                <p className="text-sm text-white/80">Revisa la landing pública o el acceso de cliente.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/"
                  target="_blank"
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition"
                >
                  Ver pantalla principal
                </Link>
                <Link
                  href="/client"
                  target="_blank"
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-ink)] hover:brightness-110 transition"
                >
                  Ver pantalla cliente
                </Link>
              </div>
            </div>

        <article className="mx-auto w-full max-w-3xl rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm md:p-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-[var(--font-heading)] font-bold text-3xl">
                {editingId ? "Editar perfil" : "Registrar perfil"}
              </h2>
              {editingId ? (
                <p className="mt-1 text-xs text-amber-300/80">
                  Editando: {profiles.find((p) => p.id === editingId)?.displayName}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleCloseProfileForm}
              className="shrink-0 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold"
            >
              {editingId ? "Cancelar" : "Cerrar"}
            </button>
          </div>
          <p className="mt-2 text-sm text-white/75">Fotos: sin limite maximo</p>

          <form className="mt-6 grid gap-6" onSubmit={handleCreateProfile}>
            {/* Identidad */}
            <div className="grid gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Identidad
              </p>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/65">Nombre visible</label>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="Ej: Aurora"
                  className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">Edad</label>
                  <input
                    value={form.age}
                    onChange={(event) => setForm((prev) => ({ ...prev, age: event.target.value }))}
                    placeholder="Ej: 22"
                    type="number"
                    min={18}
                    max={65}
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">Nacionalidad</label>
                  <input
                    value={form.nationality}
                    onChange={(event) => setForm((prev) => ({ ...prev, nationality: event.target.value }))}
                    placeholder="Ej: Peruana"
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/65">Horario disponible</label>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-white/50">Fecha</label>
                    <input
                      value={form.availableDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, availableDate: event.target.value }))}
                      type="date"
                      className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-white/50">Desde</label>
                    <input
                      value={form.availableFromTime}
                      onChange={(event) => setForm((prev) => ({ ...prev, availableFromTime: event.target.value }))}
                      type="time"
                      className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-[11px] font-semibold text-white/50">Hasta</label>
                    <input
                      value={form.availableToTime}
                      onChange={(event) => setForm((prev) => ({ ...prev, availableToTime: event.target.value }))}
                      type="time"
                      className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                      required
                    />
                  </div>
                </div>
                <p className="text-xs text-white/45">
                  Se registra como: {createScheduleLabel(form.availableDate, form.availableFromTime, form.availableToTime)}
                </p>
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Presentacion */}
            <div className="grid gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Presentacion
              </p>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/65">Detalles del servicio</label>
                <textarea
                  value={form.serviceDetails}
                  onChange={(event) => setForm((prev) => ({ ...prev, serviceDetails: event.target.value }))}
                  placeholder="Describe los servicios ofrecidos..."
                  className="min-h-[72px] rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-white/65">Estilo de trato</label>
                <textarea
                  value={form.treatmentStyle}
                  onChange={(event) => setForm((prev) => ({ ...prev, treatmentStyle: event.target.value }))}
                  placeholder="Describe el tipo de trato y atencion..."
                  className="min-h-[72px] rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                  required
                />
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Comercial */}
            <div className="grid gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
                Informacion comercial
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">Costo</label>
                  <input
                    value={form.costText}
                    onChange={(event) => setForm((prev) => ({ ...prev, costText: event.target.value }))}
                    placeholder="Ej: Desde S/ 450 por 2 horas"
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">WhatsApp</label>
                  <input
                    value={form.whatsappNumber}
                    onChange={(event) => setForm((prev) => ({ ...prev, whatsappNumber: event.target.value }))}
                    placeholder="Ej: 51999999999"
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">Ubicacion</label>
                  <input
                    value={form.locationText}
                    onChange={(event) => setForm((prev) => ({ ...prev, locationText: event.target.value }))}
                    placeholder="Ej: Miraflores, San Isidro"
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-white/65">Tipo de servicio</label>
                  <input
                    value={form.serviceTypeText}
                    onChange={(event) => setForm((prev) => ({ ...prev, serviceTypeText: event.target.value }))}
                    placeholder="Ej: Night lounge, rooftop VIP"
                    className="rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Medios */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">Medios</p>
                <p className="text-[11px] text-white/40">Fotos sin limite · 1–2 videos</p>
              </div>

              {/* Fotos — entrada unificada */}
              <div className="rounded-2xl border border-white/15 bg-black/20 p-4">
                <p className="text-xs font-bold text-white/70 mb-3">📷 Fotos</p>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-white/55">Pega URLs (una por línea)</label>
                    <textarea
                      value={form.photosText}
                      onChange={(event) => setForm((prev) => ({ ...prev, photosText: event.target.value }))}
                      placeholder="https://ejemplo.com/foto1.jpg&#10;https://ejemplo.com/foto2.jpg"
                      className="min-h-[80px] rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-mono"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-white/35">o sube desde tu dispositivo</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="grid gap-1">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.webp,.jpg,.jpeg,.png,.gif,.svg"
                      onChange={(event) => void handlePhotoUpload(event)}
                      className="block w-full cursor-pointer rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-3 text-sm text-white/60 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[var(--accent-ink)]"
                    />
                    <p className="text-xs text-white/35">JPG, PNG, WebP, HEIC y más · puedes subir muchas fotos</p>
                  </div>

                  {photoItems.length > 0 ? (
                    <div className="rounded-xl border border-white/15 bg-white/5 p-3">
                      <p className="text-xs font-semibold text-white/70">
                        Fotos cargadas ({photoItems.length})
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {photoItems.map((photo, index) => (
                          <article
                            key={`${photo.slice(0, 24)}-${index}`}
                            className="rounded-xl border border-white/15 bg-black/20 p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[11px] font-semibold text-white/60">Foto {index + 1}</p>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(index)}
                                className="rounded-full border border-rose-300/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold text-rose-200"
                              >
                                Quitar
                              </button>
                            </div>

                            {isLikelyImageSource(photo) ? (
                              <div className="mt-2 overflow-hidden rounded-lg border border-white/10 bg-black/25">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photo}
                                  alt={`Vista previa foto ${index + 1}`}
                                  className="h-28 w-full object-contain bg-black/35"
                                  loading="lazy"
                                />
                              </div>
                            ) : null}

                            <p className="mt-2 line-clamp-2 break-all text-[11px] text-white/45">{photo}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Videos — entrada unificada */}
              <div className="rounded-2xl border border-white/15 bg-black/20 p-4">
                <p className="text-xs font-bold text-white/70 mb-3">🎬 Videos</p>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-xs font-semibold text-white/55">Pega URLs (una por línea)</label>
                    <textarea
                      value={form.videosText}
                      onChange={(event) => setForm((prev) => ({ ...prev, videosText: event.target.value }))}
                      placeholder="https://ejemplo.com/video1.mp4"
                      className="min-h-[64px] rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-sm font-mono"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-white/35">o sube desde tu dispositivo</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <div className="grid gap-1">
                    <input
                      type="file"
                      multiple
                      accept="video/*"
                      onChange={(event) => void handleVideoUpload(event)}
                      className="block w-full cursor-pointer rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-3 text-sm text-white/60 file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-bold file:text-[var(--accent-ink)]"
                    />
                    <p className="text-xs text-white/35">Link directo, YouTube o archivo local · máx. 2 videos</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10" />

            {/* Visibilidad toggle */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white/85">Habilitar perfil ahora</p>
                <p className="text-xs text-white/45">
                  Al activar, se desactivan los demas perfiles.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={form.isVisible}
                  onChange={(event) => setForm((prev) => ({ ...prev, isVisible: event.target.checked }))}
                  className="peer sr-only"
                />
                <div className="relative h-6 w-11 rounded-full bg-white/20 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-5" />
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[var(--accent-ink)] hover:brightness-110 transition"
            >
              {editingId ? "Guardar cambios" : "Guardar perfil nuevo"}
            </button>

            {message ? (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                <p className="text-sm text-emerald-300">{message}</p>
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            ) : null}
          </form>
        </article>

      </section>
          ) : null}

      {/* Profiles list — inside perfiles tab */}
      <section className="mt-8 rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-[var(--font-heading)] font-bold text-3xl">
            Perfiles registrados ({profiles.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenCreateProfile}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-ink)]"
            >
              Agregar perfil
            </button>
            <button
              type="button"
              onClick={() => void fetchProfiles()}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Refrescar
            </button>
          </div>
        </div>

        {!showProfileForm && message ? (
          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
            <p className="text-sm text-emerald-300">{message}</p>
          </div>
        ) : null}
        {!showProfileForm && error ? (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <p className="mt-6 text-white/65">Cargando perfiles...</p>
        ) : profiles.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/20 p-8 text-center">
            <p className="text-white/50">No hay perfiles registrados.</p>
            <p className="mt-1 text-sm text-white/35">
              Usa el formulario de arriba para registrar el primer perfil.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className={`rounded-2xl border p-4 shadow-xl backdrop-blur-sm ${
                  profile.isVisible
                    ? "border-emerald-400/30 bg-emerald-400/5"
                    : "border-white/20 bg-black/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-[var(--font-heading)] text-2xl">
                      {profile.displayName}
                    </h3>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                      profile.isVisible
                        ? "bg-emerald-500/25 text-emerald-200"
                        : "bg-white/10 text-white/60"
                    }`}
                  >
                    {profile.isVisible ? "Visible" : "Oculta"}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-white/65">
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                    {profile.age} anos
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                    {profile.nationality}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                    {profile.locationText}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
                    {profile.photos.length} fotos · {profile.videos.length} videos
                  </span>
                </div>

                {profile.photos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {profile.photos.slice(0, 4).map((photo, index) => (
                      <div
                        key={`${profile.id}-photo-${index}`}
                        className="overflow-hidden rounded-lg border border-white/10 bg-black/20"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo}
                          alt={`Foto ${index + 1} de ${profile.displayName}`}
                          className="h-14 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {ratingsByProfile[profile.id] && ratingsByProfile[profile.id].length > 0 ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      Calificaciones ({ratingsByProfile[profile.id].length})
                    </p>
                    <div className="mt-1.5 grid gap-1">
                      {ratingsByProfile[profile.id].slice(0, 3).map((rating) => (
                        <div key={rating.id} className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11px] text-white/60">{rating.clientName}</p>
                          <p className="shrink-0 text-xs text-amber-300">
                            {"★".repeat(rating.stars)}
                            {"☆".repeat(5 - rating.stars)}
                          </p>
                        </div>
                      ))}
                      {ratingsByProfile[profile.id].length > 3 ? (
                        <p className="text-[10px] text-white/40">
                          +{ratingsByProfile[profile.id].length - 3} mas
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loadProfileIntoForm(profile.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold"
                    >
                      Editar
                    </button>
                    <label
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                        profile.isVisible
                          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                          : "border-white/25 bg-white/10 text-white/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={profile.isVisible}
                        onChange={(event) =>
                          void handleVisibility(profile.id, event.target.checked)
                        }
                        className="sr-only"
                      />
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          profile.isVisible ? "bg-emerald-400" : "bg-white/30"
                        }`}
                      />
                      {profile.isVisible ? "Para clientes ✓" : "Para clientes"}
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleSetLanding(profile.id)}
                    className={`w-full rounded-full border px-4 py-2 text-xs font-semibold transition-all ${
                      profile.isLanding
                        ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                        : "border-white/20 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {profile.isLanding ? "⭐ En landing" : "Destacar en landing"}
                  </button>

                  {confirmDeleteId === profile.id ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDelete(profile.id)}
                        className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
                      >
                        Confirmar eliminacion
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId("")}
                        className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(profile.id)}
                      className="w-full rounded-full border border-rose-300/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200/80"
                    >
                      Eliminar perfil
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
    )}

      {/* ── TAB: CLIENTES ── */}
      {activeTab === "clientes" && (
        <section className="mt-6 rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-heading)] font-bold text-3xl">
                Clientes registrados
              </h2>
              <p className="mt-1 text-sm text-white/65">
                Gestiona aprobaciones, rechazos y claves de acceso.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchClients()}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              Refrescar
            </button>
          </div>

          {clientMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
              <p className="text-sm text-emerald-300">{clientMessage}</p>
            </div>
          ) : null}
          {clientError ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
              <p className="text-sm text-rose-300">{clientError}</p>
            </div>
          ) : null}

          {clientLoading ? (
            <p className="mt-6 text-white/65">Cargando clientes...</p>
          ) : clients.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/20 p-8 text-center">
              <p className="text-white/50">No hay clientes registrados todavia.</p>
            </div>
          ) : (
            <>
              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-amber-200">
                  {clients.filter((c) => c.status === "pending").length} pendientes
                </span>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-200">
                  {clients.filter((c) => c.status === "approved").length} aprobados
                </span>
                <span className="rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-rose-200">
                  {clients.filter((c) => c.status === "rejected").length} rechazados
                </span>
                <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-sky-200">
                  {clients.reduce((total, client) => total + client.pendingConsumptionValidations, 0)} consumos por validar
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {clients.map((client) => {
                  const statusLabel =
                    client.status === "approved"
                      ? "Aprobado"
                      : client.status === "rejected"
                        ? "Rechazado"
                        : "Pendiente";
                  const statusStyle =
                    client.status === "approved"
                      ? "bg-emerald-500/20 text-emerald-200"
                      : client.status === "rejected"
                        ? "bg-rose-500/20 text-rose-200"
                        : "bg-amber-500/20 text-amber-200";

                  return (
                    <article
                      key={client.id}
                      className="rounded-2xl border border-white/20 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-[var(--font-heading)] text-xl">
                            {client.fullName}
                          </h3>
                          <p className="mt-0.5 truncate text-sm text-white/60">{client.email}</p>
                          <p className="text-sm text-white/50">{client.phone}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusStyle}`}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApproveClient(client.id)}
                          className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-ink)]"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectClient(client.id)}
                          className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetPwdClientId(client.id);
                            setNewPassword("");
                            setClientError("");
                          }}
                          className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold"
                        >
                          Cambiar clave
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleApprovePendingConsumption(client.id)}
                          disabled={client.pendingConsumptionValidations === 0}
                          className="rounded-full border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40"
                        >
                          Validar consumo
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectPendingConsumption(client.id)}
                          disabled={client.pendingConsumptionValidations === 0}
                          className="rounded-full border border-rose-300/35 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-200 disabled:opacity-40"
                        >
                          Rechazar consumo
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                          <p className="text-white/45">Consumos</p>
                          <p className="text-sm font-bold text-white">{client.totalConsumptions}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                          <p className="text-white/45">Puntos</p>
                          <p className="text-sm font-bold text-white">{client.loyaltyPoints}</p>
                        </div>
                        <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 px-2 py-1.5">
                          <p className="text-amber-200/70">Gratis</p>
                          <p className="text-sm font-bold text-amber-200">{client.freeServicesAvailable}</p>
                        </div>
                        <div className="rounded-lg border border-sky-300/20 bg-sky-500/10 px-2 py-1.5">
                          <p className="text-sky-200/70">Por validar</p>
                          <p className="text-sm font-bold text-sky-200">{client.pendingConsumptionValidations}</p>
                        </div>
                      </div>

                      {resetPwdClientId === client.id ? (
                        <div className="mt-3 flex gap-2">
                          <input
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Nueva clave..."
                            type="password"
                            className="flex-1 rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => void handleResetClientPassword(client.id)}
                            className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--accent-ink)]"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetPwdClientId("");
                              setNewPassword("");
                            }}
                            className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold"
                          >
                            X
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── TAB: DATOS ── */}
      {activeTab === "datos" && (
        <section className="mt-6 rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm">
          <h2 className="font-[var(--font-heading)] font-bold text-3xl">Base de datos local</h2>
          <p className="mt-2 text-sm text-white/65">
            Exporta una copia de seguridad, importa desde un respaldo anterior, o reinicia la base
            al estado inicial.
          </p>

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-5">
            <p className="font-semibold">Portada principal de la landing</p>
            <p className="mt-1 text-sm text-white/55">
              Esta imagen solo se usa en el hero de portada y no afecta las fotos de perfiles.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <label className="flex w-full cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold">
                Subir imagen de portada
                <input
                  type="file"
                  accept="image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.webp,.jpg,.jpeg,.png,.gif,.svg"
                  className="hidden"
                  onChange={(event) => void handleHeroCoverUpload(event)}
                />
              </label>
              <button
                type="button"
                onClick={handleClearHeroCover}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold"
              >
                Usar portada por defecto
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-white/15 bg-black/25">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroCoverImage ?? "/agency/hero-model.svg"}
                alt="Vista previa de portada principal"
                className="h-48 w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
              <p className="text-sm text-emerald-300">{message}</p>
            </div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3">
              <p className="text-sm text-rose-300">{error}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <p className="font-semibold">Exportar respaldo</p>
              <p className="mt-1 text-sm text-white/55">
                Descarga un archivo JSON con todos los perfiles actuales.
              </p>
              <button
                type="button"
                onClick={() => void handleExport()}
                className="mt-4 w-full rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold"
              >
                Descargar JSON
              </button>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <p className="font-semibold">Importar respaldo</p>
              <p className="mt-1 text-sm text-white/55">
                Carga un JSON exportado previamente para restaurar perfiles.
              </p>
              <label className="mt-4 flex w-full cursor-pointer items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold">
                Seleccionar archivo
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-rose-300/20 bg-rose-500/5 p-5">
              <p className="font-semibold text-rose-200/90">Reiniciar base</p>
              <p className="mt-1 text-sm text-white/55">
                Elimina todos los perfiles y restaura solo el perfil de ejemplo inicial.
              </p>
              {confirmReset ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResetBase()}
                    className="flex-1 rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="mt-4 w-full rounded-full border border-rose-300/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100"
                >
                  Reiniciar base
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
