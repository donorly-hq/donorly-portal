"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Landing } from "@/components/Landing";

export default function HomePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  // Signed-in users skip the marketing page and go straight to their dashboard.
  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [session, loading, router]);

  return <Landing />;
}
