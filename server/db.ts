import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'restaurant.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      table_id TEXT PRIMARY KEY,
      table_number INTEGER NOT NULL UNIQUE,
      seating_capacity INTEGER NOT NULL CHECK(seating_capacity > 0),
      location TEXT NOT NULL,
      current_status TEXT NOT NULL CHECK(current_status IN ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id TEXT PRIMARY KEY,
      confirmation_code TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
      table_id TEXT NOT NULL REFERENCES restaurant_tables(table_id) ON DELETE RESTRICT,
      booking_date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      party_size INTEGER NOT NULL CHECK(party_size > 0),
      status TEXT NOT NULL CHECK(status IN ('CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waiting_list (
      entry_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
      party_size INTEGER NOT NULL CHECK(party_size > 0),
      arrival_time TEXT NOT NULL,
      estimated_wait_minutes INTEGER NOT NULL CHECK(estimated_wait_minutes >= 0),
      status TEXT NOT NULL CHECK(status IN ('WAITING', 'READY_TO_SEAT', 'SEATED', 'CANCELLED')),
      matched_table_id TEXT REFERENCES restaurant_tables(table_id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_rules (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      avg_dining_minutes INTEGER NOT NULL CHECK(avg_dining_minutes > 0),
      turnover_buffer_minutes INTEGER NOT NULL CHECK(turnover_buffer_minutes >= 0),
      max_party_size INTEGER NOT NULL CHECK(max_party_size > 0),
      time_slots_json TEXT NOT NULL
    );
  `);

  const rulesRow = db.prepare('SELECT id FROM booking_rules WHERE id = 1').get();
  if (!rulesRow) {
    db.prepare(
      `INSERT INTO booking_rules (id, avg_dining_minutes, turnover_buffer_minutes, max_party_size, time_slots_json)
       VALUES (1, ?, ?, ?, ?)`
    ).run(20, 10, 8, JSON.stringify(['12:00 PM', '01:30 PM', '06:30 PM', '08:00 PM', '09:30 PM']));
  }

  const tableCount = (db.prepare('SELECT COUNT(*) as cnt FROM restaurant_tables').get() as { cnt: number }).cnt;
  if (tableCount === 0) {
    seedInitialData();
  }
}

function seedInitialData(): void {
  const today = getTodayIsoDate();
  const nowIso = new Date().toISOString();

  const insertTable = db.prepare(
    `INSERT INTO restaurant_tables (table_id, table_number, seating_capacity, location, current_status)
     VALUES (?, ?, ?, ?, ?)`
  );

  const initialTables: Array<[string, number, number, string, string]> = [
    ['T-101', 1, 2, 'Window', 'OCCUPIED'],
    ['T-102', 2, 2, 'Window', 'RESERVED'],
    ['T-103', 3, 4, 'Main Hall', 'RESERVED'],
    ['T-104', 4, 4, 'Main Hall', 'OCCUPIED'],
    ['T-105', 5, 6, 'Patio', 'AVAILABLE'],
    ['T-106', 6, 6, 'Patio', 'RESERVED'],
    ['T-107', 7, 8, 'Private Room', 'AVAILABLE'],
    ['T-108', 8, 4, 'Booth', 'RESERVED'],
    ['T-109', 9, 2, 'Patio', 'MAINTENANCE'],
  ];

  const insertCustomer = db.prepare(
    `INSERT INTO customers (customer_id, name, phone_number, created_at)
     VALUES (?, ?, ?, ?)`
  );

  const initialCustomers: Array<[string, string, string]> = [
    ['CUST-1001', 'Ananya Rao', '9848012345'],
    ['CUST-1002', 'Karthik Verma', '9848023456'],
    ['CUST-1003', 'Priya Menon', '9848034567'],
    ['CUST-1004', 'Rohan Deshmukh', '9848045678'],
    ['CUST-1005', 'Meera Nair', '9848056789'],
    ['CUST-1006', 'Sameer Khan', '9848099112'],
    ['CUST-1007', 'Neha Kulkarni', '9848077881'],
  ];

  const insertReservation = db.prepare(
    `INSERT INTO reservations (reservation_id, confirmation_code, customer_id, table_id, booking_date, time_slot, party_size, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const initialReservations: Array<[string, string, string, string, string, string, number, string]> = [
    ['RES-1001', 'CNF-3104', 'CUST-1001', 'T-101', today, '01:30 PM', 2, 'SEATED'],
    ['RES-1002', 'CNF-4822', 'CUST-1002', 'T-103', today, '08:00 PM', 4, 'CONFIRMED'],
    ['RES-1003', 'CNF-5190', 'CUST-1003', 'T-102', today, '08:00 PM', 2, 'CONFIRMED'],
    ['RES-1004', 'CNF-6241', 'CUST-1004', 'T-108', today, '08:00 PM', 4, 'CONFIRMED'],
    ['RES-1005', 'CNF-7315', 'CUST-1005', 'T-106', today, '08:00 PM', 5, 'CONFIRMED'],
    ['RES-1006', 'CNF-8402', 'CUST-1002', 'T-104', today, '01:30 PM', 3, 'SEATED'],
  ];

  const insertWaiting = db.prepare(
    `INSERT INTO waiting_list (entry_id, customer_id, party_size, arrival_time, estimated_wait_minutes, status, matched_table_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const initialWaiting: Array<[string, string, number, string, number, string, string | null]> = [
    ['WL-301', 'CUST-1006', 2, '19:42', 15, 'WAITING', null],
    ['WL-302', 'CUST-1007', 4, '19:48', 25, 'WAITING', null],
  ];

  const seedTx = db.transaction(() => {
    for (const row of initialTables) insertTable.run(...row);
    for (const row of initialCustomers) insertCustomer.run(...row, nowIso);
    for (const row of initialReservations) insertReservation.run(...row, nowIso);
    for (const row of initialWaiting) insertWaiting.run(...row, nowIso);
  });

  seedTx();
}
