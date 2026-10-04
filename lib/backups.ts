import { env } from "cloudflare:workers";
import { database } from "../db/raw";

const prefixFor = (owner: string) => `owners/${owner}/backups/`;

function bucket() {
  if (!env.BUCKET) throw new Error("Backup storage is unavailable.");
  return env.BUCKET;
}

export async function createBackup(owner: string) {
  const db = database();
  const [settings, employees, shifts, payRates, audit, kiosk] = await Promise.all([
    db.prepare("SELECT owner,hash FROM settings WHERE owner=?").bind(owner).first(),
    db.prepare("SELECT id,name,hash FROM employees WHERE owner=? ORDER BY name").bind(owner).all(),
    db.prepare("SELECT s.id,s.employee,s.start,s.end FROM shifts s JOIN employees e ON e.id=s.employee WHERE e.owner=? ORDER BY s.start").bind(owner).all(),
    db.prepare("SELECT r.id,r.employee,r.effective,r.type,r.cents FROM pay_rates r JOIN employees e ON e.id=r.employee WHERE e.owner=? ORDER BY r.effective").bind(owner).all(),
    db.prepare("SELECT id,owner,at,action,employee,reason,before,after FROM audit WHERE owner=? ORDER BY at").bind(owner).all(),
    db.prepare("SELECT owner,email FROM kiosk_access WHERE owner=?").bind(owner).first(),
  ]);
  const createdAt = new Date().toISOString();
  const payload = {
    format: "store-time-clock-backup",
    version: 1,
    owner,
    createdAt,
    note: "PINs are stored only as one-way hashes so account access can be restored; plaintext PINs are never included.",
    tables: { settings: settings ? [settings] : [], employees: employees.results, shifts: shifts.results, payRates: payRates.results, audit: audit.results, kioskAccess: kiosk ? [kiosk] : [] },
  };
  const key = `${prefixFor(owner)}${createdAt.replaceAll(":", "-")}.json`;
  const body = JSON.stringify(payload);
  await bucket().put(key, body, {
    httpMetadata: { contentType: "application/json", contentDisposition: `attachment; filename="time-clock-${createdAt.slice(0, 10)}.json"` },
    customMetadata: { owner, createdAt, format: "store-time-clock-backup" },
  });
  return { key, createdAt, size: body.length };
}

export async function listBackups(owner: string) {
  const listed = await bucket().list({ prefix: prefixFor(owner), limit: 100 });
  return listed.objects.map((object) => ({ key: object.key, uploaded: object.uploaded, size: object.size }));
}

export async function getBackup(owner: string, key: string) {
  if (!key.startsWith(prefixFor(owner)) || !key.endsWith(".json")) throw new Error("Invalid backup.");
  const object = await bucket().get(key);
  if (!object) throw new Error("Backup not found.");
  return object;
}

export async function restoreBackup(owner: string, key: string) {
  const object = await getBackup(owner, key);
  const payload = await object.json() as any;
  if (payload?.format !== "store-time-clock-backup" || payload?.version !== 1 || payload?.owner !== owner) throw new Error("This backup does not belong to this store.");
  const tables = payload.tables;
  if (!tables || !Array.isArray(tables.employees) || !Array.isArray(tables.shifts) || !Array.isArray(tables.payRates) || !Array.isArray(tables.audit)) throw new Error("Backup is incomplete.");
  const db = database();
  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM pay_rates WHERE employee IN (SELECT id FROM employees WHERE owner=?)").bind(owner),
    db.prepare("DELETE FROM shifts WHERE employee IN (SELECT id FROM employees WHERE owner=?)").bind(owner),
    db.prepare("DELETE FROM audit WHERE owner=?").bind(owner),
    db.prepare("DELETE FROM kiosk_access WHERE owner=?").bind(owner),
    db.prepare("DELETE FROM employees WHERE owner=?").bind(owner),
  ];
  for (const employee of tables.employees) statements.push(db.prepare("INSERT INTO employees(id,owner,name,hash) VALUES (?,?,?,?)").bind(employee.id, owner, employee.name, employee.hash));
  for (const shift of tables.shifts) statements.push(db.prepare("INSERT INTO shifts(id,employee,start,end) VALUES (?,?,?,?)").bind(shift.id, shift.employee, shift.start, shift.end ?? null));
  for (const rate of tables.payRates) statements.push(db.prepare("INSERT INTO pay_rates(id,employee,effective,type,cents) VALUES (?,?,?,?,?)").bind(rate.id, rate.employee, rate.effective, rate.type, rate.cents));
  for (const record of tables.audit) statements.push(db.prepare("INSERT INTO audit(id,owner,at,action,employee,reason,before,after) VALUES (?,?,?,?,?,?,?,?)").bind(record.id, owner, record.at, record.action, record.employee, record.reason, record.before ?? null, record.after ?? null));
  if (Array.isArray(tables.kioskAccess) && tables.kioskAccess[0]?.email) statements.push(db.prepare("INSERT INTO kiosk_access(owner,email) VALUES (?,?)").bind(owner, tables.kioskAccess[0].email));
  await db.batch(statements);
  return { restoredAt: new Date().toISOString(), key };
}

export async function bestEffortBackup(owner: string) {
  try { await createBackup(owner); } catch (error) { console.error("Automatic backup failed", error); }
}
