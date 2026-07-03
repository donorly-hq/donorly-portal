"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, PledgeCard } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  currency,
  dateTime,
} from "@/components/ui";

const emptyForm = {
  /* donor fields */
  donorFullName: "",
  donorEmail: "",
  donorPhone: "",
  donorCity: "",
  donorType: "individual",
  /* card fields */
  campaignId: "",
  amount: "",
  paymentMethod: "cash",
  imageUrl: "",
  notes: "",
};

export default function PledgeCardsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("pledges.write");

  const [cards, setCards] = useState<PledgeCard[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const path = filter === "pending" ? "/pledge-cards/pending" : "/pledge-cards";
    Promise.all([api.get<PledgeCard[]>(path), api.get<Campaign[]>("/campaigns")])
      .then(([c, camps]) => {
        setCards(c);
        setCampaigns(camps);
      })
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/pledge-cards", {
        donorFullName: form.donorFullName,
        donorEmail: form.donorEmail || undefined,
        donorPhone: form.donorPhone || undefined,
        donorCity: form.donorCity || undefined,
        donorType: form.donorType,
        campaignId: form.campaignId || undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        imageUrl: form.imageUrl || undefined,
        notes: form.notes || undefined,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/pledge-cards/${id}/status`, { status });
    load();
  };

  if (error && !cards) return <p className="text-red-600">{error}</p>;
  if (!cards) return <Spinner />;

  const statusTone = (s: string) => {
    if (s === "approved") return "success" as const;
    if (s === "rejected") return "danger" as const;
    if (s === "reviewed") return "info" as const;
    return "warning" as const;
  };

  return (
    <div>
      <PageHeader
        title="Pledge cards"
        subtitle="Manual pledge card entry and verification queue"
        action={
          canWrite ? (
            <Button onClick={() => setModalOpen(true)}>Add pledge card</Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === f ? "bg-emerald text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {f === "pending" ? "Pending review" : "All cards"}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{c.donorName ?? "—"}</td>
                <td className="px-4 py-3">{c.campaignName ?? "—"}</td>
                <td className="px-4 py-3">{currency(c.amount)}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(c.verificationStatus)}>{c.verificationStatus}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500">{dateTime(c.createdAt)}</td>
                {canWrite ? (
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.verificationStatus === "pending" && (
                      <>
                        <button
                          className="text-xs text-emerald hover:underline"
                          onClick={() => updateStatus(c.id, "approved")}
                        >
                          Approve
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => updateStatus(c.id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No pledge cards in this queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal open={modalOpen} title="Add pledge card" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">

          {/* ── Donor details ─────────────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Donor details
          </p>

          <Field label="Full name *">
            <Input
              value={form.donorFullName}
              onChange={set("donorFullName")}
              placeholder="e.g. Ahmed Khan"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={form.donorEmail}
                onChange={set("donorEmail")}
                placeholder="optional"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.donorPhone}
                onChange={set("donorPhone")}
                placeholder="optional"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input
                value={form.donorCity}
                onChange={set("donorCity")}
                placeholder="optional"
              />
            </Field>
            <Field label="Type">
              <Select value={form.donorType} onChange={set("donorType")}>
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </Select>
            </Field>
          </div>

          {/* ── Pledge card details ───────────────────── */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">
            Pledge details
          </p>

          <Field label="Campaign">
            <Select value={form.campaignId} onChange={set("campaignId")}>
              <option value="">— Optional —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount *">
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={set("amount")}
                required
              />
            </Field>
            <Field label="Payment method">
              <Select value={form.paymentMethod} onChange={set("paymentMethod")}>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Input value={form.notes} onChange={set("notes")} placeholder="optional" />
          </Field>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save pledge card
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
