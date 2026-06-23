import { pgTable, text, numeric, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehiclesTable = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  registration_number: text("registration_number").notNull(),
  make: text("make").notNull(),
  model: text("model").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertVehicleSchema = createInsertSchema(vehiclesTable).omit({ id: true, created_at: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehiclesTable.$inferSelect;

export const pcnsTable = pgTable("pcns", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  vehicle_id: uuid("vehicle_id"),
  pcn_reference: text("pcn_reference").notNull(),
  issuer: text("issuer").notNull(),
  issue_date: text("issue_date"),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  status: text("status", { enum: ["pending", "paid", "contested"] }).notNull().default("pending"),
  due_date: text("due_date"),
  location: text("location"),
  file_path: text("file_path"),
  ocr_raw_text: text("ocr_raw_text"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPcnSchema = createInsertSchema(pcnsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertPcn = z.infer<typeof insertPcnSchema>;
export type Pcn = typeof pcnsTable.$inferSelect;