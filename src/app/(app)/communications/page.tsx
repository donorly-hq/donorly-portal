"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CommunicationMessage, Donor, MessageTemplate, SendResult } from "@/lib/types";
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
  Textarea,
  dateTime,
} from "@/components/ui";

type Tab = "templates" | "send" | "history";

const emptyTemplate = { name: "", channel: "email", subject: "", body: "" };

function statusTone(status: string): "success" | "warning" | "info" | "neutral" {
  if (status === "sent") return "success";
  if (status === "failed") return "warning";
  if (status === "skipped") return "neutral";
  return "info";
}

export default function CommunicationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("communications.manage");
  const canSend = hasPermission("communications.send");

  const [tab, setTab] = useState<Tab>("send");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);

  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [selectedDonors, setSelectedDonors] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [donorSearch, setDonorSearch] = useState("");

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel],
  );

  const filteredDonors = useMemo(() => {
    const q = donorSearch.toLowerCase();
    return donors.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        (d.email?.toLowerCase().includes(q) ?? false),
    );
  }, [donors, donorSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, m, d] = await Promise.all([
        api.get<MessageTemplate[]>("/communications/templates"),
        api.get<CommunicationMessage[]>("/communications/messages"),
        canSend ? api.get<Donor[]>("/donors") : Promise.resolve([] as Donor[]),
      ]);
      setTemplates(t);
      setMessages(m);
      setDonors(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load communications");
    } finally {
      setLoading(false);
    }
  }, [canSend]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (t) {
      setSubject(t.subject ?? "");
      setBody(t.body);
    }
  }, [templateId, templates]);

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplate);
    setTemplateModal(true);
  };

  const openEditTemplate = (t: MessageTemplate) => {
    setEditingTemplateId(t.id);
    setTemplateForm({
      name: t.name,
      channel: t.channel,
      subject: t.subject ?? "",
      body: t.body,
    });
    setTemplateModal(true);
  };

  const saveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    setError(null);
    try {
      const payload = {
        name: templateForm.name,
        channel: templateForm.channel,
        subject: templateForm.channel === "email" ? templateForm.subject : null,
        body: templateForm.body,
      };
      if (editingTemplateId) {
        await api.put(`/communications/templates/${editingTemplateId}`, payload);
      } else {
        await api.post("/communications/templates", payload);
      }
      setTemplateModal(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await api.delete(`/communications/templates/${id}`);
    load();
  };

  const toggleDonor = (id: string) => {
    setSelectedDonors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedDonors(new Set(filteredDonors.map((d) => d.id)));
  };

  const clearSelection = () => setSelectedDonors(new Set());

  const handleSend = async () => {
    if (selectedDonors.size === 0) {
      setError("Select at least one donor");
      return;
    }
    setSending(true);
    setError(null);
    setSendResult(null);
    const payload = {
      channel,
      donorIds: Array.from(selectedDonors),
      templateId: templateId || null,
      subject: templateId ? null : subject || null,
      body: templateId ? null : body,
    };
    try {
      if (selectedDonors.size === 1) {
        await api.post("/communications/send", {
          channel,
          donorId: Array.from(selectedDonors)[0],
          templateId: templateId || null,
          subject: templateId ? null : subject || null,
          body: templateId ? null : body,
        });
        setSendResult({ sent: 1, skipped: 0, failed: 0 });
      } else {
        const result = await api.post<SendResult>("/communications/broadcast", payload);
        setSendResult(result);
      }
      clearSelection();
      const m = await api.get<CommunicationMessage[]>("/communications/messages");
      setMessages(m);
      setTab("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner />;
  if (error && templates.length === 0 && messages.length === 0) {
    return <p className="text-red-600">{error}</p>;
  }

  return (
    <div>
      <PageHeader
        title="Communications"
        subtitle="Email and SMS templates, outbound messages, and delivery history"
      />

      <div className="mb-6 flex gap-2 border-b border-black/10">
        {(["send", "templates", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t
                ? "border-emerald text-emerald"
                : "border-transparent text-black/50 hover:text-black/70"
            }`}
          >
            {t === "send" ? "Send message" : t}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {tab === "templates" ? (
        <div>
          <div className="mb-4 flex justify-end">
            {canManage ? (
              <Button onClick={openCreateTemplate}>New template</Button>
            ) : null}
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left text-black/50">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  {canManage ? <th className="px-4 py-3" /> : null}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-black/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-emerald">{t.name}</td>
                    <td className="px-4 py-3 uppercase text-black/60">{t.channel}</td>
                    <td className="px-4 py-3 text-black/60">{t.subject ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={t.system ? "info" : "neutral"}>
                        {t.system ? "System" : "Custom"}
                      </Badge>
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {!t.system ? (
                          <>
                            <button
                              className="mr-3 text-xs text-emerald hover:underline"
                              onClick={() => openEditTemplate(t)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs text-red-600 hover:underline"
                              onClick={() => deleteTemplate(t.id)}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-black/30">Built-in</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-black/40">
                      No templates yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-black/40">
            Use placeholders: {"{{donor_name}}"}, {"{{organization_name}}"}
          </p>
        </div>
      ) : null}

      {tab === "send" && canSend ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <Field label="Channel">
              <Select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value as "email" | "sms");
                  setTemplateId("");
                  setSubject("");
                  setBody("");
                }}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Select>
            </Field>
            <Field label="Template (optional)">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Custom message</option>
                {channelTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            {!templateId && channel === "email" ? (
              <Field label="Subject">
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
            ) : null}
            {!templateId ? (
              <Field label="Message">
                <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
              </Field>
            ) : (
              <div className="rounded-lg bg-black/5 p-3 text-sm text-black/60">
                <p className="mb-1 font-medium text-black/70">Preview</p>
                {channel === "email" && subject ? (
                  <p className="mb-2">
                    <span className="text-black/40">Subject: </span>
                    {subject}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap">{body}</p>
              </div>
            )}
            <Button onClick={handleSend} disabled={sending}>
              {sending
                ? "Sending..."
                : `Send to ${selectedDonors.size || 0} donor${selectedDonors.size === 1 ? "" : "s"}`}
            </Button>
            {sendResult ? (
              <p className="text-sm text-emerald">
                Sent: {sendResult.sent}, skipped: {sendResult.skipped}, failed: {sendResult.failed}
              </p>
            ) : null}
            <p className="text-xs text-black/40">
              Delivery is logged locally for now. Connect SendGrid/Twilio in production.
            </p>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold text-emerald">Recipients</h3>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" className="text-xs" onClick={selectAllVisible}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" className="text-xs" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
            <Input
              className="mb-3"
              placeholder="Search donors..."
              value={donorSearch}
              onChange={(e) => setDonorSearch(e.target.value)}
            />
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {filteredDonors.map((d) => {
                const contact = channel === "email" ? d.email : d.phone;
                const disabled = !contact;
                return (
                  <li key={d.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        disabled ? "opacity-40" : "hover:bg-black/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDonors.has(d.id)}
                        disabled={disabled}
                        onChange={() => toggleDonor(d.id)}
                      />
                      <span className="flex-1">
                        <span className="font-medium text-emerald">{d.fullName}</span>
                        <span className="block text-xs text-black/40">
                          {contact ?? `No ${channel === "email" ? "email" : "phone"}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      {tab === "send" && !canSend ? (
        <Card>
          <p className="text-center text-black/50">You don&apos;t have permission to send messages.</p>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-black/50">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Donor</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Template</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-3 text-black/50">{dateTime(m.sentAt ?? m.createdAt)}</td>
                  <td className="px-4 py-3 text-emerald">{m.donorName ?? "—"}</td>
                  <td className="px-4 py-3 uppercase">{m.channel}</td>
                  <td className="px-4 py-3 text-black/60">{m.recipient}</td>
                  <td className="px-4 py-3 text-black/60">{m.templateName ?? "Custom"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                    {m.errorMessage ? (
                      <span className="mt-1 block text-xs text-red-600">{m.errorMessage}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-black/40">
                    No messages sent yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Modal
        open={templateModal}
        title={editingTemplateId ? "Edit template" : "New template"}
        onClose={() => setTemplateModal(false)}
      >
        <form onSubmit={saveTemplate} className="space-y-4">
          <Field label="Name">
            <Input
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Channel">
            <Select
              value={templateForm.channel}
              onChange={(e) =>
                setTemplateForm({ ...templateForm, channel: e.target.value as "email" | "sms" })
              }
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </Select>
          </Field>
          {templateForm.channel === "email" ? (
            <Field label="Subject">
              <Input
                value={templateForm.subject}
                onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Body">
            <Textarea
              rows={6}
              value={templateForm.body}
              onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
              required
            />
          </Field>
          <p className="text-xs text-black/40">
            Placeholders: {"{{donor_name}}"}, {"{{organization_name}}"}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savingTemplate}>
              {savingTemplate ? "Saving..." : "Save template"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
