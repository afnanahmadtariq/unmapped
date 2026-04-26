"use client";

import { useState } from "react";
import { CircleAlert, Loader2, Plus } from "lucide-react";
import { apiClient, ApiError } from "@/lib/apiClient";

export default function CreateSourceForm({
  onCreated,
}: {
  onCreated: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    slug: "",
    displayName: "",
    kind: "upload" as "harvester" | "upload",
    sourceUrl: "",
    cron: "",
    category: "",
    note: "",
    schemaSpec: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let schemaSpec: Record<string, unknown> | null = null;
      if (draft.schemaSpec.trim()) {
        try {
          schemaSpec = JSON.parse(draft.schemaSpec);
        } catch {
          throw new Error("schemaSpec must be valid JSON");
        }
      }
      await apiClient.adminCreateSource({
        slug: draft.slug,
        displayName: draft.displayName,
        kind: draft.kind,
        sourceUrl: draft.sourceUrl || null,
        cron: draft.cron || null,
        category: draft.category || null,
        note: draft.note || null,
        schemaSpec,
      });
      setOpen(false);
      setDraft({
        slug: "",
        displayName: "",
        kind: "upload",
        sourceUrl: "",
        cron: "",
        category: "",
        note: "",
        schemaSpec: "",
      });
      await onCreated();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error) setError(err.message);
      else setError("Failed to create source.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20"
      >
        <Plus className="h-3 w-3" /> New source
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border-default bg-bg-raised p-5">
      <h3 className="text-sm font-medium text-fg-primary">Register a new source</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Slug">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 font-mono text-sm"
            placeholder="my-custom-source"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
          />
        </Field>
        <Field label="Display name">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            value={draft.displayName}
            onChange={(e) =>
              setDraft({ ...draft, displayName: e.target.value })
            }
          />
        </Field>
        <Field label="Kind">
          <select
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            value={draft.kind}
            onChange={(e) =>
              setDraft({ ...draft, kind: e.target.value as "harvester" | "upload" })
            }
          >
            <option value="upload">upload</option>
            <option value="harvester">harvester</option>
          </select>
        </Field>
        <Field label="Source URL">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            value={draft.sourceUrl}
            onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
          />
        </Field>
        <Field label="Cron (optional)">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 font-mono text-sm"
            placeholder="0 6 * * *"
            value={draft.cron}
            onChange={(e) => setDraft({ ...draft, cron: e.target.value })}
          />
        </Field>
        <Field label="Category">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            placeholder="labor, education, automation, rag-corpus"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
          />
          <p className="mt-1 text-[11px] text-fg-muted">
            Use <code>rag-corpus</code> for sources whose payload is free-text
            and should be embedded into Milvus by default. Anything else is
            treated as structured data and routed to Postgres.
          </p>
        </Field>
        <Field label="Note" className="md:col-span-2">
          <textarea
            rows={2}
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 text-sm"
            placeholder="Free-form description shown to whoever uploads next."
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </Field>
        <Field label="schemaSpec (JSON, optional)" className="md:col-span-2">
          <textarea
            rows={6}
            className="w-full rounded-lg border border-border-default bg-bg-base px-2 py-1.5 font-mono text-xs"
            placeholder={`{
  "iscoEquivalent": "string",
  "pakOccupationCode": "string",
  "pakOccupationTitle": "string",
  "skillLevel": {"type": "enum", "values": ["1","2","3","4"]},
  "yearAdopted": {"type": "int", "optional": true}
}`}
            value={draft.schemaSpec}
            onChange={(e) =>
              setDraft({ ...draft, schemaSpec: e.target.value })
            }
          />
          <p className="mt-1 text-[11px] text-fg-muted">
            Supported types: <code>string</code>, <code>number</code>,{" "}
            <code>int</code>, <code>boolean</code>, <code>enum</code> (with{" "}
            <code>values</code>), <code>string[]</code>, <code>number[]</code>.
            Each can be wrapped as <code>{`{"type": "...", "optional": true}`}</code>
            . CSV uploads are coerced into these types automatically before
            validation.
          </p>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <CircleAlert className="h-4 w-4" /> {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border-default bg-bg-base px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Create source
        </button>
      </div>
    </div>
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
