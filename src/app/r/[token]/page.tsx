"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

interface RespondContext {
  orgName: string;
  donorFirstName: string;
  amount: number | null;
  campaignName: string | null;
  used: boolean;
  expired: boolean;
}

type Action = "paid" | "promise" | "stop";

/**
 * Public donor response page, opened from a reminder email's action buttons.
 * No login — the token in the URL identifies the pledge and the donor.
 */
export default function DonorRespondPage() {
  const params = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<RespondContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [action, setAction] = useState<Action>("paid");
  const [promiseDate, setPromiseDate] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<RespondContext>(`/public/respond/${params.token}`, false)
      .then(setCtx)
      .catch((e) => setLoadError(e.message));
    if (typeof window !== "undefined") {
      const pre = new URLSearchParams(window.location.search).get("action");
      if (pre === "paid" || pre === "promise" || pre === "stop") setAction(pre);
    }
  }, [params.token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await api.post<{ message: string }>(
        `/public/respond/${params.token}`,
        {
          action,
          promiseDate: action === "promise" ? promiseDate || undefined : undefined,
          comment: comment || undefined,
        },
        false,
      );
      setDoneMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
    } finally {
      setSaving(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-emerald-dark to-emerald px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">{children}</div>
    </main>
  );

  if (loadError) {
    return shell(
      <div className="text-center">
        <p className="text-3xl">🔗</p>
        <h1 className="mt-2 font-serif text-xl font-bold text-slate-800">
          This link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          It may have expired. Please contact the organization directly — and thank you for
          your generosity.
        </p>
      </div>,
    );
  }
  if (!ctx) {
    return shell(<p className="text-center text-sm text-slate-400">Loading…</p>);
  }

  if (doneMessage || ctx.used) {
    return shell(
      <div className="text-center">
        <p className="text-3xl">💚</p>
        <h1 className="mt-2 font-serif text-xl font-bold text-slate-800">Thank you!</h1>
        <p className="mt-2 text-sm text-slate-600">
          {doneMessage ?? "We already received your response. The team at " + ctx.orgName +
            " will take it from here."}
        </p>
      </div>,
    );
  }

  if (ctx.expired) {
    return shell(
      <div className="text-center">
        <p className="text-3xl">⏳</p>
        <h1 className="mt-2 font-serif text-xl font-bold text-slate-800">This link has expired</h1>
        <p className="mt-2 text-sm text-slate-500">
          Please reach out to {ctx.orgName} directly — and thank you for your generosity.
        </p>
      </div>,
    );
  }

  const OPTIONS: { value: Action; title: string; hint: string }[] = [
    { value: "paid", title: "I already paid", hint: "We'll mark it for confirmation — no more reminders" },
    { value: "promise", title: "I'll pay by a date", hint: "Pick a date and we'll pause reminders until then" },
    { value: "stop", title: "Please stop reminding me", hint: "A person will follow up instead of automated emails" },
  ];

  return shell(
    <form onSubmit={submit} className="space-y-5">
      <div className="text-center">
        <h1 className="font-serif text-xl font-bold text-slate-800">
          Salaam {ctx.donorFirstName}!
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          About your {ctx.amount != null ? money.format(ctx.amount) + " " : ""}pledge
          {ctx.campaignName ? ` to ${ctx.campaignName}` : ""} — {ctx.orgName}
        </p>
      </div>

      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`block cursor-pointer rounded-xl border-2 px-4 py-3 transition ${
              action === o.value
                ? "border-emerald bg-emerald/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="action"
              value={o.value}
              checked={action === o.value}
              onChange={() => setAction(o.value)}
              className="sr-only"
            />
            <span className="block text-sm font-semibold text-slate-800">{o.title}</span>
            <span className="block text-xs text-slate-500">{o.hint}</span>
          </label>
        ))}
      </div>

      {action === "promise" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            I&apos;ll pay by
          </label>
          <input
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald focus:outline-none"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Anything you&apos;d like to add? <span className="text-slate-400">(optional)</span>
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="e.g. I mailed a check on Monday"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald focus:outline-none"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={saving || (action === "promise" && !promiseDate)}
        className="w-full rounded-xl bg-emerald px-4 py-3 text-base font-semibold text-white transition hover:bg-emerald-dark disabled:opacity-50"
      >
        {saving ? "Sending…" : "Send my response"}
      </button>
      <p className="text-center text-xs text-slate-400">
        Your response goes straight to the {ctx.orgName} team.
      </p>
    </form>,
  );
}
