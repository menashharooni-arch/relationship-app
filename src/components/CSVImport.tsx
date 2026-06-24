"use client";

import { useRef, useState } from "react";

type LeadRow = { name: string; email: string; phone: string; company: string };
type State = "idle" | "preview" | "importing" | "done" | "error";

function parseCSV(text: string): LeadRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const raw = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
  const col = (aliases: string[]) => raw.findIndex((h) => aliases.some((a) => h.includes(a)));

  const nameIdx    = col(["name", "full name", "contact"]);
  const emailIdx   = col(["email", "e-mail"]);
  const phoneIdx   = col(["phone", "mobile", "cell", "tel"]);
  const companyIdx = col(["company", "organization", "org", "business"]);

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    return {
      name:    nameIdx    >= 0 ? cells[nameIdx]    ?? "" : "",
      email:   emailIdx   >= 0 ? cells[emailIdx]   ?? "" : "",
      phone:   phoneIdx   >= 0 ? cells[phoneIdx]   ?? "" : "",
      company: companyIdx >= 0 ? cells[companyIdx] ?? "" : "",
    };
  }).filter((r) => r.name || r.email);
}

export default function CSVImport() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [imported, setImported] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() { setState("idle"); setRows([]); setErrorMsg(""); }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCSV(reader.result as string);
      if (parsed.length === 0) {
        setErrorMsg("No valid rows found. Make sure your CSV has name and/or email columns.");
        setState("error");
        return;
      }
      setRows(parsed);
      setState("preview");
    };
    reader.readAsText(file);
  }

  async function doImport() {
    setState("importing");
    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImported(json.imported);
      setState("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Import failed");
      setState("error");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"/>
        </svg>
        Import CSV
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => { setOpen(false); reset(); }} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden mb-4 sm:mb-0">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-slate-900 font-semibold text-sm">Import Contacts from CSV</h2>
            <p className="text-slate-400 text-xs mt-0.5">Upload a spreadsheet of existing contacts</p>
          </div>
          <button onClick={() => { setOpen(false); reset(); }} className="text-slate-400 hover:text-slate-600">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* IDLE: drop zone */}
          {state === "idle" && (
            <>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 mx-auto mb-3 text-slate-300">
                  <path d="M12 16V8m0 0l-3 3m3-3l3 3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="text-slate-600 text-sm font-medium">Click to upload a CSV file</p>
                <p className="text-slate-400 text-xs mt-1">Columns: name, email, phone, company</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
                <p className="font-medium text-slate-700 mb-1">Expected CSV format:</p>
                <code className="text-slate-600">name,email,phone,company</code><br/>
                <code className="text-slate-500">Jane Smith,jane@co.com,555-1234,Acme Inc</code>
              </div>
            </>
          )}

          {/* PREVIEW */}
          {state === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700 font-medium">{rows.length} contacts found</p>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">← Change file</button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Name", "Email", "Phone", "Company"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="px-3 py-2 text-slate-700 truncate max-w-[100px]">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{r.phone || "—"}</td>
                        <td className="px-3 py-2 text-slate-500 truncate max-w-[100px]">{r.company || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 5 && (
                  <p className="text-xs text-slate-400 text-center py-2">+{rows.length - 5} more rows</p>
                )}
              </div>
              <button
                onClick={doImport}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-full text-sm transition-colors"
              >
                Import {rows.length} contacts
              </button>
            </>
          )}

          {/* IMPORTING */}
          {state === "importing" && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
              <p className="text-slate-600 text-sm font-medium">Importing {rows.length} contacts...</p>
            </div>
          )}

          {/* DONE */}
          {state === "done" && (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-600">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <p className="text-slate-900 font-semibold">{imported} contacts imported!</p>
                <p className="text-slate-400 text-xs mt-1">They appear in your leads dashboard tagged "imported"</p>
              </div>
              <button
                onClick={() => { setOpen(false); reset(); window.location.reload(); }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-full text-sm transition-colors"
              >
                View leads
              </button>
            </div>
          )}

          {/* ERROR */}
          {state === "error" && (
            <div className="text-center py-4 space-y-3">
              <p className="text-red-600 text-sm font-medium">{errorMsg}</p>
              <button onClick={reset} className="w-full border border-slate-200 text-slate-600 font-medium py-2.5 rounded-full text-sm hover:border-slate-300 transition-colors">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
