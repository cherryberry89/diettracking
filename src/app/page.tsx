"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SetupNotice } from "@/components/app-context";
import { Spinner } from "@/components/ui";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSupabase()
      .auth.getSession()
      .then(({ data }) => router.replace(data.session ? "/today" : "/login"));
  }, [router]);
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}
