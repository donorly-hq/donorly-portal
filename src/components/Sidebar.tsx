"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "./ui";

interface NavItem {
  label: string;
  href: string;
  permission?: string;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    heading: "Home",
    items: [{ label: "Dashboard", href: "/dashboard" }],
  },
  {
    heading: "People",
    items: [{ label: "Donors", href: "/donors", permission: "donors.read" }],
  },
  {
    heading: "Fundraising",
    items: [
      { label: "Campaigns", href: "/campaigns", permission: "campaigns.read" },
      { label: "Follow-ups", href: "/follow-ups", permission: "followups.read" },
      { label: "Pledge cards", href: "/pledge-cards", permission: "pledges.read" },
    ],
  },
  {
    heading: "Finance",
    items: [
      { label: "Payments", href: "/payments", permission: "payments.manage" },
      { label: "Reports", href: "/reports", permission: "reports.view" },
    ],
  },
  {
    heading: "Events",
    items: [
      { label: "Events", href: "/events", permission: "events.read" },
      { label: "Townhalls", href: "/townhalls", permission: "townhalls.read" },
      { label: "My shifts", href: "/my-shifts", permission: "volunteers.read" },
    ],
  },
  {
    heading: "Outreach",
    items: [{ label: "Communications", href: "/communications", permission: "communications.read" }],
  },
  {
    heading: "AI & Insights",
    items: [{ label: "AI Assistant", href: "/insights", permission: "ai.use" }],
  },
  {
    heading: "Administration",
    items: [{ label: "Team", href: "/settings/team", permission: "users.manage" }],
  },
  {
    heading: "Platform",
    items: [{ label: "Organizations", href: "/platform/organizations", permission: "platform.organizations.manage" }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <nav className="flex h-full w-64 flex-col bg-emerald-dark text-white/90">
      <div className="px-6 py-5">
        <span className="font-serif text-2xl font-bold text-white">Donorly</span>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((group) => {
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
