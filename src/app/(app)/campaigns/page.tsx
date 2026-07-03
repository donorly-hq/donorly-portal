"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign } from "@/lib/types";
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

const emptyForm = { name: "", campaignType: "general", goalAmount: "", status: "active" };

export default function CampaignsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("campaigns.manage");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api
      .get<Campaign[]>("/campaigns")
      .then(setCampaigns)
      .catch((e) => setError(e.message));
  }, []);

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
            <Field label="Type">
              <Input
                value={form.campaignType}
                onChange={(e) => setForm({ ...form, campaignType: e.target.value })}
              />
            </Field>
          </div>
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
