"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, TeamMember } from "@/lib/types";
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
} from "@/components/ui";

// New campaigns start as drafts: targeting and messaging get configured before launch.
const emptyForm = {
  name: "",
  campaignType: "general",
  goalAmount: "",
  status: "draft",
  startDate: "",
  endDate: "",
  managedByUserId: "",
};

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("campaigns.manage");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<Campaign[]>("/campaigns")
      .then(setCampaigns)
      .catch((e) => setError(e.message));
    if (canManage) {
      api.get<TeamMember[]>("/team/assignable").then(setMembers).catch(() => setMembers([]));
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/campaigns", {
        name: form.name,
        campaignType: form.campaignType,
        goalAmount: form.goalAmount ? Number(form.goalAmount) : 0,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        managedByUserId: form.managedByUserId || undefined,
      });
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  if (error && !campaigns) return <p className="text-red-600">{error}</p>;
  if (!campaigns) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}
        action={
          canManage ? <Button onClick={() => setModalOpen(true)}>New campaign</Button> : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => (
          <Link key={c.id} href={`/campaigns/${c.id}`}>
            <Card className="h-full transition hover:shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-lg text-emerald">{c.name}</h3>
                <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
              </div>
              <p className="text-sm text-black/50">Goal: {currency(c.goalAmount)}</p>
              <p className="mt-1 text-xs capitalize text-black/40">{c.campaignType}</p>
            </Card>
          </Link>
        ))}
        {campaigns.length === 0 ? (
          <p className="text-black/40">No campaigns yet.</p>
        ) : null}
      </div>

      <Modal open={modalOpen} title="New campaign" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Goal amount">
              <Input
                type="number"
                min="0"
                value={form.goalAmount}
                onChange={(e) => setForm({ ...form, goalAmount: e.target.value })}
              />
            </Field>
            <Field label="Run by">
              <Select
                value={form.campaignType}
                onChange={(e) => setForm({ ...form, campaignType: e.target.value })}
              >
                <option value="general">General</option>
                <option value="organizer_run">Organizer-run</option>
                <option value="ambassador_run">Ambassador-run</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date">
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Managed by">
            <Select
              value={form.managedByUserId}
              onChange={(e) => setForm({ ...form, managedByUserId: e.target.value })}
            >
              <option value="">Not assigned yet</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.fullName} {m.roleName ? `(${m.roleName})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
          <p className="text-xs text-black/40">
            New campaigns start as drafts — set up the audience and messaging on the campaign
            page, then switch to Active to launch.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create campaign"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
