"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AdminDashboard } from "@/frontend/components/admin/admin-dashboard";
import { readSession } from "@/frontend/lib/auth-session";

export default function AdminPage() {
  const router = useRouter();
  const session = readSession();
  const isAuthorized = session?.role === "admin";

  useEffect(() => {
    if (!isAuthorized) {
      router.replace("/client");
    }
  }, [isAuthorized, router]);

  if (!isAuthorized) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-20 md:px-10">
        <section className="rounded-3xl border border-white/20 bg-white/10 p-10 backdrop-blur-sm">
          <p className="text-white/75">Redirigiendo al acceso...</p>
        </section>
      </main>
    );
  }

  return <AdminDashboard />;
}
