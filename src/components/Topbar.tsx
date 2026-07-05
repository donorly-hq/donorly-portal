"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { OrgChoice } from "@/lib/types";
import { Button, cn } from "./ui";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const { session, logout, switchOrg } = useAuth();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgChoice[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  // Load the user's memberships once; the switcher only appears for multi-org users.
  useEffect(() => {
    if (!session || session.platformAdmin) return;
    api
      .get<OrgChoice[]>("/auth/my-organizations")
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, [session?.userId, session?.platformAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === session?.organizationId) {
      setMenuOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchOrg(organizationId);
      // Hard reload so every page remounts against the new tenant.
      window.location.href = "/dashboard";
    } catch {
      setSwitching(false);
      setMenuOpen(false);
    }
  };

  const multiOrg = orgs.length > 1;

  return (
    <header className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg p-2 text-emerald hover:bg-emerald-50 lg:hidden"
          onClick={onMenu}
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="relative">
          <button
            type="button"
            disabled={!multiOrg}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "rounded-lg text-left",
              multiOrg && "px-2 py-1 -mx-2 -my-1 transition hover:bg-emerald-50",
            )}
          >
            <p className="flex items-center gap-1 text-sm font-semibold text-emerald">
              {session?.organizationName ?? "Donorly"}
              {multiOrg ? <span className="text-xs text-black/40">▾</span> : null}
            </p>
            {session?.roleCode ? (
              <p className="text-xs capitalize text-black/40">
                {session.roleCode.replace(/_/g, " ")}
              </p>
            ) : null}
          </button>

          {menuOpen && multiOrg ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
                <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-black/40">
                  Your organizations
                </p>
                {orgs.map((org) => {
                  const active = org.organizationId === session?.organizationId;
                  return (
                    <button
                      key={org.organizationId}
                      type="button"
                      disabled={switching}
                      onClick={() => handleSwitch(org.organizationId)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition disabled:opacity-50",
                        active ? "bg-emerald-100" : "hover:bg-emerald-50",
                      )}
                    >
                      {org.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={org.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded bg-emerald-100 font-serif text-base font-bold text-emerald">
                          {org.name.charAt(0)}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-black/80">
                          {org.name}
                        </span>
                        {org.roleName ? (
                          <span className="block text-xs text-black/50">{org.roleName}</span>
                        ) : null}
                      </span>
                      {active ? <span className="text-xs font-semibold text-emerald">Current</span> : null}
                    </button>
                  );
                })}
              </div>
            </>
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
