"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button, Card, Field, Input } from "@/components/ui";
import type { OrgChoice } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, login, verifyOtp, selectOrg } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [showOrgField, setShowOrgField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Two-step verification (platform admins)
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");

  // Organization picker (users belonging to several orgs)
  const [orgChallengeId, setOrgChallengeId] = useState<string | null>(null);
  const [orgChoices, setOrgChoices] = useState<OrgChoice[]>([]);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [loading, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, orgSlug);
      if (result.otpRequired && result.challengeId) {
        setChallengeId(result.challengeId);
      } else if (result.orgSelectionRequired && result.challengeId) {
        setOrgChallengeId(result.challengeId);
        setOrgChoices(result.organizations ?? []);
      } else {
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectOrg = async (organizationId: string) => {
    if (!orgChallengeId) return;
    setError(null);
    setSubmitting(true);
    try {
      await selectOrg(orgChallengeId, organizationId);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign in failed");
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyOtp(challengeId, otpCode);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-bold text-emerald">Donorly</h1>
          <p className="text-sm text-black/50">
            Every pledge honored. Every donor remembered. Every campaign accounted for.
          </p>
        </div>

        {orgChallengeId ? (
          <div className="space-y-4">
            <p className="text-sm text-black/60">
              You belong to <span className="font-medium">{orgChoices.length} organizations</span>.
              Choose the one you want to work in — you can switch anytime from the top bar.
            </p>
            <div className="space-y-2">
              {orgChoices.map((org) => (
                <button
                  key={org.organizationId}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSelectOrg(org.organizationId)}
                  className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-left transition hover:border-emerald/40 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {org.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={org.logoUrl}
                      alt=""
                      className="h-9 w-9 rounded object-contain"
                    />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-emerald-100 font-serif text-lg font-bold text-emerald">
                      {org.name.charAt(0)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-emerald">{org.name}</span>
                    {org.roleName ? (
                      <span className="block text-xs text-black/50">{org.roleName}</span>
                    ) : null}
                  </span>
                  <span className="text-black/30">&rsaquo;</span>
                </button>
              ))}
            </div>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <button
              type="button"
              className="w-full text-center text-xs text-black/50 hover:underline"
              onClick={() => {
                setOrgChallengeId(null);
                setOrgChoices([]);
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : challengeId ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-black/60">
              We emailed a 6-digit code to <span className="font-medium">{email}</span>. Enter it
              below to finish signing in. The code expires in 10 minutes.
            </p>
            <Field label="Verification code">
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
                autoFocus
              />
            </Field>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting || otpCode.length !== 6}>
              {submitting ? "Verifying..." : "Verify & sign in"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-black/50 hover:underline"
              onClick={() => {
                setChallengeId(null);
                setOtpCode("");
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Field>

            {showOrgField ? (
              <Field label="Organization">
                <Input
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  placeholder="e.g. jamia-masjid-chicago"
                  autoFocus
                />
              </Field>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            <div className="flex items-center justify-between text-xs">
              <Link href="/forgot-password" className="text-emerald hover:underline">
                Forgot password?
              </Link>
              <button
                type="button"
                className="text-black/40 hover:text-black/60 hover:underline"
                onClick={() => {
                  setShowOrgField((v) => !v);
                  if (showOrgField) setOrgSlug("");
                }}
              >
                {showOrgField ? "Hide organization" : "Sign in to a specific organization"}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
