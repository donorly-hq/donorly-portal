"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Campaign, QuickPledgeResponse } from "@/lib/types";
import { Button, Select, Spinner, currency } from "@/components/ui";

const PRESETS = [50, 100, 250, 500, 1000, 2500];

export default function QuickPledgePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <QuickPledgeContent />
    </Suspense>
  );
}

function QuickPledgeContent() {
  const params = useSearchParams();
  const preselected = params.get("campaign") ?? "";

  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [campaignId, setCampaignId] = useState(preselected);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<QuickPledgeResponse | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<Campaign[]>("/campaigns")
      .then((list) => {
        const active = list.filter((c) => c.status === "active");
        setCampaigns(active.length > 0 ? active : list);
        if (!preselected && active.length === 1) setCampaignId(active[0].id);
      })
      .catch((e) => setError(e.message));
  }, [preselected]);

  const effectiveAmount = customAmount !== "" ? Number(customAmount) : amount === "" ? 0 : amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !name.trim() || effectiveAmount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await api.post<QuickPledgeResponse>("/pledges/quick", {
        campaignId,
        donorName: name.trim(),
        phone: phone.trim() || undefined,
        amount: effectiveAmount,
      });
      setLastSaved(saved);
      // Reset for the next person in line; keep the campaign
      setName("");
      setPhone("");
      setAmount("");
      setCustomAmount("");
      nameRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pledge");
    } finally {
      setSaving(false);
    }
  };

  if (!campaigns) return <Spinner />;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4">
        <h1 className="font-serif text-2xl font-bold text-emerald">Quick pledge entry</h1>
        <p className="text-sm text-black/50">
          Built for live events — name, amount, done. Existing donors are matched
          automatically.
        </p>
      </div>

      {lastSaved ? (
        <div className="mb-4 rounded-xl bg-emerald/10 px-4 py-3 text-sm text-emerald">
          Saved: <strong>{currency(lastSaved.amount)}</strong> from{" "}
          <strong>{lastSaved.donorName}</strong>
          {lastSaved.newDonor ? " (new donor created)" : ""}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-black/60">Campaign</label>
          <Select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} required>
            <option value="">Select campaign...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-black/60">Donor name</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
            placeholder="Full name"
            className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-lg outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-black/60">
            Phone <span className="font-normal text-black/40">(optional, helps match repeat donors)</span>
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoComplete="off"
            placeholder="(555) 123-4567"
            className="w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-lg outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-black/60">Amount</label>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setAmount(v); setCustomAmount(""); }}
                className={
                  "rounded-xl border px-2 py-4 text-lg font-bold transition " +
                  (amount === v && customAmount === ""
                    ? "border-emerald bg-emerald text-white"
                    : "border-black/15 text-emerald hover:bg-emerald/5")
                }
              >
                ${v.toLocaleString()}
              </button>
            ))}
          </div>
          <input
            value={customAmount}
            onChange={(e) => { setCustomAmount(e.target.value); setAmount(""); }}
            type="number"
            min="1"
            inputMode="numeric"
            placeholder="Custom amount"
            className="mt-2 w-full rounded-lg border border-black/15 bg-white px-4 py-3 text-lg outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          size="lg"
          className="w-full py-4 text-lg"
          disabled={saving || !campaignId || !name.trim() || effectiveAmount <= 0}
        >
          {saving ? "Saving..." : effectiveAmount > 0 ? `Save pledge — ${currency(effectiveAmount)}` : "Save pledge"}
        </Button>
      </form>
    </div>
  );
}
