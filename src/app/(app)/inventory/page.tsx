"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { InventoryItem, InventoryUnit, TeamMember } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";

const CATEGORY_PRESETS = [
  "Square reader",
  "Standee",
  "Banner",
  "Pledge card box",
  "Cash box",
  "Receipt book",
  "Projector",
  "Microphone / AV",
  "Table",
  "Tent / Canopy",
];

/** Expected-return presets — drives the overdue reminder highlight. */
const RETURN_OPTIONS: { label: string; days: number | null }[] = [
  { label: "No return reminder", days: null },
  { label: "Return tomorrow", days: 1 },
  { label: "Return in 3 days", days: 3 },
  { label: "Return in 1 week", days: 7 },
  { label: "Return in 2 weeks", days: 14 },
  { label: "Return in 1 month", days: 30 },
];

const emptyItemForm = { name: "", category: "", customCategory: "", quantity: "1", notes: "" };

export default function InventoryPage() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission("inventory.write");
  const canAssign = hasPermission("inventory.assign");

  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add / edit item modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [savingItem, setSavingItem] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Assign / detail modal
  const [assignTarget, setAssignTarget] = useState<{ item: InventoryItem; unit: InventoryUnit } | null>(null);
  const [assignForm, setAssignForm] = useState({ holderUserId: "", holderName: "", returnDays: "", notes: "" });
  const [savingAssign, setSavingAssign] = useState(false);

  const load = useCallback(() => {
    api
      .get<InventoryItem[]>("/inventory")
      .then((list) => {
        setItems(list);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    api
      .get<TeamMember[]>("/team/assignable")
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [canAssign]);

  const totalOverdue = useMemo(
    () => (items ?? []).reduce((sum, i) => sum + i.unitsOverdue, 0),
    [items],
  );

  const replaceItem = (updated: InventoryItem) =>
    setItems((prev) => (prev ? prev.map((i) => (i.id === updated.id ? updated : i)) : prev));

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setModalError(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    const preset = item.category && CATEGORY_PRESETS.includes(item.category);
    setItemForm({
      name: item.name,
      category: preset ? item.category! : item.category ? "__custom" : "",
      customCategory: preset ? "" : item.category ?? "",
      quantity: String(item.quantity),
      notes: item.notes ?? "",
    });
    setModalError(null);
    setItemModalOpen(true);
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    setModalError(null);
    const category =
      itemForm.category === "__custom" ? itemForm.customCategory.trim() : itemForm.category;
    try {
      const body = {
        name: itemForm.name.trim(),
        category: category || undefined,
        quantity: Number(itemForm.quantity),
        notes: itemForm.notes.trim() || undefined,
      };
      if (editingItem) {
        const updated = await api.patch<InventoryItem>(`/inventory/${editingItem.id}`, body);
        replaceItem(updated);
      } else {
        await api.post<InventoryItem>("/inventory", body);
        load();
      }
      setItemModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const openUnit = (item: InventoryItem, unit: InventoryUnit) => {
    if (!canAssign) return;
    setAssignForm({ holderUserId: "", holderName: "", returnDays: "", notes: "" });
    setModalError(null);
    setAssignTarget({ item, unit });
  };

  const saveAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget) return;
    setSavingAssign(true);
    setModalError(null);
    try {
      const days = assignForm.returnDays === "" ? null : Number(assignForm.returnDays);
      const expectedReturnDate = days
        ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
        : undefined;
      const updated = await api.post<InventoryItem>(`/inventory/${assignTarget.item.id}/assign`, {
        unitNumber: assignTarget.unit.unitNumber,
        holderUserId: assignForm.holderUserId || undefined,
        holderName: assignForm.holderUserId ? undefined : assignForm.holderName.trim() || undefined,
        expectedReturnDate,
        notes: assignForm.notes.trim() || undefined,
      });
      replaceItem(updated);
      setAssignTarget(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to check out unit");
    } finally {
      setSavingAssign(false);
    }
  };

  const returnUnit = async () => {
    if (!assignTarget?.unit.assignmentId) return;
    setSavingAssign(true);
    setModalError(null);
    try {
      const updated = await api.post<InventoryItem>(
        `/inventory/assignments/${assignTarget.unit.assignmentId}/return`,
        {},
      );
      replaceItem(updated);
      setAssignTarget(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to return unit");
    } finally {
      setSavingAssign(false);
    }
  };

  if (error && !items) return <p className="text-red-600">{error}</p>;
  if (!items) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Equipment and materials — who has what, and since when"
        action={canWrite ? <Button onClick={openAddItem}>Add item</Button> : undefined}
      />

      {totalOverdue > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {totalOverdue} unit{totalOverdue === 1 ? " is" : "s are"} past the expected return date.
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald">{notice}</p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No inventory yet"
          description={
            canWrite
              ? "Add your organization's equipment — Square readers, standees, banners — and track who's holding each one."
              : "Nothing has been added to the inventory yet."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-emerald">{item.name}</h3>
                    {item.category ? <Badge>{item.category}</Badge> : null}
                    {item.unitsOverdue > 0 ? (
                      <Badge tone="danger">{item.unitsOverdue} overdue</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-black/45">
                    {item.unitsOut} of {item.quantity} checked out
                    {item.notes ? ` — ${item.notes}` : ""}
                  </p>
                </div>
                {canWrite ? (
                  <span className="flex shrink-0 gap-3 text-xs">
                    <button className="text-emerald hover:underline" onClick={() => openEditItem(item)}>
                      Edit
                    </button>
                    {canAssign ? (
                      <button className="text-red-600 hover:underline" onClick={() => deleteItem(item)}>
                        Delete
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {item.units.map((unit) => {
                  const held = unit.assignmentId !== null;
                  return (
                    <button
                      key={unit.unitNumber}
                      type="button"
                      onClick={() => openUnit(item, unit)}
                      disabled={!canAssign}
                      title={
                        held
                          ? `${unit.holderName ?? "Unknown"} — held ${unit.daysHeld} day(s)`
                          : "Available"
                      }
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-left text-xs transition",
                        !held && "border-dashed border-black/15 bg-white text-black/40",
                        held && !unit.overdue && "border-emerald/20 bg-emerald-50 text-emerald",
                        held && unit.overdue && "border-red-300 bg-red-50 text-red-700",
                        canAssign ? "cursor-pointer hover:border-emerald/50" : "cursor-default",
                      )}
                    >
                      <span className="font-semibold">#{unit.unitNumber}</span>{" "}
                      {held ? (
                        <>
                          <span className="font-medium">{unit.holderName ?? "Unknown"}</span>
                          <span className="block text-[10px] opacity-70">
                            {unit.daysHeld === 0 ? "today" : `${unit.daysHeld}d`}
                            {unit.overdue ? " — overdue" : ""}
                          </span>
                        </>
                      ) : (
                        <span>available</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit item */}
      <Modal
        open={itemModalOpen}
        title={editingItem ? "Edit item" : "Add inventory item"}
        onClose={() => setItemModalOpen(false)}
      >
        <form onSubmit={saveItem} className="space-y-4">
          <Field label="Item name">
            <Input
              value={itemForm.name}
              onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
              placeholder="e.g. Square reader"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                value={itemForm.category}
                onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
              >
                <option value="">No category</option>
                {CATEGORY_PRESETS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__custom">Other…</option>
              </Select>
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                min="1"
                max="10000"
                value={itemForm.quantity}
                onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                required
              />
            </Field>
          </div>
          {itemForm.category === "__custom" ? (
            <Field label="Custom category">
              <Input
                value={itemForm.customCategory}
                onChange={(e) => setItemForm({ ...itemForm, customCategory: e.target.value })}
                placeholder="e.g. Coffee urn"
              />
            </Field>
          ) : null}
          <Field label="Notes (optional)">
            <Textarea
              rows={2}
              value={itemForm.notes}
              onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
              placeholder="Storage location, condition, serial numbers…"
            />
          </Field>
          {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setItemModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingItem}>
              {savingItem ? "Saving…" : "Save item"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign (available unit) or detail/return (held unit) */}
      <Modal
        open={assignTarget !== null}
        title={
          assignTarget
            ? `${assignTarget.item.name} — unit #${assignTarget.unit.unitNumber}`
            : ""
        }
        onClose={() => setAssignTarget(null)}
      >
        {assignTarget && assignTarget.unit.assignmentId ? (
          <div className="space-y-3 text-sm">
            <p>
              Held by <span className="font-semibold text-emerald">{assignTarget.unit.holderName ?? "Unknown"}</span>{" "}
              for{" "}
              <span className="font-semibold">
                {assignTarget.unit.daysHeld === 0 ? "less than a day" : `${assignTarget.unit.daysHeld} day(s)`}
              </span>
              {assignTarget.unit.assignedAt
                ? ` (since ${new Date(assignTarget.unit.assignedAt).toLocaleDateString()})`
                : ""}
              .
            </p>
            {assignTarget.unit.expectedReturnDate ? (
              <p className={assignTarget.unit.overdue ? "font-medium text-red-600" : "text-black/60"}>
                Expected back {new Date(assignTarget.unit.expectedReturnDate + "T00:00:00").toLocaleDateString()}
                {assignTarget.unit.overdue ? " — overdue" : ""}
              </p>
            ) : (
              <p className="text-black/45">No expected return date was set.</p>
            )}
            {assignTarget.unit.notes ? (
              <p className="rounded-lg bg-black/[.03] px-3 py-2 text-black/60">{assignTarget.unit.notes}</p>
            ) : null}
            {modalError ? <p className="text-red-600">{modalError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setAssignTarget(null)}>
                Close
              </Button>
              <Button type="button" onClick={returnUnit} disabled={savingAssign}>
                {savingAssign ? "Saving…" : "Mark returned"}
              </Button>
            </div>
          </div>
        ) : assignTarget ? (
          <form onSubmit={saveAssign} className="space-y-4">
            <Field label="Team member">
              <Select
                value={assignForm.holderUserId}
                onChange={(e) => setAssignForm({ ...assignForm, holderUserId: e.target.value })}
              >
                <option value="">Someone else (enter name below)</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.fullName}
                  </option>
                ))}
              </Select>
            </Field>
            {assignForm.holderUserId === "" ? (
              <Field label="Holder name">
                <Input
                  value={assignForm.holderName}
                  onChange={(e) => setAssignForm({ ...assignForm, holderName: e.target.value })}
                  placeholder="e.g. Brother Yusuf (Sunday school)"
                  required
                />
              </Field>
            ) : null}
            <Field label="Return reminder">
              <Select
                value={assignForm.returnDays}
                onChange={(e) => setAssignForm({ ...assignForm, returnDays: e.target.value })}
              >
                {RETURN_OPTIONS.map((o) => (
                  <option key={o.label} value={o.days ?? ""}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Notes (optional)">
              <Textarea
                rows={2}
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                placeholder="e.g. Taken for the Saturday bazaar"
              />
            </Field>
            {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAssignTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingAssign}>
                {savingAssign ? "Saving…" : "Check out"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
