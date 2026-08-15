"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Suggestion } from "@/lib/types";
import { Card, cn } from "@/components/ui";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-emerald",
};

/**
 * Donorly's signature card: rule-based suggestions with one-click actions.
 * Dismissing snoozes a suggestion server-side for 30 days. When AI is enabled
 * the latest org insight is shown as a natural-language summary on top.
 */
export function AiSuggestionsCard() {
  const { hasPermission } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    api.get<Suggestion[]>("/dashboard/suggestions").then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  const canUseAi = hasPermission("ai.use");
  useEffect(() => {
    if (!canUseAi) return;
    // 204 (no insight yet) resolves to undefined — simply show nothing.
    api.get<{ insight: string } | undefined>("/ai/insights/org")
      .then((res) => setAiSummary(res?.insight ?? null))
      .catch(() => {});
  }, [canUseAi]);

  const dismiss = (key: string) => {
    setSuggestions((prev) => prev?.filter((s) => s.key !== key) ?? null);
    api.post("/dashboard/suggestions/dismiss", { key }).catch(() => {});
  };

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 border-b border-black/5 px-5 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2zm7 12l.9 2.6L22.5 18l-2.6.9-.9 2.6-.9-2.6L15.5 18l2.6-.9.9-2.6z" />
          </svg>
        </span>
        <p className="text-sm font-semibold text-black/70">Suggestions</p>
      </div>

      {aiSummary && (
        <p className="border-b border-black/5 bg-emerald-50/40 px-5 py-3 text-xs leading-relaxed text-black/60">
          {aiSummary}
        </p>
      )}

      <ul className="divide-y divide-black/5">
        {suggestions.map((s) => (
          <li key={s.key} className="group px-5 py-3">
            <div className="flex items-start gap-2.5">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", SEVERITY_DOT[s.severity] ?? "bg-black/20")} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-black/80">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-black/50">{s.message}</p>
                <div className="mt-1.5 flex items-center gap-3">
                  {s.actionRoute && s.actionLabel && (
                    <Link href={s.actionRoute} className="text-xs font-semibold text-emerald hover:underline">
                      {s.actionLabel}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => dismiss(s.key)}
                    className="text-xs text-black/30 transition hover:text-black/60"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
