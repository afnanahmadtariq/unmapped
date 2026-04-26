"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Database, FileText, Loader2, Plus, Upload } from "lucide-react";
import {
  apiClient,
  ApiError,
  type AdminDataSource,
} from "@/lib/apiClient";

interface SchemaField {
  name: string;
  type: string;
  optional: boolean;
  values?: string[];
}

function describeSchema(spec: Record<string, unknown> | null): SchemaField[] {
  if (!spec) return [];
  return Object.entries(spec).map(([name, raw]) => {
    const config = (raw && typeof raw === "object" ? raw : { type: raw }) as {
      type?: string;
      optional?: boolean;
      values?: string[];
    };
    return {
      name,
      type: config.type ?? "string",
      optional: !!config.optional,
      values: config.values,
    };
  });
}

const VECTOR_BUILTIN_SLUGS = new Set(["policy_reports", "training_programs"]);

function inferTargetStore(
  source: AdminDataSource | undefined,
  loader: "" | "postgres" | "vector",
): "postgres" | "vector" {
  if (loader === "postgres") return "postgres";
  if (loader === "vector") return "vector";
  if (!source) return "postgres";
  if (VECTOR_BUILTIN_SLUGS.has(source.slug)) return "vector";
  if (source.category === "rag-corpus") return "vector";
  return "postgres";
}

export default function UploadDialog({ sources }: { sources: AdminDataSource[] }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [loader, setLoader] = useState<"" | "postgres" | "vector">("");
  const [category, setCategory] = useState("");
  const [keyFields, setKeyFields] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    runId: string;
    persisted: number;
    note?: string;
    format?: "csv" | "json" | "ndjson" | "text";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => sources.find((s) => s.id === sourceId),
    [sources, sourceId],
  );
  const schema = useMemo(
    () => describeSchema(selected?.schemaSpec ?? null),
    [selected],
  );
  const target = inferTargetStore(selected, loader);

  const submit = async () => {
    if (!sourceId || !file) {
      setError("Choose a target source and a file to upload.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await apiClient.adminUploadToSource(sourceId, file, {
        loader: loader || undefined,
        category: category || undefined,
        keyFields:
          keyFields
            .split(/[|,;\s]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0) || undefined,
      });
      setResult(r);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const sourceOptions = sources.length > 0 ? sources : [];

  return (
    <div className="space-y-4 rounded-2xl border border-border-default bg-bg-raised p-6">
      <header className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
          <Upload className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-medium text-fg-primary">
            Upload a dataset
          </h2>
          <p className="text-xs text-fg-muted">
            Structured data (CSV / JSON / NDJSON) lands in Postgres against the
            source&apos;s declared schema. Unstructured text (Markdown / .txt)
            is chunked, embedded, and routed into a per-source Milvus
            collection. Each upload becomes a `dataset_runs` row that fully
            cascade-deletes from the Runs tab.
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
            Target source
          </label>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm"
          >
            {sourceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName} ({s.slug}) — {s.kind}
              </option>
            ))}
          </select>
          {selected?.note && (
            <p className="mt-1 text-[11px] text-fg-muted">{selected.note}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
            Loader
          </label>
          <select
            value={loader}
            onChange={(e) => setLoader(e.target.value as "" | "postgres" | "vector")}
            className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm"
          >
            <option value="">Auto (based on slug + category)</option>
            <option value="postgres">Postgres (structured)</option>
            <option value="vector">Vector / Milvus (embedded text)</option>
          </select>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-fg-muted">
            {target === "vector" ? (
              <>
                <FileText className="h-3 w-3" /> will embed into{" "}
                <code>cartographer_custom_{selected?.slug ?? "&lt;slug&gt;"}</code>
              </>
            ) : (
              <>
                <Database className="h-3 w-3" /> will upsert into{" "}
                <code>{selected?.slug && [
                  "frey-osborne",
                  "wb-wdi",
                  "wb-hci",
                  "ilo-isco",
                  "ilo-ilostat",
                  "un-population",
                  "wittgenstein",
                  "unesco-uis",
                  "ilo-fow",
                  "itu-digital",
                  "onet",
                ].includes(selected.slug) ? `${selected.slug} table` : "custom_records"}</code>
              </>
            )}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
            Category override (optional)
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. labor, education, rag-corpus"
            className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 text-sm"
          />
        </div>
        {target === "postgres" && (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
              Key columns (optional)
            </label>
            <input
              value={keyFields}
              onChange={(e) => setKeyFields(e.target.value)}
              placeholder="e.g. iscoCode  or  iso3,year"
              className="w-full rounded-lg border border-border-default bg-bg-base px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-[11px] text-fg-muted">
              When set, repeat uploads upsert by these fields instead of
              appending. Leave empty to insert every row as new history.
            </p>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="mb-1 block text-[10px] uppercase tracking-widest text-fg-muted">
            File
          </label>
          <input
            type="file"
            accept=".csv,.json,.ndjson,.md,.markdown,.txt,application/json,text/csv,text/markdown,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-fg-secondary file:mr-3 file:rounded-lg file:border file:border-border-default file:bg-bg-base file:px-3 file:py-1.5 file:text-xs file:text-fg-secondary"
          />
          <p className="mt-1 text-[11px] text-fg-muted">
            {target === "vector"
              ? ".md, .txt, .csv (with body column), or JSON/NDJSON arrays of {documentId, title, body}."
              : ".csv (with header row), .json (array or {records:[…]}), or .ndjson."}
          </p>
        </div>
      </div>

      {schema.length > 0 && (
        <div className="rounded-lg border border-border-default bg-bg-base p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-fg-muted">
              Expected fields
            </span>
            <span className="text-[10px] text-fg-muted">
              from <code>{selected?.slug}</code>.schemaSpec
            </span>
          </div>
          <div className="grid gap-1 text-xs md:grid-cols-2">
            {schema.map((f) => (
              <div
                key={f.name}
                className="flex items-baseline justify-between gap-3 rounded border border-border-default/50 bg-bg-raised px-2 py-1"
              >
                <code className="font-mono text-fg-primary">{f.name}</code>
                <span className="text-fg-muted">
                  {f.type}
                  {f.values ? `(${f.values.join("|")})` : ""}
                  {f.optional ? " · optional" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && schema.length === 0 && target === "postgres" && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <strong>No schemaSpec defined for {selected.slug}.</strong> Records
          will be persisted as JSONB into <code>custom_records</code> with no
          field validation. Edit the source from the Sources tab to declare a
          schema for this slug.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="rounded-lg border border-positive/30 bg-positive/10 p-3 text-xs text-positive">
          <div>
            <strong>Run {result.runId.slice(0, 8)}…</strong> — persisted{" "}
            {result.persisted} rows
            {result.format ? ` (${result.format} parser)` : ""}.
          </div>
          {result.note && <div className="mt-1 text-positive/80">{result.note}</div>}
        </div>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Upload + create run
      </button>
    </div>
  );
}
