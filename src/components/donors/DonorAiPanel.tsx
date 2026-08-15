"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DonorDetail } from "@/lib/types";
import { Badge, Button, Card, currency } from "@/components/ui";

const DAY_MS = 24 * 60 * 60 * 1000;

interface Signal {
  key: string;
  label: string;
  tone: "success" | "warning" | "info" | "gold" | "neutral";
  detail: string;
}

/**
 * Rule-based donor intelligence computed from data the page already loaded
 * (payments, pledges, follow-ups) — the AI philosophy's "Observe → Discover"
 * steps without an extra request.
 */
function computeSignals(detail: DonorDetail): Signal[] {
  const { donor, payments, pledges, followUps } = detail;
  const now = Date.now();
  const signals: Signal[] = [];

  const paymentTimes = payments
    .map((p) => new Date(p.paymentDate).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a);
  const lastPayment = paymentTimes[0];
  const paymentsLastYear = paymentTimes.filter((t) => now - t < 365 * DAY_MS).length;

  if (paymentsLastYear >= 3) {
    signals.push({
      key: "recurring", label: "Likely recurring donor", tone: "success",
      detail: `${paymentsLastYear} donations in the last 12 months — consider inviting them to a recurring pledge.`,
    });
  }

  const avgGift = payments.length > 0 ? donor.lifetimeGiving / payments.length : 0;
  if (donor.lifetimeGiving >= 5000 || avgGift >= 500) {
    signals.push({
      key: "major", label: "Potential major donor", tone: "gold",
      detail: `${currency(donor.lifetimeGiving)} lifetime giving${avgGift > 0 ? ` (avg ${currency(avgGift)} per gift)` : ""}.`,
    });
  }

  if (donor.lifetimeGiving > 0 && lastPayment != null && now - lastPayment > 180 * DAY_MS) {
    signals.push({
      key: "lapsed", label: "Has stopped donating", tone: "warning",
      detail: `Last donation was ${Math.floor((now - lastPayment) / (30 * DAY_MS))} months ago. A personal touch often re-engages past givers.`,
    });
  }

  const openBalance = pledges
    .filter((p) => p.status === "pending" || p.status === "active")
    .reduce((sum, p) => sum + Math.max(0, p.amount - p.collectedAmount), 0);
  if (openBalance > 0) {
    signals.push({
      key: "balance", label: "Open pledge balance", tone: "info",
      detail: `${currency(openBalance)} pledged but not yet collected.`,
    });
  }

  const hasOpenFollowUp = followUps.some((f) => f.status === "open");
  const staleContact = lastPayment == null || now - lastPayment > 90 * DAY_MS;
  if (!hasOpenFollowUp && staleContact && donor.status === "active") {
    signals.push({
      key: "needs-contact", label: "No planned contact", tone: "neutral",
      detail: "No open follow-up is scheduled for this donor.",
    });
  }

  return signals;
}

export function DonorAiPanel({ detail, onChanged }: { detail: DonorDetail; onChanged: () => void }) {
  const { hasPermission } = useAuth();
  const canUseAi = hasPermission("ai.use");
  const canFollowUp = hasPermission("followups.write");
  const donorId = detail.donor.id;

  const signals = useMemo(() => computeSignals(detail), [detail]);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseAi) return;
    api.get<{ insight: string } | undefined>(`/ai/insights/donor/${donorId}`)
      .then((res) => setAiSummary(res?.insight ?? null))
      .catch(() => {});
  }, [canUseAi, donorId]);

  const generateSummary = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<{ insight: string }>(`/ai/insights/donor/${donorId}`);
      setAiSummary(res.insight);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate summary");
    } finally {
      setGenerating(false);
    }
  };

  // Approve-to-execute: the recommendation only becomes a FollowUp on click.
  const scheduleFollowUp = async () => {
    setScheduling(true);
    setError(null);
    try {
      await api.post("/follow-ups", {
        donorId,
        dueAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
        notes: "Suggested re-engagement follow-up (from donor intelligence panel)",
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not schedule follow-up");
    } finally {
      setScheduling(false);
    }
  };

  const showScheduleCta = canFollowUp && signals.some((s) => s.key === "needs-contact" || s.key === "lapsed");

  if (!canUseAi && signals.length === 0) return null;

  return (
    <Card className="border-emerald/15 bg-gradient-to-br from-emerald-50/60 to-white">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald text-white">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2zm7 12l.9 2.6L22.5 18l-2.6.9-.9 2.6-.9-2.6L15.5 18l2.6-.9.9-2.6z" />
            </svg>
          </span>
          <h3 className="font-semibold text-emerald">Donor intelligence</h3>
        </div>
        {canUseAi && (
          <Button size="sm" variant="secondary" onClick={generateSummary} loading={generating}>
            {aiSummary ? "Refresh AI summary" : "Generate AI summary"}
          </Button>
        )}
      </div>

      {aiSummary && (
        <p className="mb-4 whitespace-pre-line rounded-xl bg-white/70 p-4 text-sm leading-relaxed text-black/70">
          {aiSummary}
        </p>
      )}

      {signals.length > 0 && (
        <ul className="space-y-2.5">
          {signals.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5">
              <Badge tone={s.tone}>{s.label}</Badge>
              <p className="text-xs leading-relaxed text-black/55 pt-0.5">{s.detail}</p>
            </li>
          ))}
        </ul>
      )}

      {showScheduleCta && (
        <div className="mt-4 border-t border-black/5 pt-3">
          <Button size="sm" onClick={scheduleFollowUp} loading={scheduling}>
            Schedule follow-up for next week
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Card>
  );
}
