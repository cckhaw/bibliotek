"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Result {
  dryRun: boolean; totalRows: number; errorCount: number; truncated: boolean;
  errors: { line: number; field?: string; message: string }[];
  [k: string]: unknown;
}

const summary = (r: Result) =>
  Object.entries(r)
    .filter(([k, v]) => typeof v === "number" && !["errorCount"].includes(k))
    .map(([k, v]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${v}`)
    .join(" · ");

export function CsvUpload({ endpoint, title, templateHref, columns }: { endpoint: string; title: string; templateHref: string; columns: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(dryRun: boolean) {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${endpoint}${dryRun ? "?dryRun=1" : ""}`, { method: "POST", headers: { "content-type": "text/csv" }, body: await file.text() });
      const data = await res.json();
      if (!res.ok) setError(data?.error?.message ?? "Import failed");
      else { setResult(data); if (!dryRun) { router.refresh(); } }
    } catch { setError("Network error"); }
    setBusy(false);
  }

  function downloadErrors() {
    if (!result) return;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = ["line,field,message", ...result.errors.map((e) => `${e.line},${e.field ?? ""},${esc(e.message)}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "import-errors.csv";
    a.click();
  }

  return (
    <section className="card">
      <h2 className="h2">{title}</h2>
      <p className="muted mb-3">Columns: <code className="break-words">{columns}</code>. <a className="text-brand-600 underline" href={templateHref} download>Download template</a></p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input ref={input} type="file" accept=".csv,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} className="input" aria-label={`${title} CSV file`} />
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!file || busy} onClick={() => send(true)}>Validate</button>
          <button className="btn-primary" disabled={!file || busy} onClick={() => send(false)}>{busy ? "Working…" : "Import"}</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="mt-4 space-y-3" role="status">
          <p className="text-sm font-medium">{result.dryRun ? "Validation only — nothing saved. " : "Import complete. "}<span className="font-normal">{summary(result)}</span></p>
          {result.errorCount > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-amber-700">{result.errorCount} row problem(s){result.truncated ? " (showing first 500)" : ""}. Valid rows {result.dryRun ? "would be" : "were"} imported; fix the rest and re-upload them.</p>
                <button className="btn-ghost btn-sm" onClick={downloadErrors}>Download report</button>
              </div>
              <div className="table-wrap max-h-72 overflow-y-auto">
                <table className="table"><thead><tr><th>Line</th><th>Field</th><th>Problem</th></tr></thead>
                  <tbody>{result.errors.map((e, i) => <tr key={i}><td>{e.line}</td><td>{e.field ?? "—"}</td><td>{e.message}</td></tr>)}</tbody></table>
              </div>
            </>
          ) : <p className="text-sm text-emerald-700">No problems found.</p>}
        </div>
      )}
    </section>
  );
}
