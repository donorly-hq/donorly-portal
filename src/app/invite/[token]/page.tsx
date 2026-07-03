"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { InvitationInfo } from "@/lib/types";
import { Button, Card, Field, Input, Spinner } from "@/components/ui";

export default function AcceptInvitePage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;
  const router = useRouter();

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api
      .get<InvitationInfo>(`/invitations/${token}`)
      .then(setInfo)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load invitation"));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(
        "/invitations/accept",
        {
          token,
          fullName: info?.existingUser ? undefined : fullName,
          password: info?.existingUser ? undefined : password,
        },
        false,
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-bold text-emerald">Donorly</h1>
          <p className="text-sm text-black/50">Team invitation</p>
        </div>

        {!info && !error ? <Spinner /> : null}

        {error && !info ? <p className="text-center text-red-600">{error}</p> : null}

        {info && !info.valid ? (
          <div className="space-y-4 text-center">
            <p className="text-black/70">
              This invitation is no longer valid. It may have expired or already been used.
            </p>
            <Button onClick={() => router.replace("/login")}>Go to sign in</Button>
          </div>
        ) : null}

        {info && info.valid && done ? (
          <div className="space-y-4 text-center">
            <p className="text-black/70">
              You&apos;ve joined <strong>{info.organizationName}</strong>. You can now sign in.
            </p>
            <Button onClick={() => router.replace("/login")}>Go to sign in</Button>
          </div>
        ) : null}

        {info && info.valid && !done ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-black/60">
              You&apos;ve been invited to join <strong>{info.organizationName}</strong> as{" "}
              <strong>{info.roleName}</strong>.
            </p>
            <Field label="Email">
              <Input value={info.email ?? ""} readOnly disabled />
            </Field>
            {info.existingUser ? (
              <p className="rounded-lg bg-emerald/5 px-3 py-2 text-sm text-black/60">
                You already have a Donorly account. Accept to join this organization; sign in with
                your existing password.
              </p>
            ) : (
              <>
                <Field label="Your full name">
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </Field>
                <Field label="Create a password">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Joining..." : "Accept invitation"}
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
