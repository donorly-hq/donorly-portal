"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Spinner } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return <Spinner />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Org logo watermark — fixed, behind all content */}
      {session.organizationLogo && (
        <div
          className="fixed inset-0 pointer-events-none select-none"
          style={{
            backgroundImage: `url(${session.organizationLogo})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center center",
            backgroundSize: "38%",
            opacity: 0.06,
            filter: "grayscale(100%)",
            zIndex: 0,
          }}
          aria-hidden
        />
      )}

      <div className="hidden lg:block relative z-10">
        <Sidebar />
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Topbar onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
