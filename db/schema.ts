import { sqliteTable,text,integer,index,uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const settings=sqliteTable('settings',{owner:text('owner').primaryKey(),hash:text('hash').notNull()});
export const employees=sqliteTable('employees',{id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),hash:text('hash').notNull()},t=>[index('employees_owner').on(t.owner)]);
export const shifts=sqliteTable('shifts',{id:text('id').primaryKey(),employee:text('employee').notNull().references(()=>employees.id),start:integer('start').notNull(),end:integer('end')},t=>[index('shifts_employee_start').on(t.employee,t.start),uniqueIndex('one_open_shift').on(t.employee).where(sql`${t.end} is null`)]);
export const attempts=sqliteTable('attempts',{owner:text('owner').primaryKey(),count:integer('count').notNull(),until:integer('until').notNull()});
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),owner:text('owner').notNull(),at:integer('at').notNull(),action:text('action').notNull(),employee:text('employee').notNull(),reason:text('reason').notNull(),before:text('before'),after:text('after')},t=>[index('audit_owner_at').on(t.owner,t.at)]);
export const payRates=sqliteTable('pay_rates',{id:text('id').primaryKey(),employee:text('employee').notNull().references(()=>employees.id),effective:text('effective').notNull(),type:text('type').notNull(),cents:integer('cents').notNull()},t=>[uniqueIndex('pay_rates_employee_effective').on(t.employee,t.effective)]);
export const kioskAccess=sqliteTable('kiosk_access',{owner:text('owner').primaryKey().references(()=>settings.owner),email:text('email').notNull()},t=>[uniqueIndex('kiosk_access_email').on(t.email)]);
