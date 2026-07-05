"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email }, false);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-serif text-3xl font-bold text-emerald">Donorly</h1>
          <p className="text-sm text-black/50">Reset your password</p>
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="rounded-lg bg-emerald-100 px-3 py-3 text-sm text-emerald">
              If an account exists for <span className="font-medium">{email}</span>, a reset link
              is on its way. Check your inbox — the link expires in 60 minutes.
            </p>
            <Link href="/login" className="inline-block text-sm text-emerald hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-black/60">
              Enter the email you use for Donorly and we&apos;ll send you a link to choose a new
              password.
            </p>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-black/50 hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
