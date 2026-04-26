"use client";

import { useEffect, useState } from "react";
import SourceTable from "@/components/admin/SourceTable";
import CreateSourceForm from "@/components/admin/CreateSourceForm";
import { apiClient, type AdminDataSource } from "@/lib/apiClient";

export default function SourcesPanel({
  initial,
}: {
  initial: AdminDataSource[];
}) {
  const [sources, setSources] = useState(initial);

  const reload = async () => {
    try {
      const next = await apiClient.adminListSources();
      setSources(next);
    } catch {
      /* leave previous list */
    }
  };

  useEffect(() => {
    setSources(initial);
  }, [initial]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg-primary">Data sources</h2>
          <p className="text-xs text-fg-muted">
            Every harvester + admin upload-only slot is registered here. Edit
            URL/cron, manually trigger a run, or cascade-delete a source and
            all derivative rows.
          </p>
        </div>
        <CreateSourceForm onCreated={reload} />
      </header>
      <SourceTable initial={sources} />
    </div>
  );
}
