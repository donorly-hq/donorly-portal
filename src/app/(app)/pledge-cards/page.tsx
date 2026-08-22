"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, PledgeCard, PledgeCardScan, TeamMember } from "@/lib/types";
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
  notes: "",
  pointOfContactUserId: "",
  batch: "",
};

const emptyCardFilters = {
  batch: "",
  minAmount: "",
  maxAmount: "",
  location: "",
  compliance: "",
};

const COMPLIANCE_OPTIONS = [
  { value: "ok", label: "OK" },
  { value: "non_compliant", label: "Non-compliant" },
  { value: "claims_paid", label: "Claims paid" },
  { value: "non_responsive", label: "Non-responsive" },
];

const SPECIAL_STATUSES = ["needs_verification", "claims_paid", "non_responsive"];

/**
 * Reads a photo and downscales it on a canvas so we upload a small JPEG
 * instead of a raw multi-megabyte camera image (faster, cheaper AI calls,
 * stays within the backend size limit).
 */
async function downscalePhoto(file: File, maxDim = 1600): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load the photo"));
    el.src = original;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function PledgeCardsPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("pledges.write");

  const [cards, setCards] = useState<PledgeCard[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "verification">("pending");
  const [cardFilters, setCardFilters] = useState(emptyCardFilters);
  const [batches, setBatches] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<{ autoApprove: boolean; hours: number } | null>(null);

  /* ── scan flow state ─────────────────────────────────── */
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<PledgeCardScan | null>(null);
  const [useMatchedDonor, setUseMatchedDonor] = useState(true);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter === "pending") params.set("status", "pending");
    if (cardFilters.batch) params.set("batch", cardFilters.batch);
    if (cardFilters.minAmount) params.set("minAmount", cardFilters.minAmount);
    if (cardFilters.maxAmount) params.set("maxAmount", cardFilters.maxAmount);
    if (cardFilters.location) params.set("location", cardFilters.location);
    if (cardFilters.compliance) params.set("compliance", cardFilters.compliance);
    const qs = params.toString();
    Promise.all([
      api.get<PledgeCard[]>(`/pledge-cards${qs ? `?${qs}` : ""}`),
      api.get<Campaign[]>("/campaigns"),
    ])
      .then(([c, camps]) => {
        // The verification queue is the three special statuses.
        setCards(
          filter === "verification"
            ? c.filter((card) => SPECIAL_STATUSES.includes(card.verificationStatus))
            : c
        );
        setCampaigns(camps);
      })
      .catch((e) => setError(e.message));
  }, [filter, cardFilters]);

  useEffect(() => {
    load();
  }, [load]);

  // One unfiltered fetch to learn which batches exist; default the filter to
  // the pilot batch so the team lands on the 1,200-card queue by default.
  useEffect(() => {
    api.get<TeamMember[]>("/team/assignable").then(setMembers).catch(() => setMembers([]));
    api
      .get<{ autoApprove: boolean; hours: number }>("/pledge-cards/auto-approve-policy")
      .then(setPolicy)
      .catch(() => setPolicy(null));
    api
      .get<PledgeCard[]>("/pledge-cards")
      .then((all) => {
        const found = [...new Set(all.map((c) => c.batch).filter((b): b is string => Boolean(b)))];
        setBatches(found);
        const pilot = found.find((b) => /pilot/i.test(b));
        if (pilot) setCardFilters((f) => (f.batch ? f : { ...f, batch: pilot }));
      })
      .catch(() => setBatches([]));
  }, []);

  const set = (field: keyof typeof emptyForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openModal = (m: "manual" | "scan") => {
    setMode(m);
    setForm(emptyForm);
    setPhoto(null);
    setScan(null);
    setUseMatchedDonor(true);
    setError(null);
    setModalOpen(true);
  };

  const handlePhotoChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      setPhoto(await downscalePhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the photo");
    }
  };

  const handleExtract = async () => {
    if (!photo) return;
    setScanning(true);
    setError(null);
    try {
      const result = await api.post<PledgeCardScan>("/pledge-cards/scan", {
        imageDataUrl: photo,
      });
      setScan(result);
      setUseMatchedDonor(Boolean(result.matchedDonorId));
      // Pre-fill the form; every field stays editable for verification.
      setForm((prev) => ({
        ...prev,
        donorFullName: result.donorFullName ?? "",
        donorEmail: result.donorEmail ?? "",
        donorPhone: result.donorPhone ?? "",
        donorCity: result.donorCity ?? "",
        donorType: result.donorType ?? "individual",
        campaignId: result.campaignId ?? "",
        amount: result.amount != null ? String(result.amount) : "",
        paymentMethod: result.paymentMethod ?? "cash",
        notes: result.notes ?? "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the card");
    } finally {
      setScanning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/pledge-cards", {
        donorId: scan?.matchedDonorId && useMatchedDonor ? scan.matchedDonorId : undefined,
        donorFullName: form.donorFullName,
        donorEmail: form.donorEmail || undefined,
        donorPhone: form.donorPhone || undefined,
        donorCity: form.donorCity || undefined,
        donorType: form.donorType,
        campaignId: form.campaignId || undefined,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        imageUrl: photo || undefined,
        extractedJson: scan?.extractedJson || undefined,
        notes: form.notes || undefined,
        pointOfContactUserId: form.pointOfContactUserId || undefined,
        batch: form.batch || undefined,
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
    try {
      await api.patch(`/pledge-cards/${id}/status`, { status });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const bumpFollowUp = async (id: string) => {
    await api.post(`/pledge-cards/${id}/follow-up`);
    load();
  };

  const savePolicy = async (next: { autoApprove: boolean; hours: number }) => {
    setPolicy(next);
    try {
      const saved = await api.put<{ autoApprove: boolean; hours: number }>(
        "/pledge-cards/auto-approve-policy",
        next
      );
      setPolicy(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    }
  };

  if (error && !cards) return <p className="text-red-600">{error}</p>;
  if (!cards) return <Spinner />;

  const statusTone = (s: string) => {
    if (s === "approved") return "success" as const;
    if (s === "rejected") return "danger" as const;
    if (s === "reviewed") return "info" as const;
    if (SPECIAL_STATUSES.includes(s)) return "danger" as const;
    return "warning" as const;
  };

  const filtersActive = Object.values(cardFilters).some(Boolean);

  const showCaptureStep = mode === "scan" && !scan;

  return (
    <div>
      <PageHeader
        title="Pledge cards"
        subtitle="Snap a photo of a paper pledge card and let AI fill in the details"
        action={
          canWrite ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openModal("manual")}>
                Add manually
              </Button>
              <Button onClick={() => openModal("scan")}>Scan card</Button>
            </div>
          ) : undefined
        }
      />

      {policy && canWrite ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.autoApprove}
              onChange={(e) => savePolicy({ ...policy, autoApprove: e.target.checked })}
            />
            Auto-approve pending cards after
          </label>
          <input
            type="number"
            min={1}
            max={168}
            value={policy.hours}
            disabled={!policy.autoApprove}
            onChange={(e) => setPolicy({ ...policy, hours: Number(e.target.value) })}
            onBlur={() => savePolicy(policy)}
            className="w-16 rounded border border-slate-200 px-2 py-1 text-sm disabled:opacity-50"
          />
          <span>hours (approved cards automatically become pledges)</span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "verification", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === f ? "bg-emerald text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {f === "pending"
              ? "Pending review"
              : f === "verification"
                ? "Needs verification"
                : "All cards"}
          </button>
        ))}
      </div>

      {/* ── filter bar: amount, location, compliance, batch ── */}
      <Card className="mb-4 !p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Select
            value={cardFilters.batch}
            onChange={(e) => setCardFilters({ ...cardFilters, batch: e.target.value })}
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Min amount"
            value={cardFilters.minAmount}
            onChange={(e) => setCardFilters({ ...cardFilters, minAmount: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Max amount"
            value={cardFilters.maxAmount}
            onChange={(e) => setCardFilters({ ...cardFilters, maxAmount: e.target.value })}
          />
          <Input
            placeholder="City or state"
            value={cardFilters.location}
            onChange={(e) => setCardFilters({ ...cardFilters, location: e.target.value })}
          />
          <Select
            value={cardFilters.compliance}
            onChange={(e) => setCardFilters({ ...cardFilters, compliance: e.target.value })}
          >
            <option value="">Any compliance</option>
            {COMPLIANCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {filtersActive && (
            <button
              onClick={() => setCardFilters(emptyCardFilters)}
              className="text-sm text-emerald hover:underline text-left"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">POC</th>
              <th className="px-4 py-3">Follow-ups</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              {canWrite ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt="Pledge card"
                      className="h-10 w-14 cursor-pointer rounded border object-cover"
                      onClick={() => setViewPhoto(c.imageUrl)}
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {c.donorId ? (
                    <Link href={`/donors/${c.donorId}`} className="hover:underline">
                      {c.donorName ?? "—"}
                    </Link>
                  ) : (
                    c.donorName ?? "—"
                  )}
                  {c.batch ? (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      {c.batch}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{c.campaignName ?? "—"}</td>
                <td className="px-4 py-3">{currency(c.amount)}</td>
                <td className="px-4 py-3 text-slate-600">{c.pointOfContactName ?? "—"}</td>
                <td className="px-4 py-3">
                  {c.donorId ? (
                    <Link
                      href={`/donors/${c.donorId}?tab=history`}
                      className="text-emerald hover:underline"
                      title="Open communication and follow-up history"
                    >
                      {c.followUpCount}
                    </Link>
                  ) : (
                    c.followUpCount
                  )}
                  {canWrite && !["approved", "rejected"].includes(c.verificationStatus) ? (
                    <button
                      className="ml-2 text-xs text-slate-400 hover:text-emerald"
                      title="Record a follow-up attempt"
                      onClick={() => bumpFollowUp(c.id)}
                    >
                      +1
                    </button>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(c.verificationStatus)}>
                    {c.verificationStatus.replaceAll("_", " ")}
                  </Badge>
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
                          className="text-xs text-amber-600 hover:underline"
                          onClick={() => updateStatus(c.id, "needs_verification")}
                        >
                          Needs check
                        </button>
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => updateStatus(c.id, "rejected")}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {SPECIAL_STATUSES.includes(c.verificationStatus) && (
                      <>
                        <button
                          className="text-xs text-emerald hover:underline"
                          onClick={() => updateStatus(c.id, "approved")}
                        >
                          Approve
                        </button>
                        {c.verificationStatus !== "claims_paid" && (
                          <button
                            className="text-xs text-slate-500 hover:underline"
                            onClick={() => updateStatus(c.id, "claims_paid")}
                          >
                            Claims paid
                          </button>
                        )}
                        {c.verificationStatus !== "non_responsive" && (
                          <button
                            className="text-xs text-slate-500 hover:underline"
                            onClick={() => updateStatus(c.id, "non_responsive")}
                          >
                            Non-responsive
                          </button>
                        )}
                      </>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  No pledge cards in this queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* ── full-size photo viewer ─────────────────────────── */}
      <Modal open={viewPhoto !== null} title="Pledge card photo" onClose={() => setViewPhoto(null)}>
        {viewPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewPhoto} alt="Pledge card" className="w-full rounded-lg" />
        ) : null}
      </Modal>

      <Modal
        open={modalOpen}
        title={mode === "scan" ? "Scan pledge card" : "Add pledge card"}
        onClose={() => setModalOpen(false)}
      >
        {showCaptureStep ? (
          /* ── step 1: take / choose a photo ───────────────── */
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChosen}
            />
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Pledge card preview" className="w-full rounded-lg border" />
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald hover:text-emerald"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm font-medium">Take a photo of the pledge card</span>
                <span className="text-xs text-slate-400">
                  Opens the camera on phones, or pick an image file
                </span>
              </button>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex justify-end gap-2">
              {photo ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Retake
                </Button>
              ) : null}
              <Button type="button" disabled={!photo} loading={scanning} onClick={handleExtract}>
                {scanning ? "Reading card…" : "Extract with AI"}
              </Button>
            </div>
          </div>
        ) : (
          /* ── step 2: verify (or plain manual entry) ──────── */
          <form onSubmit={handleCreate} className="space-y-4">
            {scan ? (
              <div className="space-y-3">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt="Pledge card"
                    className="max-h-40 w-full rounded-lg border object-contain"
                  />
                ) : null}
                <div className="rounded-lg bg-emerald/10 px-3 py-2 text-sm text-emerald-900">
                  AI read these values from the photo. Please check each field against the
                  card before saving — nothing is stored until you confirm.
                </div>
                {scan.matchedDonorId ? (
                  <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useMatchedDonor}
                      onChange={(e) => setUseMatchedDonor(e.target.checked)}
                    />
                    <span>
                      Link to existing donor{" "}
                      <span className="font-medium">{scan.matchedDonorName}</span> instead of
                      creating a new one
                    </span>
                  </label>
                ) : null}
              </div>
            ) : null}

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

            <div className="grid grid-cols-2 gap-4">
              <Field label="Point of contact">
                <Select value={form.pointOfContactUserId} onChange={set("pointOfContactUserId")}>
                  <option value="">Me (default)</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Batch">
                <Input
                  value={form.batch}
                  onChange={set("batch")}
                  placeholder={'e.g. "Pilot 1200"'}
                  list="pledge-card-batches"
                />
                <datalist id="pledge-card-batches">
                  {batches.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
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
        )}
      </Modal>
    </div>
  );
}
