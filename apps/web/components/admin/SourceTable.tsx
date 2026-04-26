"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  Edit3,
  Loader2,
  Play,
  Trash2,
  X,
} from "lucide-react";
import {
  apiClient,
  ApiError,
  type AdminDataSource,
} from "@/lib/apiClient";

interface Props {
  initial: AdminDataSource[];
}

export default function SourceTable({ initial }: Props) {
  const [sources, setSources] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const next = await apiClient.adminListSources();
      setSources(next);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  useEffect(() => {
    setSources(initial);
  }, [initial]);

  const trigger = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const result = await apiClient.adminTriggerSource(id);
      if (!result.success) setError(result.message);
      await refresh();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (
      !confirm(
        "Delete this data source? This will cascade-delete every derived row in Postgres + Milvus + the JSON archive.",
      )
    ) {
      return;
    }
    setBusy(id);
    setError(null);
    try {
      await apiClient.adminDeleteSource(id);
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
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium">Cron</th>
              <th className="px-4 py-3 font-medium">Last run</th>
              <th className="px-4 py-3 font-medium">Runs</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-fg-secondary">
            {sources.map((s) => (
              <SourceRow
                key={s.id}
                source={s}
                busy={busy === s.id}
                editing={editing === s.id}
                setEditing={(v) => setEditing(v ? s.id : null)}
                onTrigger={() => trigger(s.id)}
                onDelete={() => remove(s.id)}
                onSaved={refresh}
                onError={setError}
              />
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-fg-muted">
                  No sources registered yet. Trigger a harvest or use the Upload
                  tab to seed one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SourceRow({
  source,
  busy,
  editing,
  setEditing,
  onTrigger,
  onDelete,
  onSaved,
  onError,
}: {
  source: AdminDataSource;
  busy: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onTrigger: () => void;
  onDelete: () => void;
  onSaved: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState({
    displayName: source.displayName,
    sourceUrl: source.sourceUrl ?? "",
    cron: source.cron ?? "",
    category: source.category ?? "",
    note: source.note ?? "",
    isActive: source.isActive,
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await apiClient.adminPatchSource(source.id, {
        displayName: draft.displayName,
        sourceUrl: draft.sourceUrl || null,
        cron: draft.cron || null,
        category: draft.category || null,
        note: draft.note || null,
        isActive: draft.isActive,
      });
      setEditing(false);
      await onSaved();
    } catch (err) {
      if (err instanceof ApiError) onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr className="border-b border-border-default last:border-b-0">
        <td className="px-4 py-3">
          <div className="font-medium text-fg-primary">{source.displayName}</div>
          <div className="font-mono text-[11px] text-fg-muted">
            {source.slug}
          </div>
          {source.sourceUrl && (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-accent hover:underline"
            >
              {source.sourceUrl}
            </a>
          )}
        </td>
        <td className="px-4 py-3 text-xs">{source.kind}</td>
        <td className="px-4 py-3 font-mono text-[11px]">{source.cron ?? "—"}</td>
        <td className="px-4 py-3 text-xs">
          {source.lastRun ? (
            <div>
              <RunBadge status={source.lastRun.status} />
              <div className="mt-1 text-fg-muted">
                {new Date(source.lastRun.startedAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <span className="text-fg-muted">No runs yet</span>
          )}
        </td>
        <td className="px-4 py-3 text-xs">{source.totalRuns}</td>
        <td className="px-4 py-3 text-xs">
          {source.isActive ? (
            <span className="inline-flex items-center gap-1 text-positive">
              <Check className="h-3 w-3" /> active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-fg-muted">
              <X className="h-3 w-3" /> paused
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-2">
            {source.kind === "harvester" && (
              <button
                onClick={onTrigger}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] text-accent hover:bg-accent/20 disabled:opacity-50"
                title="Trigger harvest now"
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Run
              </button>
            )}
            <button
              onClick={() => setEditing(!editing)}
              className="inline-flex items-center gap-1 rounded-lg border border-border-default bg-bg-base px-2 py-1 text-[11px] hover:border-accent/50"
            >
              <Edit3 className="h-3 w-3" />
              Edit
            </button>
            <button
              onClick={onDelete}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger hover:bg-danger/20 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-border-default bg-bg-base">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Display name">
                <input
                  className="w-full rounded-lg border border-border-default bg-bg-raised px-2 py-1.5 text-sm"
                  value={draft.displayName}
                  onChange={(e) =>
                    setDraft({ ...draft, displayName: e.target.value })
                  }
                />
              </Field>
              <Field label="Source URL">
                <input
                  className="w-full rounded-lg border border-border-default bg-bg-raised px-2 py-1.5 text-sm"
                  value={draft.sourceUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, sourceUrl: e.target.value })
                  }
                />
              </Field>
              <Field label="Cron expression">
                <input
                  className="w-full rounded-lg border border-border-default bg-bg-raised px-2 py-1.5 font-mono text-sm"
                  value={draft.cron}
                  onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <input
                  className="w-full rounded-lg border border-border-default bg-bg-raised px-2 py-1.5 text-sm"
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                />
              </Field>
              <Field label="Note" className="md:col-span-2">
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-border-default bg-bg-raised px-2 py-1.5 text-sm"
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) =>
                    setDraft({ ...draft, isActive: e.target.checked })
                  }
                />
                Active (cron + manual triggers will run)
              </label>
              <div className="flex justify-end gap-2 md:col-span-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-border-default bg-bg-raised px-3 py-1.5 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={saving}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RunBadge({ status }: { status: NonNullable<AdminDataSource["lastRun"]>["status"] | undefined }) {
  if (!status) return null;
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

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
