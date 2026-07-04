"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminDashboard } from "@/frontend/components/admin/admin-dashboard";
import { readSession } from "@/frontend/lib/auth-session";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const session = readSession();
    const isAdmin = session?.role === "admin";
    setAuthorized(isAdmin);
    if (!isAdmin) {
      router.replace("/client");
    }
  }, [router]);

  if (authorized === null) {
    return (
      <main className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
        <section className="rounded-3xl border border-white/20 bg-white/8 p-6 backdrop-blur-sm md:p-8">
          <p className="text-white/75">Verificando acceso...</p>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return null;
  }

  return <AdminDashboard />;
}
