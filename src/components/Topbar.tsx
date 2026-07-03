"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "./ui";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { session, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <header className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-2 text-emerald hover:bg-emerald/5 lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div>
          <p className="text-sm font-semibold text-emerald">
            {session?.organizationName ?? "Donorly"}
          </p>
          {session?.roleCode ? (
            <p className="text-xs capitalize text-black/40">
              {session.roleCode.replace(/_/g, " ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-black/60 sm:inline">{session?.fullName}</span>
        <Button variant="secondary" onClick={handleLogout}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
