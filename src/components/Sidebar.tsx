"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { readableBrandBg } from "@/lib/color";
import { cn } from "./ui";

interface NavItem {
  label: string;
  href: string;
  permission?: string;
  /** Module parked while each module is groomed one by one — remove the flag to re-enable. */
  disabled?: boolean;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
  /** If true, this group requires an org context — hidden for platform admins */
  orgScoped?: boolean;
}

const NAV: NavGroup[] = [
  {
    heading: "Home",
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    heading: "My work",
    orgScoped: true,
    items: [{ label: "My Shift", href: "/my-shift", permission: "followups.read" }],
  },
  {
    heading: "People",
    orgScoped: true,
    items: [{ label: "Donors", href: "/donors", permission: "donors.read" }],
  },
  {
    heading: "Fundraising",
    orgScoped: true,
    items: [
      { label: "Campaigns",    href: "/campaigns",    permission: "campaigns.read", disabled: true },
      { label: "Quick pledge", href: "/quick-pledge", permission: "pledges.write" },
      { label: "Follow-ups",   href: "/follow-ups",   permission: "followups.read" },
      { label: "Pledge cards", href: "/pledge-cards", permission: "pledges.read" },
    ],
  },
  {
    heading: "Finance",
    orgScoped: true,
    items: [
      { label: "Payments", href: "/payments", permission: "payments.manage", disabled: true },
      { label: "Reports",  href: "/reports",  permission: "reports.view", disabled: true },
    ],
  },
  {
    heading: "Events",
    orgScoped: true,
    items: [
      { label: "Events",    href: "/events",    permission: "events.read", disabled: true },
      { label: "Townhalls", href: "/townhalls", permission: "townhalls.read", disabled: true },
      { label: "My shifts", href: "/my-shifts", permission: "volunteers.read", disabled: true },
      { label: "Inventory", href: "/inventory", permission: "inventory.read", disabled: true },
    ],
  },
  {
    heading: "Outreach",
    orgScoped: true,
    items: [{ label: "Communications", href: "/communications", permission: "communications.read" }],
  },
  {
    heading: "AI & Insights",
    orgScoped: true,
    items: [{ label: "AI Assistant", href: "/insights", permission: "ai.use" }],
  },
  {
    heading: "Administration",
    orgScoped: true,
    items: [
      { label: "Team", href: "/settings/team", permission: "users.manage" },
      { label: "Audit log", href: "/settings/audit", permission: "org.settings.manage", disabled: true },
    ],
  },
  {
    heading: "Platform",
    items: [{ label: "Organizations", href: "/platform/organizations", permission: "platform.organizations.manage" }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { session, hasPermission } = useAuth();
  const isPlatformAdmin = session?.platformAdmin === true;

  // Org-specific primary color when available, darkened if needed so white
  // nav text stays readable (WCAG AA); falls back to brand emerald-dark.
  const sidebarBg = readableBrandBg(session?.organizationPrimaryColor);

  return (
    <nav
      className="flex h-full w-64 flex-col text-white/90"
      style={{ backgroundColor: sidebarBg }}
    >
      <div className="px-6 py-5">
        <span className="font-serif text-2xl font-bold text-white">Donorly</span>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => {
          // Platform admins have no org context — hide all org-scoped groups
          if (isPlatformAdmin && group.orgScoped) return null;

          const visible = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.heading}>
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                {group.heading}
              </p>
              {visible.map((item) => {
                if (item.disabled) {
                  return (
                    <span
                      key={item.href}
                      title="Temporarily disabled"
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white/30"
                    >
                      {item.label}
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/40">
                        soon
                      </span>
                    </span>
                  );
                }
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-white/15 text-white" : "hover:bg-white/10",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
