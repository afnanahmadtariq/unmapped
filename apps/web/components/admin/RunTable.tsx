"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  Download,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  apiClient,
  apiBase,
  ApiError,
  type AdminDataRun,
} from "@/lib/apiClient";

export default function RunTable({ initial }: { initial: AdminDataRun[] }) {
  const [runs, setRuns] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRuns(initial);
  }, [initial]);

  const refresh = async () => {
    try {
      const next = await apiClient.adminListRuns(100);
      setRuns(next);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const remove = async (id: string) => {
    if (
      !confirm(
        "Delete this run? Every Postgres row + Milvus vector + JSON archive tagged with this runId will be removed.",
      )
    ) {
      return;
    }
    setBusy(id);
    try {
      await apiClient.adminDeleteRun(id);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <CircleAlert className="h-4 w-4" /> {error}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-[10px] uppercase tracking-widest text-fg-muted">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Records</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-fg-secondary">
            {runs.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border-default last:border-b-0"
              >
                <td className="px-4 py-3 text-xs">
                  {new Date(r.startedAt).toLocaleString()}
                  {r.finishedAt && (
                    <div className="text-[10px] text-fg-muted">
                      finished {new Date(r.finishedAt).toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-fg-primary">
                  {r.sourceSlug}
                </td>
                <td className="px-4 py-3 text-xs">{r.kind}</td>
                <td className="px-4 py-3 text-xs">
                  <RunStatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3 text-xs">{r.recordCount}</td>
                <td className="px-4 py-3 text-xs">
                  {r.error ? (
                    <span className="text-danger">{r.error}</span>
                  ) : r.filename ? (
                    <span className="font-mono text-[11px]">{r.filename}</span>
                  ) : r.archivePath ? (
                    <span className="font-mono text-[11px] text-fg-muted">
                      {r.archivePath.split("/").slice(-2).join("/")}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.archivePath && (
                      <a
                        href={`${apiBase}/admin/runs/${r.id}/archive`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-base px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-raised"
                        title="Download the JSON archive for this run"
                      >
                        <Download className="h-3 w-3" />
                        Archive
                      </a>
                    )}
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy === r.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger hover:bg-danger/20 disabled:opacity-50"
                    >
                      {busy === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-fg-muted">
                  No runs yet. Trigger a source from the Sources tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: AdminDataRun["status"] }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-positive">
        <Check className="h-3 w-3" /> ok
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-danger">
        <AlertTriangle className="h-3 w-3" /> failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-warning">
      <Loader2 className="h-3 w-3 animate-spin" /> pending
    </span>
  );
}
