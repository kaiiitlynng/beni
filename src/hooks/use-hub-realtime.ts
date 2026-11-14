import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABLES = ["messages", "benefits", "visits", "calendar_events", "plans_uploaded"] as const;

/** Refreshes the hub when a text, extraction or confirmed action changes the user's records. RLS limits events to the user's own rows. */
export function useHubRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: ["beni-hub"] }), 250);
    };
    const channel = supabase.channel("beni-hub-sync");
    for (const table of TABLES)
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}
