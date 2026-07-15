"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PublicThermometer } from "@/lib/types";

const PRESETS = [50, 100, 250, 500, 1000, 2500];

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface SelfPledgeResponse {
  donorName: string;
  amount: number;
  campaignName: string;
  organizationName: string;
}

/**
 * Public self-pledge page (Event Mode). Donors scan a QR at the event and
 * pledge from their own phone — no login, keyed by the campaign UUID.
 */
export default function PublicSelfPledgePage() {
  const params = useParams<{ campaignId: string }>();
  const [info, setInfo] = useState<PublicThermometer | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [customAmount, setCustomAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SelfPledgeResponse | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<PublicThermometer>(`/public/thermometer/${params.campaignId}`)
      .then(setInfo)
      .catch((e) => setLoadError(e.message));
  }, [params.campaignId]);

  const effectiveAmount = customAmount !== "" ? Number(customAmount) : amount === "" ? 0 : amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || effectiveAmount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<SelfPledgeResponse>(
        `/public/pledge/${params.campaignId}`,
        {
          fullName: name.trim(),
          phone: phone.trim() || undefined,
          amount: effectiveAmount,
        },
        false,
      );
      setSaved(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pledge");
    } finally {
      setSaving(false);
    }
  };

  const pledgeAgain = () => {
    setSaved(null);
    setName("");
    setPhone("");
    setAmount("");
    setCustomAmount("");
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <p className="text-center text-black/60">{loadError}</p>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <p className="text-black/40">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <p className="text-center text-xs uppercase tracking-[0.25em] text-black/40">
          {info.organizationName}
        </p>
        <h1 className="mt-1 text-center font-serif text-2xl font-bold text-emerald">
          {info.campaignName}
        </h1>

        {saved ? (
          <div className="mt-8 rounded-2xl border border-gold/25 bg-gold-50 p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold text-2xl font-bold text-white">
              ✓
            </div>
            <p className="mt-3 text-lg font-semibold text-gold-dark">
              JazakAllah khair, {saved.donorName}!
            </p>
            <p className="mt-1 text-sm text-black/60">
              Your pledge of{" "}
              <span className="font-bold text-gold-dark">{money.format(saved.amount)}</span> to{" "}
              {saved.campaignName} has been recorded.
            </p>
            <p className="mt-3 text-xs text-black/45">
              A volunteer from {saved.organizationName} will follow up with you about payment.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                disabled
                title="Online payment coming soon"
                className="w-full cursor-not-allowed rounded-xl bg-emerald/30 px-4 py-3 text-sm font-semibold text-white"
              >
                Pay now with card
              </button>
              <p className="text-[11px] text-black/40">Online payment coming soon</p>
              <button
                type="button"
                onClick={pledgeAgain}
                className="w-full rounded-xl border border-emerald/25 bg-white px-4 py-3 text-sm font-semibold text-emerald hover:bg-emerald-50"
              >
                Make another pledge
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-1 block text-sm font-medium text-black/70">Your name</label>
              <input
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Full name"
                className="w-full rounded-xl border border-black/10 px-4 py-3 text-base outline-none focus:border-emerald"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-black/70">
                Phone <span className="font-normal text-black/40">(optional)</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                autoComplete="tel"
                placeholder="(555) 555-5555"
                className="w-full rounded-xl border border-black/10 px-4 py-3 text-base outline-none focus:border-emerald"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black/70">Pledge amount</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setAmount(v);
                      setCustomAmount("");
                    }}
                    className={
                      "rounded-xl border px-2 py-3 text-sm font-semibold transition " +
                      (amount === v && customAmount === ""
                        ? "border-emerald bg-emerald text-white"
                        : "border-black/10 bg-white text-emerald hover:bg-emerald-50")
                    }
                  >
                    {money.format(v)}
                  </button>
                ))}
              </div>
              <input
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value.replace(/[^0-9]/g, ""));
                  setAmount("");
                }}
                inputMode="numeric"
                placeholder="Or enter another amount"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-base outline-none focus:border-emerald"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={saving || !name.trim() || effectiveAmount <= 0}
              className="w-full rounded-xl bg-emerald px-4 py-3.5 text-base font-semibold text-white transition hover:bg-emerald-light disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Saving…"
                : effectiveAmount > 0
                ? `Pledge ${money.format(effectiveAmount)}`
                : "Pledge"}
            </button>
            <p className="text-center text-[11px] text-black/40">
              No payment is taken now — this records your pledge with{" "}
              {info.organizationName}.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
