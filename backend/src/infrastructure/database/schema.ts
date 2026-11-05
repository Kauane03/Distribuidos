import {
  mysqlTable,
  int,
  varchar,
  date,
  boolean,
  decimal,
  timestamp,
  text,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const pets = mysqlTable("pets", {
  id: int("id").primaryKey().autoincrement(),
  nome: varchar("nome", { length: 255 }).notNull(),
  raca: varchar("raca", { length: 255 }),
  dataNascimento: date("data_nascimento", { mode: "string" }),
  status: boolean("status").notNull().default(true),
  pathFoto: varchar("path_foto", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const sticks = mysqlTable("sticks", {
  id: int("id").primaryKey().autoincrement(),
  stickRef: varchar("stick_ref", { length: 100 }).notNull().unique(),
  status: boolean("status").notNull().default(true),
  bateria: decimal("bateria", { precision: 5, scale: 2 }),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen"),
  wifiSsid: varchar("wifi_ssid", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const trackers = mysqlTable("trackers", {
  id: int("id").primaryKey().autoincrement(),
  trackerRef: varchar("tracker_ref", { length: 100 }).notNull().unique(),
  status: boolean("status").notNull().default(true),
  bateria: decimal("bateria", { precision: 5, scale: 2 }),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const petTrackers = mysqlTable("pet_trackers", {
  id: int("id").primaryKey().autoincrement(),
  petId: int("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  trackerId: int("tracker_id").notNull().references(() => trackers.id, { onDelete: "cascade" }),
  dataInicio: timestamp("data_inicio").defaultNow().notNull(),
  dataFim: timestamp("data_fim"),
});

export const rastreios = mysqlTable("rastreios", {
  id: int("id").primaryKey().autoincrement(),
  trackerId: int("tracker_id").notNull().references(() => trackers.id, { onDelete: "cascade" }),
  petId: int("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  stickId: int("stick_id").references(() => sticks.id, { onDelete: "set null" }),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  long: decimal("long", { precision: 11, scale: 8 }).notNull(),
  rssi: decimal("rssi", { precision: 6, scale: 2 }),
  bateriaStick: decimal("bateria_stick", { precision: 5, scale: 2 }),
  bateriaTracker: decimal("bateria_tracker", { precision: 5, scale: 2 }),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const deviceEvents = mysqlTable("device_events", {
  id: int("id").primaryKey().autoincrement(),
  deviceType: varchar("device_type", { length: 50 }).notNull(), // 'tracker' | 'stick'
  deviceRef: varchar("device_ref", { length: 100 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // 'telemetry' | 'status' | 'alert' | 'config'
  topic: varchar("topic", { length: 255 }).notNull(),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relationships
export const petsRelations = relations(pets, ({ many }) => ({
  petTrackers: many(petTrackers),
  rastreios: many(rastreios),
}));

export const trackersRelations = relations(trackers, ({ many }) => ({
  petTrackers: many(petTrackers),
  rastreios: many(rastreios),
}));

export const sticksRelations = relations(sticks, ({ many }) => ({
  rastreios: many(rastreios),
}));

export const petTrackersRelations = relations(petTrackers, ({ one }) => ({
  pet: one(pets, {
    fields: [petTrackers.petId],
    references: [pets.id],
  }),
  tracker: one(trackers, {
    fields: [petTrackers.trackerId],
    references: [trackers.id],
  }),
}));

export const rastreiosRelations = relations(rastreios, ({ one }) => ({
  pet: one(pets, {
    fields: [rastreios.petId],
    references: [pets.id],
  }),
  tracker: one(trackers, {
    fields: [rastreios.trackerId],
    references: [trackers.id],
  }),
  stick: one(sticks, {
    fields: [rastreios.stickId],
    references: [sticks.id],
  }),
}));
