"use client";
import {useStoreApi} from './store-context';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ImportBackup from './import-backup';

type Backup = { key: string; uploaded: string; size: number; kind?: string };

export default function BackupPanel({ pin }: { pin: string }) {
 const apiFetch=useStoreApi();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function call(body: Record<string, unknown>) {
    const response = await apiFetch("/api/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, pin }) });
    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error || "Backup request failed.");
    return data;
  }
  async function refresh() { const data: any = await call({ action: "backup_list" }); const rows: Backup[] = data.backups || []; setBackups(rows); setSelected(keys => keys.filter(key => rows.some(row => row.key === key))); }
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, [pin]);
  async function create() { setBusy(true); setError(""); setMessage(""); try { await call({ action: "backup_create" }); await refresh(); setMessage("Backup created successfully."); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  async function download(key: string) {
    setBusy(true); setError("");
    try {
      const response = await apiFetch("/api/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "backup_download", key, pin }) });
      if (!response.ok) throw new Error(((await response.json()) as any).error || "Download failed.");
      const blob = await response.blob(), url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = `time-clock-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
      setMessage("Backup downloaded. Store it somewhere secure.");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function removeMany(keys: string[]) {
    const targets = [...new Set(keys)].filter(key => backups.some(backup => backup.key === key));
    if (!targets.length || busy) return;
    if (!window.confirm(`Permanently delete ${targets.length} selected backup${targets.length === 1 ? "" : "s"}? Current employees, shifts, and payroll will stay unchanged. Deleted backups cannot be restored.`)) return;
    setBusy(true); setError(""); setMessage("");
    let deleted = 0;
    try {
      for (const key of targets) {
        await call({ action: "backup_delete", key });
        deleted++;
        setBackups(rows => rows.filter(row => row.key !== key));
        setSelected(current => current.filter(item => item !== key));
        setMessage(`Deleted ${deleted} of ${targets.length} backups…`);
      }
      setMessage(`Deleted ${deleted} backup${deleted === 1 ? "" : "s"}. Current records were not changed.`);
    } catch (e: any) {
      setMessage(`Deleted ${deleted} of ${targets.length} backups.`);
      setError(`Deletion stopped: ${e.message} Remaining backups stay selected; retry when ready.`);
    } finally { setBusy(false); }
  }
  async function restore(key: string) {
    if (!window.confirm("Restore this backup? Current employees, shifts, pay settings, and change history will be replaced by the backup.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await call({ action: "backup_restore", key }); await refresh(); setMessage("Backup restored successfully."); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <><ImportBackup pin={pin}/><section className="panel backup-panel">
    <div className="section-title"><div><p className="eyebrow">DATA SAFETY</p><h2>Backups</h2><p>Backups no longer run after every edit. The daily schedule is midnight Central Time; it requires activation by the owner. You can also create a backup now.</p></div><Button onClick={create} disabled={busy}>{busy ? "Working…" : "Create backup now"}</Button></div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    {backups.length > 0 && <div className="backup-selection">
      <label><input type="checkbox" checked={selected.length === backups.length} disabled={busy} onChange={e => setSelected(e.target.checked ? backups.map(backup => backup.key) : [])}/> Select all shown</label>
      <span>{selected.length} selected</span>
      <Button className="backup-delete" variant="destructive" disabled={busy || !selected.length} onClick={() => removeMany(selected)}>Delete selected ({selected.length})</Button>
    </div>}
    <div className="backup-list">{backups.map((backup) => <div key={backup.key}><label className="backup-pick"><input type="checkbox" aria-label={`Select backup from ${new Date(backup.uploaded).toLocaleString("en-US", { timeZone: "America/Chicago" })}`} disabled={busy} checked={selected.includes(backup.key)} onChange={e => setSelected(keys => e.target.checked ? [...keys, backup.key] : keys.filter(key => key !== backup.key))}/><span><b>{new Date(backup.uploaded).toLocaleString("en-US", { timeZone: "America/Chicago" })}</b><small>{Math.ceil(backup.size / 1024)} KB · {backup.kind==='daily'?'Daily':backup.kind==='automatic'?'Automatic':backup.kind==='before-restore'||backup.kind==='after-restore'?'Restore safety copy':'Manual'} · Central Time</small></span></label><div className="backup-actions"><Button variant="outline" onClick={() => download(backup.key)} disabled={busy}>Download</Button><Button variant="outline" onClick={() => restore(backup.key)} disabled={busy}>Restore</Button><Button className="backup-delete" variant="destructive" onClick={() => removeMany([backup.key])} disabled={busy}>Delete</Button></div></div>)}{!backups.length && <p className="muted">No backups yet. Create the first one now.</p>}</div>
    <p className="muted backup-note">Backups contain one-way PIN hashes so accounts can be restored; they never contain plaintext PINs. Protect downloaded backup files like payroll records.</p>
  </section></>;
}
