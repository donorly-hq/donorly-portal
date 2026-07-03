"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Invitation, RoleOption, TeamMember } from "@/lib/types";
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
} from "@/components/ui";

function inviteLink(token: string): string {
  if (typeof window === "undefined") return token;
  return `${window.location.origin}/invite/${token}`;
}

export default function TeamPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("users.manage");

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", roleCode: "" });
  const [inviting, setInviting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<TeamMember[]>("/team/members"),
      api.get<Invitation[]>("/team/invitations"),
      api.get<RoleOption[]>("/team/roles"),
    ])
      .then(([m, inv, r]) => {
        setMembers(m);
        setInvitations(inv);
        setRoles(r);
        if (!inviteForm.roleCode && r.length) {
          setInviteForm((f) => ({ ...f, roleCode: r[0].code }));
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const created = await api.post<Invitation>("/team/invitations", inviteForm);
      setCreatedLink(created.inviteToken ? inviteLink(created.inviteToken) : null);
      setInviteForm({ email: "", roleCode: roles[0]?.code ?? "" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (userId: string, roleCode: string) => {
    await api.patch(`/team/members/${userId}`, { roleCode });
    load();
  };

  const toggleStatus = async (member: TeamMember) => {
    const status = member.status === "active" ? "disabled" : "active";
    await api.patch(`/team/members/${member.userId}`, { status });
    load();
  };

  const revokeInvite = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    await api.delete(`/team/invitations/${id}`);
    load();
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setCreatedLink(null);
    setCopied(false);
    setError(null);
  };

  if (!canManage) {
    return <p className="text-black/60">You don&apos;t have permission to manage the team.</p>;
  }
  if (error && !members) return <p className="text-red-600">{error}</p>;
  if (!members) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Invite and manage the people in your organization"
        action={<Button onClick={() => setInviteOpen(true)}>Invite member</Button>}
      />

      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium text-emerald">{m.fullName}</td>
                <td className="px-4 py-3 text-black/60">{m.email}</td>
                <td className="px-4 py-3">
                  <Select
                    className="max-w-[200px]"
                    value={m.roleCode ?? ""}
                    onChange={(e) => changeRole(m.userId, e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                    {m.roleCode && !roles.some((r) => r.code === m.roleCode) ? (
                      <option value={m.roleCode}>{m.roleName ?? m.roleCode}</option>
                    ) : null}
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                </td>
                <td className="px-4 py-3 text-black/50">
                  {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-xs text-emerald hover:underline"
                    onClick={() => toggleStatus(m)}
                  >
                    {m.status === "active" ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-3 text-lg text-emerald">Pending invitations</h2>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-black/50">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 text-black/70">{inv.email}</td>
                <td className="px-4 py-3 text-black/60">{inv.roleName ?? inv.roleCode}</td>
                <td className="px-4 py-3 text-black/50">
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => revokeInvite(inv.id)}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
            {invitations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-black/40">
                  No pending invitations.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Modal open={inviteOpen} title="Invite team member" onClose={closeInvite}>
        {createdLink ? (
          <div className="space-y-4">
            <p className="text-sm text-black/70">
              Invitation created. Share this secure link with the person you invited — it lets
              them set a password and join your organization.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={createdLink} onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(createdLink);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-black/40">
              The link expires in 7 days. (Email delivery will be automated in a later phase.)
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={closeInvite}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
              />
            </Field>
            <Field label="Role">
              <Select
                value={inviteForm.roleCode}
                onChange={(e) => setInviteForm({ ...inviteForm, roleCode: e.target.value })}
                required
              >
                {roles.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeInvite}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Creating..." : "Create invitation"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
