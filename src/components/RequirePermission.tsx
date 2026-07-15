"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Card, Spinner } from "./ui";

/**
 * Client-side page guard: children (and therefore their data fetches) only
 * mount when the signed-in user holds the required permission. This is
 * defense-in-depth — the backend still enforces the same permission — but it
 * stops the page from even requesting data the user shouldn't see.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { session, loading, hasPermission } = useAuth();

  if (loading || !session) {
    return <Spinner />;
  }

  if (!hasPermission(permission)) {
    return (
      <Card className="mx-auto mt-12 max-w-md text-center">
        <p className="text-lg font-semibold">No access</p>
        <p className="mt-1 text-sm text-black/50">
          Your role doesn&apos;t include access to this page. If you think it
          should, ask your organization admin.
        </p>
      </Card>
    );
  }

  return <>{children}</>;
}
