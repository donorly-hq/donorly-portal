"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { PublicCheckinInfo } from "@/lib/types";

/**
 * Public QR self-check-in. Guests land here by scanning the QR code on their
 * ticket — the unguessable check-in code in the URL is the authorization.
 */
export default function SelfCheckinPage() {
  const params = useParams<{ eventId: string; code: string }>();
  const [info, setInfo] = useState<PublicCheckinInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    api
      .get<PublicCheckinInfo>(`/public/checkin/${params.eventId}/${params.code}`, false)
      .then(setInfo)
      .catch((e) => setError(e.message));
  }, [params.eventId, params.code]);

  useEffect(load, [load]);

  const checkIn = async () => {
    setChecking(true);
    setError(null);
    try {
      const updated = await api.post<PublicCheckinInfo>(
        `/public/checkin/${params.eventId}/${params.code}`,
        {},
        false,
      );
      setInfo(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setChecking(false);
    }
  };

  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" });
  const checkedIn = info?.status === "checked_in";
  const cancelled = info?.status === "cancelled";

  return (
    <div className="flex min-h-screen items-center justify-center bg-emerald-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="font-serif text-2xl font-bold text-emerald">Donorly</p>

        {!info && !error ? (
          <p className="mt-6 text-black/50">Looking up your registration…</p>
        ) : null}

        {error && !info ? (
          <div className="mt-6">
            <p className="font-semibold text-red-600">We couldn&apos;t find that ticket.</p>
            <p className="mt-1 text-sm text-black/50">
              Please see a volunteer at the welcome desk and they&apos;ll get you checked in.
            </p>
          </div>
        ) : null}

        {info ? (
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-black/40">Event</p>
              <p className="text-lg font-semibold">{info.eventName}</p>
              <p className="text-sm text-black/50">
                {info.eventStartsAt ? dateFmt.format(new Date(info.eventStartsAt)) : ""}
                {info.eventLocation ? ` · ${info.eventLocation}` : ""}
              </p>
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-black/40">Guest</p>
              <p className="text-lg font-semibold">{info.guestName}</p>
              <p className="text-sm text-black/50">
                Party of {info.partySize}
              </p>
            </div>

            {cancelled ? (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                This registration was cancelled. Please see the welcome desk.
              </p>
            ) : checkedIn ? (
              <div className="rounded-xl bg-emerald-100 px-4 py-5 text-center">
                <p className="text-2xl font-bold text-emerald">You&apos;re checked in!</p>
                <p className="mt-1 text-sm text-black/50">
                  Welcome{info.guestName ? `, ${info.guestName.split(" ")[0]}` : ""} — enjoy the
                  event. Show this screen if anyone asks.
                </p>
              </div>
            ) : (
              <button
                onClick={checkIn}
                disabled={checking}
                className="w-full rounded-xl bg-emerald px-4 py-4 text-lg font-bold text-white transition hover:bg-emerald-dark disabled:opacity-50"
              >
                {checking ? "Checking in…" : `Check in ${info.partySize > 1 ? `(party of ${info.partySize})` : ""}`}
              </button>
            )}

            {error && info ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
