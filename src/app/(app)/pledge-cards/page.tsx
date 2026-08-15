"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campaign, PledgeCard, PledgeCardScan } from "@/lib/types";
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
};

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
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── scan flow state ─────────────────────────────────── */
  const [mode, setMode] = useState<"manual" | "scan">("manual");
  const [photo, setPhoto] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<PledgeCardScan | null>(null);
  const [useMatchedDonor, setUseMatchedDonor] = useState(true);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setForm({
        donorFullName: result.donorFullName ?? "",
        donorEmail: result.donorEmail ?? "",
        donorPhone: result.donorPhone ?? "",
        donorCity: result.donorCity ?? "",
        donorType: result.donorType ?? "individual",
        campaignId: result.campaignId ?? "",
        amount: result.amount != null ? String(result.amount) : "",
        paymentMethod: result.paymentMethod ?? "cash",
        notes: result.notes ?? "",
      });
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
              <th className="px-4 py-3">Card</th>
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
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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
