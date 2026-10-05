"use client";
import {useStoreApi} from './store-context';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ImportBackup from './import-backup';

type Backup = { key: string; uploaded: string; size: number; kind?: string };

export default function BackupPanel({ pin }: { pin: string }) {
 const apiFetch=useStoreApi();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function call(body: Record<string, unknown>) {
    const response = await apiFetch("/api/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, pin }) });
    const data: any = await response.json();
    if (!response.ok) throw new Error(data.error || "Backup request failed.");
    return data;
  }
  async function refresh() { const data: any = await call({ action: "backup_list" }); setBackups(data.backups || []); }
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
  async function remove(key: string) {
    if (!window.confirm("Permanently delete this backup? Current employees, shifts, and payroll will stay unchanged. This backup cannot be restored afterward.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await call({ action: "backup_delete", key }); await refresh(); setMessage("Backup deleted. Current records were not changed."); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function restore(key: string) {
    if (!window.confirm("Restore this backup? Current employees, shifts, pay settings, and change history will be replaced by the backup.")) return;
    setBusy(true); setError(""); setMessage("");
    try { await call({ action: "backup_restore", key }); await refresh(); setMessage("Backup restored successfully."); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <><ImportBackup pin={pin}/><section className="panel backup-panel">
    <div className="section-title"><div><p className="eyebrow">DATA SAFETY</p><h2>Backups</h2><p>Backups no longer run after every edit. The daily schedule is midnight Central Time; it requires activation by the owner. You can also create a backup now.</p></div><Button onClick={create} disabled={busy}>{busy ? "Working…" : "Create backup now"}</Button></div>
    {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
    <div className="backup-list">{backups.map((backup) => <div key={backup.key}><span><b>{new Date(backup.uploaded).toLocaleString("en-US", { timeZone: "America/Chicago" })}</b><small>{Math.ceil(backup.size / 1024)} KB · {backup.kind==='daily'?'Daily':backup.kind==='automatic'?'Automatic':backup.kind==='before-restore'||backup.kind==='after-restore'?'Restore safety copy':'Manual'} · Central Time</small></span><div><Button variant="outline" onClick={() => download(backup.key)} disabled={busy}>Download</Button><Button variant="outline" onClick={() => restore(backup.key)} disabled={busy}>Restore</Button><Button variant="destructive" onClick={() => remove(backup.key)} disabled={busy}>Delete</Button></div></div>)}{!backups.length && <p className="muted">No backups yet. Create the first one now.</p>}</div>
    <p className="muted backup-note">Backups contain one-way PIN hashes so accounts can be restored; they never contain plaintext PINs. Protect downloaded backup files like payroll records.</p>
  </section></>;
}
