import { db, getTodayIsoDate } from './db.ts';
import type {
  BookingRulesConfig,
  Customer,
  Reservation,
  RestaurantTable,
  SlotOccupancy,
  WaitingListEntry,
} from './types.ts';
import { ReservationStatus, TableStatus, WaitingStatus } from './types.ts';

export class DomainError extends Error {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class InvalidInputError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'INVALID_INPUT', details);
  }
}

export class TableNotAvailableError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'TABLE_NOT_AVAILABLE', details);
  }
}

export class ReservationException extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'RESERVATION_CONFLICT', details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

function normalizePhone(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new InvalidInputError('Phone number must contain 10 to 12 digits.');
  }
  const digits = raw.replace(/[\s\-()+]/g, '');
  if (!/^\d{10,12}$/.test(digits)) {
    throw new InvalidInputError('Phone number must contain 10 to 12 digits.');
  }
  return digits;
}

function validateNonEmptyString(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new InvalidInputError(`${label} is required and cannot be empty.`);
  }
  return raw.trim();
}

function validatePositiveInt(raw: unknown, label: string): number {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new InvalidInputError(`${label} must be a positive whole number.`);
  }
  return num;
}

function validateIsoDate(raw: unknown, allowPast = false): string {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    throw new InvalidInputError('Booking date must be a valid YYYY-MM-DD date.');
  }
  const value = raw.trim();
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== d
  ) {
    throw new InvalidInputError('Booking date is not a valid calendar date.');
  }
  if (!allowPast && value < getTodayIsoDate()) {
    throw new InvalidInputError(`Booking date (${value}) cannot be in the past.`);
  }
  return value;
}

function validateArrivalTime(raw: unknown): string {
  if (typeof raw !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.trim())) {
    throw new InvalidInputError('Arrival time must be in 24-hour HH:mm format (e.g. 19:42).');
  }
  return raw.trim();
}

function mapTableRow(row: Record<string, unknown>): RestaurantTable {
  return {
    tableId: String(row.table_id),
    tableNumber: Number(row.table_number),
    seatingCapacity: Number(row.seating_capacity),
    location: String(row.location),
    currentStatus: String(row.current_status) as TableStatus,
  };
}

function mapCustomerRow(row: Record<string, unknown>): Customer {
  return {
    customerId: String(row.customer_id),
    name: String(row.name),
    phoneNumber: String(row.phone_number),
    createdAt: String(row.created_at),
  };
}

function mapReservationRow(row: Record<string, unknown>): Reservation {
  return {
    reservationId: String(row.reservation_id),
    confirmationCode: String(row.confirmation_code),
    customerId: String(row.customer_id),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    tableId: String(row.table_id),
    tableNumber: Number(row.table_number),
    tableCapacity: Number(row.table_capacity),
    tableLocation: String(row.table_location),
    bookingDate: String(row.booking_date),
    timeSlot: String(row.time_slot),
    partySize: Number(row.party_size),
    status: String(row.status) as ReservationStatus,
    createdAt: String(row.created_at),
  };
}

function nextSequenceId(table: string, column: string, prefix: string, startAt: number): string {
  const rows = db.prepare(`SELECT ${column} as id FROM ${table}`).all() as Array<{ id: string }>;
  let maxNum = startAt - 1;
  const regex = new RegExp(`^${prefix}-(\\d+)$`);
  for (const r of rows) {
    const match = regex.exec(r.id);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}-${maxNum + 1}`;
}

function generateConfirmationCode(): string {
  for (let i = 0; i < 20; i++) {
    const code = `CNF-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = db
      .prepare('SELECT 1 FROM reservations WHERE confirmation_code = ?')
      .get(code);
    if (!existing) return code;
  }
  return `CNF-${Date.now().toString().slice(-4)}`;
}

export function getBookingRules(): BookingRulesConfig {
  const row = db
    .prepare('SELECT avg_dining_minutes, turnover_buffer_minutes, max_party_size, time_slots_json FROM booking_rules WHERE id = 1')
    .get() as {
    avg_dining_minutes: number;
    turnover_buffer_minutes: number;
    max_party_size: number;
    time_slots_json: string;
  };
  return {
    avgDiningMinutes: row.avg_dining_minutes,
    turnoverBufferMinutes: row.turnover_buffer_minutes,
    maxPartySize: row.max_party_size,
    timeSlots: JSON.parse(row.time_slots_json) as string[],
  };
}

export function updateBookingRules(input: Partial<BookingRulesConfig>): BookingRulesConfig {
  const current = getBookingRules();
  const avgDiningMinutes =
    input.avgDiningMinutes !== undefined
      ? validatePositiveInt(input.avgDiningMinutes, 'Average dining minutes')
      : current.avgDiningMinutes;

  const turnoverBufferMinutes =
    input.turnoverBufferMinutes !== undefined
      ? Number(input.turnoverBufferMinutes)
      : current.turnoverBufferMinutes;
  if (!Number.isInteger(turnoverBufferMinutes) || turnoverBufferMinutes < 0) {
    throw new InvalidInputError('Turnover buffer minutes must be 0 or a positive whole number.');
  }

  const maxPartySize =
    input.maxPartySize !== undefined
      ? validatePositiveInt(input.maxPartySize, 'Maximum party size')
      : current.maxPartySize;

  let timeSlots = current.timeSlots;
  if (input.timeSlots !== undefined) {
    if (!Array.isArray(input.timeSlots)) {
      throw new InvalidInputError('Service time slots must be an array.');
    }
    timeSlots = Array.from(
      new Set(input.timeSlots.map((s) => validateNonEmptyString(s, 'Time slot')))
    );
    if (timeSlots.length === 0) {
      throw new InvalidInputError('At least one service time slot is required.');
    }
  }

  db.prepare(
    `UPDATE booking_rules
     SET avg_dining_minutes = ?, turnover_buffer_minutes = ?, max_party_size = ?, time_slots_json = ?
     WHERE id = 1`
  ).run(avgDiningMinutes, turnoverBufferMinutes, maxPartySize, JSON.stringify(timeSlots));

  return getBookingRules();
}

export function listTables(statusFilter?: string): RestaurantTable[] {
  let sql = 'SELECT * FROM restaurant_tables';
  const params: unknown[] = [];
  if (statusFilter && statusFilter !== 'ALL') {
    if (!Object.values(TableStatus).includes(statusFilter as TableStatus)) {
      throw new InvalidInputError(`Invalid table status filter: ${statusFilter}`);
    }
    sql += ' WHERE current_status = ?';
    params.push(statusFilter);
  }
  sql += ' ORDER BY table_number ASC';
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapTableRow);
}

export function getTableById(tableId: string): RestaurantTable {
  const row = db
    .prepare('SELECT * FROM restaurant_tables WHERE table_id = ?')
    .get(tableId) as Record<string, unknown> | undefined;
  if (!row) {
    throw new NotFoundError(`Table ID not found: ${tableId}`);
  }
  return mapTableRow(row);
}

export function createTable(input: {
  tableId?: string;
  tableNumber: number;
  seatingCapacity: number;
  location: string;
  currentStatus?: TableStatus;
}): RestaurantTable {
  const tableNumber = validatePositiveInt(input.tableNumber, 'Table number');
  const seatingCapacity = validatePositiveInt(input.seatingCapacity, 'Seating capacity');
  const location = validateNonEmptyString(input.location, 'Table location');
  const status = (input.currentStatus || TableStatus.AVAILABLE) as TableStatus;
  if (!Object.values(TableStatus).includes(status)) {
    throw new InvalidInputError(`Invalid table status: ${status}`);
  }

  const tableId =
    input.tableId && input.tableId.trim().length > 0
      ? input.tableId.trim().toUpperCase()
      : nextSequenceId('restaurant_tables', 'table_id', 'T', 101);

  const dupId = db.prepare('SELECT 1 FROM restaurant_tables WHERE table_id = ?').get(tableId);
  if (dupId) {
    throw new ReservationException(`Table ID ${tableId} already exists.`);
  }
  const dupNum = db.prepare('SELECT 1 FROM restaurant_tables WHERE table_number = ?').get(tableNumber);
  if (dupNum) {
    throw new ReservationException(`Table #${tableNumber} already exists.`);
  }

  db.prepare(
    `INSERT INTO restaurant_tables (table_id, table_number, seating_capacity, location, current_status)
     VALUES (?, ?, ?, ?, ?)`
  ).run(tableId, tableNumber, seatingCapacity, location, status);

  return getTableById(tableId);
}

export function updateTable(
  tableId: string,
  input: {
    tableNumber?: number;
    seatingCapacity?: number;
    location?: string;
    currentStatus?: TableStatus;
  }
): RestaurantTable {
  const existing = getTableById(tableId);
  const tableNumber =
    input.tableNumber !== undefined
      ? validatePositiveInt(input.tableNumber, 'Table number')
      : existing.tableNumber;
  const seatingCapacity =
    input.seatingCapacity !== undefined
      ? validatePositiveInt(input.seatingCapacity, 'Seating capacity')
      : existing.seatingCapacity;
  const location =
    input.location !== undefined
      ? validateNonEmptyString(input.location, 'Table location')
      : existing.location;
  const currentStatus = (input.currentStatus ?? existing.currentStatus) as TableStatus;

  if (!Object.values(TableStatus).includes(currentStatus)) {
    throw new InvalidInputError(`Invalid table status: ${currentStatus}`);
  }

  const dupNum = db
    .prepare('SELECT 1 FROM restaurant_tables WHERE table_number = ? AND table_id != ?')
    .get(tableNumber, tableId);
  if (dupNum) {
    throw new ReservationException(`Table #${tableNumber} is already assigned to another table.`);
  }

  if (seatingCapacity < existing.seatingCapacity) {
    const oversizedRes = db
      .prepare(
        `SELECT reservation_id, party_size FROM reservations
         WHERE table_id = ? AND status IN ('CONFIRMED', 'SEATED') AND party_size > ?`
      )
      .get(tableId, seatingCapacity) as { reservation_id: string; party_size: number } | undefined;
    if (oversizedRes) {
      throw new ReservationException(
        `Cannot reduce capacity of ${tableId} to ${seatingCapacity} while active reservation ${oversizedRes.reservation_id} has a party of ${oversizedRes.party_size}.`
      );
    }

    const oversizedHold = db
      .prepare(
        `SELECT entry_id, party_size FROM waiting_list
         WHERE matched_table_id = ? AND status = 'READY_TO_SEAT' AND party_size > ?`
      )
      .get(tableId, seatingCapacity) as { entry_id: string; party_size: number } | undefined;
    if (oversizedHold) {
      throw new ReservationException(
        `Cannot reduce capacity of ${tableId} to ${seatingCapacity} while held waiting-list entry ${oversizedHold.entry_id} has a party of ${oversizedHold.party_size}.`
      );
    }
  }

  if (currentStatus === TableStatus.MAINTENANCE) {
    const activeRes = db
      .prepare(
        `SELECT 1 FROM reservations WHERE table_id = ? AND status IN ('CONFIRMED', 'SEATED')`
      )
      .get(tableId);
    const activeHold = db
      .prepare(
        `SELECT 1 FROM waiting_list WHERE matched_table_id = ? AND status = 'READY_TO_SEAT'`
      )
      .get(tableId);
    if (activeRes || activeHold) {
      throw new ReservationException(
        `Cannot place ${tableId} into MAINTENANCE while it has active reservations or a ready-to-seat guest.`
      );
    }
  }

  db.prepare(
    `UPDATE restaurant_tables
     SET table_number = ?, seating_capacity = ?, location = ?, current_status = ?
     WHERE table_id = ?`
  ).run(tableNumber, seatingCapacity, location, currentStatus, tableId);

  return getTableById(tableId);
}

export function deleteTable(tableId: string): void {
  getTableById(tableId);
  const activeRes = db
    .prepare(
      `SELECT 1 FROM reservations WHERE table_id = ? AND status IN ('CONFIRMED', 'SEATED')`
    )
    .get(tableId);
  if (activeRes) {
    throw new ReservationException(
      `Cannot delete ${tableId} because it has active reservations.`
    );
  }
  const activeWait = db
    .prepare(
      `SELECT 1 FROM waiting_list WHERE matched_table_id = ? AND status = 'READY_TO_SEAT'`
    )
    .get(tableId);
  if (activeWait) {
    throw new ReservationException(
      `Cannot delete ${tableId} while a waiting-list guest is matched to it.`
    );
  }
  const anyRes = db.prepare('SELECT 1 FROM reservations WHERE table_id = ?').get(tableId);
  if (anyRes) {
    throw new ReservationException(
      `Table ${tableId} has historical reservation records and cannot be deleted. Set status to MAINTENANCE instead.`
    );
  }
  db.prepare('DELETE FROM restaurant_tables WHERE table_id = ?').run(tableId);
}

function syncTableStatus(tableId: string): void {
  const table = getTableById(tableId);
  if (table.currentStatus === TableStatus.MAINTENANCE) {
    return;
  }
  const today = getTodayIsoDate();
  const hasSeated = db
    .prepare(
      `SELECT 1 FROM reservations WHERE table_id = ? AND booking_date = ? AND status = 'SEATED'`
    )
    .get(tableId, today);
  if (hasSeated) {
    db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
      TableStatus.OCCUPIED,
      tableId
    );
    return;
  }

  const hasReadyWait = db
    .prepare(
      `SELECT 1 FROM waiting_list WHERE matched_table_id = ? AND status = 'READY_TO_SEAT'`
    )
    .get(tableId);
  const hasConfirmed = db
    .prepare(
      `SELECT 1 FROM reservations WHERE table_id = ? AND booking_date = ? AND status = 'CONFIRMED'`
    )
    .get(tableId, today);

  if (hasReadyWait || hasConfirmed) {
    db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
      TableStatus.RESERVED,
      tableId
    );
    return;
  }

  db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
    TableStatus.AVAILABLE,
    tableId
  );
}

export function listCustomers(search?: string): Array<Customer & { reservationCount: number; waitingCount: number }> {
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM reservations r WHERE r.customer_id = c.customer_id) as reservation_count,
      (SELECT COUNT(*) FROM waiting_list w WHERE w.customer_id = c.customer_id) as waiting_count
    FROM customers c
  `;
  const params: unknown[] = [];
  if (search && search.trim().length > 0) {
    const q = `%${search.trim()}%`;
    sql += ' WHERE c.name LIKE ? OR c.phone_number LIKE ? OR c.customer_id LIKE ?';
    params.push(q, q, q);
  }
  sql += ' ORDER BY c.customer_id DESC';
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    ...mapCustomerRow(row),
    reservationCount: Number(row.reservation_count),
    waitingCount: Number(row.waiting_count),
  }));
}

export function createOrUpdateCustomerByPhone(nameRaw: string, phoneRaw: string): Customer {
  const name = validateNonEmptyString(nameRaw, 'Customer name');
  const phoneNumber = normalizePhone(phoneRaw);

  const existing = db
    .prepare('SELECT * FROM customers WHERE phone_number = ?')
    .get(phoneNumber) as Record<string, unknown> | undefined;

  if (existing) {
    return mapCustomerRow(existing);
  }

  const customerId = nextSequenceId('customers', 'customer_id', 'CUST', 1001);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO customers (customer_id, name, phone_number, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(customerId, name, phoneNumber, createdAt);

  return { customerId, name, phoneNumber, createdAt };
}

export function createCustomer(input: { name: string; phoneNumber: string }): Customer {
  const name = validateNonEmptyString(input.name, 'Customer name');
  const phoneNumber = normalizePhone(input.phoneNumber);

  const existing = db.prepare('SELECT 1 FROM customers WHERE phone_number = ?').get(phoneNumber);
  if (existing) {
    throw new ReservationException(`A customer with phone number ${phoneNumber} already exists.`);
  }

  const customerId = nextSequenceId('customers', 'customer_id', 'CUST', 1001);
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO customers (customer_id, name, phone_number, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(customerId, name, phoneNumber, createdAt);

  return { customerId, name, phoneNumber, createdAt };
}

export function updateCustomer(
  customerId: string,
  input: { name?: string; phoneNumber?: string }
): Customer {
  const row = db
    .prepare('SELECT * FROM customers WHERE customer_id = ?')
    .get(customerId) as Record<string, unknown> | undefined;
  if (!row) {
    throw new NotFoundError(`Customer ID not found: ${customerId}`);
  }
  const existing = mapCustomerRow(row);
  const name = input.name !== undefined ? validateNonEmptyString(input.name, 'Customer name') : existing.name;
  const phoneNumber =
    input.phoneNumber !== undefined ? normalizePhone(input.phoneNumber) : existing.phoneNumber;

  const dup = db
    .prepare('SELECT 1 FROM customers WHERE phone_number = ? AND customer_id != ?')
    .get(phoneNumber, customerId);
  if (dup) {
    throw new ReservationException(`Phone number ${phoneNumber} is already registered to another customer.`);
  }

  db.prepare('UPDATE customers SET name = ?, phone_number = ? WHERE customer_id = ?').run(
    name,
    phoneNumber,
    customerId
  );

  return { ...existing, name, phoneNumber };
}

export function deleteCustomer(customerId: string): void {
  const row = db
    .prepare('SELECT customer_id FROM customers WHERE customer_id = ?')
    .get(customerId);
  if (!row) {
    throw new NotFoundError(`Customer ID not found: ${customerId}`);
  }
  const hasRes = db.prepare('SELECT 1 FROM reservations WHERE customer_id = ?').get(customerId);
  const hasWait = db.prepare('SELECT 1 FROM waiting_list WHERE customer_id = ?').get(customerId);
  if (hasRes || hasWait) {
    throw new ReservationException(
      `Cannot delete customer ${customerId} because they have recorded reservation or waiting-list history.`
    );
  }
  db.prepare('DELETE FROM customers WHERE customer_id = ?').run(customerId);
}

export function getCustomerHistory(customerId: string): {
  customer: Customer;
  reservations: Reservation[];
  waitingListEntries: WaitingListEntry[];
} {
  const row = db
    .prepare('SELECT * FROM customers WHERE customer_id = ?')
    .get(customerId) as Record<string, unknown> | undefined;
  if (!row) {
    throw new NotFoundError(`Customer ID not found: ${customerId}`);
  }
  const customer = mapCustomerRow(row);
  const reservations = listReservations({ customerId });
  const waitingListEntries = listWaitingList({ customerId, includeAll: true });
  return { customer, reservations, waitingListEntries };
}

export function checkAvailability(
  bookingDateRaw: string,
  timeSlotRaw: string,
  partySizeRaw: number,
  excludeReservationId?: string
): { availableTables: RestaurantTable[]; bestFitTable: RestaurantTable | null; maxTableCapacity: number } {
  const rules = getBookingRules();
  const bookingDate = validateIsoDate(bookingDateRaw);
  const timeSlot = validateNonEmptyString(timeSlotRaw, 'Time slot');
  if (!rules.timeSlots.includes(timeSlot)) {
    throw new InvalidInputError(
      `Invalid service time slot "${timeSlot}". Valid slots: ${rules.timeSlots.join(', ')}.`
    );
  }
  const partySize = validatePositiveInt(partySizeRaw, 'Party size');
  if (partySize > rules.maxPartySize) {
    throw new TableNotAvailableError(
      `Party size (${partySize}) exceeds the configured maximum party size of ${rules.maxPartySize}.`,
      { partySize, maxPartySize: rules.maxPartySize, canWaitlist: false }
    );
  }

  const allTables = listTables();
  const operationalTables = allTables.filter((t) => t.currentStatus !== TableStatus.MAINTENANCE);
  const maxTableCapacity = operationalTables.reduce((max, t) => Math.max(max, t.seatingCapacity), 0);

  if (partySize > maxTableCapacity) {
    throw new TableNotAvailableError(
      `No suitable table exists for party of ${partySize} (maximum operational table capacity is ${maxTableCapacity}).`,
      { partySize, maxTableCapacity, canWaitlist: false }
    );
  }

  const bookedRows = db
    .prepare(
      `SELECT table_id FROM reservations
       WHERE booking_date = ? AND time_slot = ? AND status IN ('CONFIRMED', 'SEATED')
       ${excludeReservationId ? 'AND reservation_id != ?' : ''}`
    )
    .all(...(excludeReservationId ? [bookingDate, timeSlot, excludeReservationId] : [bookingDate, timeSlot])) as Array<{
    table_id: string;
  }>;
  const bookedTableIds = new Set(bookedRows.map((r) => r.table_id));

  const heldRows = db
    .prepare(
      `SELECT matched_table_id FROM waiting_list
       WHERE status = 'READY_TO_SEAT' AND matched_table_id IS NOT NULL`
    )
    .all() as Array<{ matched_table_id: string }>;
  const heldTableIds = new Set(heldRows.map((r) => r.matched_table_id));
  const today = getTodayIsoDate();

  const availableTables = operationalTables
    .filter((t) => {
      if (t.seatingCapacity < partySize) return false;
      if (bookedTableIds.has(t.tableId)) return false;
      if (bookingDate === today && heldTableIds.has(t.tableId)) return false;
      return true;
    })
    .sort((a, b) => a.seatingCapacity - b.seatingCapacity || a.tableNumber - b.tableNumber);

  return {
    availableTables,
    bestFitTable: availableTables[0] ?? null,
    maxTableCapacity,
  };
}

export function listReservations(filters?: {
  date?: string;
  timeSlot?: string;
  status?: string;
  search?: string;
  customerId?: string;
}): Reservation[] {
  let sql = `
    SELECT r.*,
      c.name as customer_name, c.phone_number as customer_phone,
      t.table_number, t.seating_capacity as table_capacity, t.location as table_location
    FROM reservations r
    JOIN customers c ON r.customer_id = c.customer_id
    JOIN restaurant_tables t ON r.table_id = t.table_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters?.date) {
    sql += ' AND r.booking_date = ?';
    params.push(filters.date);
  }
  if (filters?.timeSlot && filters.timeSlot !== 'ALL') {
    sql += ' AND r.time_slot = ?';
    params.push(filters.timeSlot);
  }
  if (filters?.status && filters.status !== 'ALL') {
    sql += ' AND r.status = ?';
    params.push(filters.status);
  }
  if (filters?.customerId) {
    sql += ' AND r.customer_id = ?';
    params.push(filters.customerId);
  }
  if (filters?.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim()}%`;
    sql +=
      ' AND (r.reservation_id LIKE ? OR r.confirmation_code LIKE ? OR c.name LIKE ? OR c.phone_number LIKE ?)';
    params.push(q, q, q, q);
  }

  sql += ' ORDER BY r.booking_date DESC, r.created_at DESC';
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map(mapReservationRow);
}

export function getReservationById(reservationId: string): Reservation {
  const row = db
    .prepare(
      `SELECT r.*,
        c.name as customer_name, c.phone_number as customer_phone,
        t.table_number, t.seating_capacity as table_capacity, t.location as table_location
       FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       JOIN restaurant_tables t ON r.table_id = t.table_id
       WHERE r.reservation_id = ?`
    )
    .get(reservationId) as Record<string, unknown> | undefined;

  if (!row) {
    throw new NotFoundError(`Reservation ID not found: ${reservationId}`);
  }
  return mapReservationRow(row);
}

export function createReservation(input: {
  customerId?: string;
  customerName?: string;
  phoneNumber?: string;
  bookingDate: string;
  timeSlot: string;
  partySize: number;
  preferredTableId?: string;
}): Reservation {
  const rules = getBookingRules();
  const bookingDate = validateIsoDate(input.bookingDate);
  const timeSlot = validateNonEmptyString(input.timeSlot, 'Time slot');
  if (!rules.timeSlots.includes(timeSlot)) {
    throw new InvalidInputError(
      `Invalid service time slot "${timeSlot}". Valid slots: ${rules.timeSlots.join(', ')}.`
    );
  }
  const partySize = validatePositiveInt(input.partySize, 'Party size');

  let customer: Customer;
  if (input.customerId && input.customerId.trim().length > 0) {
    const row = db
      .prepare('SELECT * FROM customers WHERE customer_id = ?')
      .get(input.customerId.trim()) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundError(`Customer ID not found: ${input.customerId}`);
    }
    customer = mapCustomerRow(row);
  } else {
    customer = createOrUpdateCustomerByPhone(input.customerName ?? '', input.phoneNumber ?? '');
  }

  // Double-booking guard: prevent same phone number booking the same date + slot twice
  const duplicateBooking = db
    .prepare(
      `SELECT r.reservation_id FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       WHERE c.phone_number = ? AND r.booking_date = ? AND r.time_slot = ? AND r.status IN ('CONFIRMED', 'SEATED')`
    )
    .get(customer.phoneNumber, bookingDate, timeSlot);

  if (duplicateBooking) {
    throw new ReservationException(
      `Duplicate reservation prevented for ${customer.phoneNumber} at ${timeSlot} on ${bookingDate}.`
    );
  }

  const { availableTables, bestFitTable } = checkAvailability(bookingDate, timeSlot, partySize);

  if (!bestFitTable || availableTables.length === 0) {
    throw new TableNotAvailableError(
      `No suitable tables available for party of ${partySize} on ${bookingDate} at ${timeSlot}. You can add the guest to the Waiting List.`,
      {
        canWaitlist: true,
        customerName: customer.name,
        phoneNumber: customer.phoneNumber,
        partySize,
      }
    );
  }

  let chosenTable = bestFitTable;
  if (input.preferredTableId) {
    const match = availableTables.find((t) => t.tableId === input.preferredTableId);
    if (!match) {
      throw new TableNotAvailableError(
        `Requested table ${input.preferredTableId} is not available or cannot fit party of ${partySize} at ${timeSlot}.`
      );
    }
    chosenTable = match;
  }

  const reservationId = nextSequenceId('reservations', 'reservation_id', 'RES', 1001);
  const confirmationCode = generateConfirmationCode();
  const createdAt = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO reservations (reservation_id, confirmation_code, customer_id, table_id, booking_date, time_slot, party_size, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      reservationId,
      confirmationCode,
      customer.customerId,
      chosenTable.tableId,
      bookingDate,
      timeSlot,
      partySize,
      ReservationStatus.CONFIRMED,
      createdAt
    );

    syncTableStatus(chosenTable.tableId);
  });

  tx();
  return getReservationById(reservationId);
}

export function updateReservation(
  reservationId: string,
  input: {
    bookingDate?: string;
    timeSlot?: string;
    partySize?: number;
    preferredTableId?: string;
    status?: ReservationStatus;
  }
): Reservation {
  const existing = getReservationById(reservationId);
  if (existing.status === ReservationStatus.CANCELLED || existing.status === ReservationStatus.COMPLETED) {
    throw new ReservationException(
      `Cannot edit a ${existing.status.toLowerCase()} reservation (${reservationId}).`
    );
  }

  const rules = getBookingRules();
  const bookingDate =
    input.bookingDate !== undefined ? validateIsoDate(input.bookingDate) : existing.bookingDate;
  const timeSlot =
    input.timeSlot !== undefined ? validateNonEmptyString(input.timeSlot, 'Time slot') : existing.timeSlot;
  if (!rules.timeSlots.includes(timeSlot)) {
    throw new InvalidInputError(`Invalid service time slot "${timeSlot}".`);
  }
  const partySize =
    input.partySize !== undefined ? validatePositiveInt(input.partySize, 'Party size') : existing.partySize;
  const status = (input.status ?? existing.status) as ReservationStatus;
  if (!Object.values(ReservationStatus).includes(status)) {
    throw new InvalidInputError(`Invalid reservation status: ${status}`);
  }

  const duplicateBooking = db
    .prepare(
      `SELECT r.reservation_id FROM reservations r
       JOIN customers c ON r.customer_id = c.customer_id
       WHERE c.phone_number = ? AND r.booking_date = ? AND r.time_slot = ?
       AND r.status IN ('CONFIRMED', 'SEATED') AND r.reservation_id != ?`
    )
    .get(existing.customerPhone, bookingDate, timeSlot, reservationId);

  if (duplicateBooking) {
    throw new ReservationException(
      `Duplicate reservation prevented for ${existing.customerPhone} at ${timeSlot} on ${bookingDate}.`
    );
  }

  const { availableTables, bestFitTable } = checkAvailability(
    bookingDate,
    timeSlot,
    partySize,
    reservationId
  );

  if (!bestFitTable) {
    throw new TableNotAvailableError(
      `No suitable table available for party of ${partySize} on ${bookingDate} at ${timeSlot}.`
    );
  }

  let targetTable = bestFitTable;
  const preferredId = input.preferredTableId ?? existing.tableId;
  const keepCurrentOrPreferred = availableTables.find((t) => t.tableId === preferredId);
  if (input.preferredTableId && !keepCurrentOrPreferred) {
    throw new TableNotAvailableError(
      `Selected table ${input.preferredTableId} is unavailable for the requested slot and party size.`
    );
  }
  if (keepCurrentOrPreferred && (!input.partySize || keepCurrentOrPreferred.seatingCapacity >= partySize)) {
    targetTable = keepCurrentOrPreferred;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE reservations
       SET table_id = ?, booking_date = ?, time_slot = ?, party_size = ?, status = ?
       WHERE reservation_id = ?`
    ).run(targetTable.tableId, bookingDate, timeSlot, partySize, status, reservationId);

    syncTableStatus(existing.tableId);
    if (targetTable.tableId !== existing.tableId) {
      syncTableStatus(targetTable.tableId);
    }
  });

  tx();
  return getReservationById(reservationId);
}

export function updateReservationStatus(
  reservationId: string,
  status: ReservationStatus
): { reservation: Reservation; matchedWaitingEntry: WaitingListEntry | null } {
  const existing = getReservationById(reservationId);
  if (!Object.values(ReservationStatus).includes(status)) {
    throw new InvalidInputError(`Invalid reservation status: ${status}`);
  }
  if (
    existing.status === ReservationStatus.COMPLETED ||
    existing.status === ReservationStatus.CANCELLED
  ) {
    throw new ReservationException(
      `Cannot update status of a ${existing.status.toLowerCase()} reservation (${reservationId}).`
    );
  }

  if (status === ReservationStatus.SEATED && existing.status !== ReservationStatus.SEATED) {
    const table = getTableById(existing.tableId);
    if (table.currentStatus === TableStatus.MAINTENANCE) {
      throw new TableNotAvailableError(
        `Table #${table.tableNumber} (${table.tableId}) is currently in MAINTENANCE.`
      );
    }
    const otherSeated = db
      .prepare(
        `SELECT reservation_id FROM reservations
         WHERE table_id = ? AND status = 'SEATED' AND reservation_id != ?`
      )
      .get(existing.tableId, reservationId) as { reservation_id: string } | undefined;
    if (otherSeated) {
      throw new TableNotAvailableError(
        `Table #${table.tableNumber} is currently occupied by reservation ${otherSeated.reservation_id}. Complete or release that table first.`
      );
    }
    const activeHold = db
      .prepare(
        `SELECT entry_id FROM waiting_list WHERE matched_table_id = ? AND status = 'READY_TO_SEAT'`
      )
      .get(existing.tableId) as { entry_id: string } | undefined;
    if (activeHold) {
      throw new TableNotAvailableError(
        `Table #${table.tableNumber} is currently held for waiting-list entry ${activeHold.entry_id}.`
      );
    }
  }

  let matchedWaitingEntry: WaitingListEntry | null = null;

  const tx = db.transaction(() => {
    db.prepare('UPDATE reservations SET status = ? WHERE reservation_id = ?').run(
      status,
      reservationId
    );
    syncTableStatus(existing.tableId);

    if (
      (status === ReservationStatus.COMPLETED || status === ReservationStatus.CANCELLED) &&
      existing.bookingDate === getTodayIsoDate()
    ) {
      const table = getTableById(existing.tableId);
      if (table.currentStatus === TableStatus.AVAILABLE) {
        matchedWaitingEntry = matchNextWaitingCustomerInternal(existing.tableId);
      }
    }
  });

  tx();
  return {
    reservation: getReservationById(reservationId),
    matchedWaitingEntry,
  };
}

export function calculateEstimatedWaitMinutes(partySize: number): {
  estimatedWaitMinutes: number;
  aheadCount: number;
  capableTablesCount: number;
} {
  const rules = getBookingRules();
  const operationalTables = listTables().filter((t) => t.currentStatus !== TableStatus.MAINTENANCE);
  const maxTableCapacity = operationalTables.reduce((max, t) => Math.max(max, t.seatingCapacity), 0);

  if (partySize > rules.maxPartySize || partySize > maxTableCapacity) {
    throw new TableNotAvailableError(
      `No table in the restaurant can accommodate a party of ${partySize} (max capacity: ${Math.min(
        rules.maxPartySize,
        maxTableCapacity
      )}).`
    );
  }

  const capableTablesCount = operationalTables.filter((t) => t.seatingCapacity >= partySize).length;
  const aheadRow = db
    .prepare(`SELECT COUNT(*) as cnt FROM waiting_list WHERE status = 'WAITING'`)
    .get() as { cnt: number };
  const aheadCount = aheadRow.cnt;

  const cycleUnit = (rules.avgDiningMinutes + rules.turnoverBufferMinutes) / 2;
  const estimatedWaitMinutes = Math.max(
    5,
    Math.ceil((aheadCount + 1) / Math.max(1, capableTablesCount)) * Math.round(cycleUnit)
  );

  return { estimatedWaitMinutes, aheadCount, capableTablesCount };
}

export function listWaitingList(options?: {
  status?: string;
  customerId?: string;
  includeAll?: boolean;
}): WaitingListEntry[] {
  let sql = `
    SELECT w.*,
      c.name as customer_name, c.phone_number as customer_phone,
      t.table_number as matched_table_number,
      t.seating_capacity as matched_table_capacity,
      t.location as matched_table_location
    FROM waiting_list w
    JOIN customers c ON w.customer_id = c.customer_id
    LEFT JOIN restaurant_tables t ON w.matched_table_id = t.table_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (options?.customerId) {
    sql += ' AND w.customer_id = ?';
    params.push(options.customerId);
  }
  if (options?.status && options.status !== 'ALL') {
    sql += ' AND w.status = ?';
    params.push(options.status);
  } else if (!options?.includeAll && !options?.status) {
    sql += ` AND w.status IN ('WAITING', 'READY_TO_SEAT')`;
  }

  sql += `
    ORDER BY
      CASE w.status
        WHEN 'READY_TO_SEAT' THEN 0
        WHEN 'WAITING' THEN 1
        WHEN 'SEATED' THEN 2
        ELSE 3
      END,
      w.arrival_time ASC,
      w.created_at ASC
  `;

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  let queueIndex = 0;
  return rows.map((row) => {
    const status = String(row.status) as WaitingStatus;
    const queuePosition = status === WaitingStatus.WAITING ? ++queueIndex : null;
    return {
      entryId: String(row.entry_id),
      customerId: String(row.customer_id),
      customerName: String(row.customer_name),
      customerPhone: String(row.customer_phone),
      partySize: Number(row.party_size),
      arrivalTime: String(row.arrival_time),
      estimatedWaitMinutes: Number(row.estimated_wait_minutes),
      status,
      matchedTableId: row.matched_table_id ? String(row.matched_table_id) : null,
      matchedTableNumber: row.matched_table_number !== null ? Number(row.matched_table_number) : null,
      matchedTableCapacity: row.matched_table_capacity !== null ? Number(row.matched_table_capacity) : null,
      matchedTableLocation: row.matched_table_location ? String(row.matched_table_location) : null,
      queuePosition,
      createdAt: String(row.created_at),
    };
  });
}

export function getWaitingListEntryById(entryId: string): WaitingListEntry {
  const entries = listWaitingList({ includeAll: true });
  const found = entries.find((e) => e.entryId === entryId);
  if (!found) {
    throw new NotFoundError(`Waiting list entry not found: ${entryId}`);
  }
  return found;
}

export function addWaitingListEntry(input: {
  customerId?: string;
  customerName?: string;
  phoneNumber?: string;
  partySize: number;
  arrivalTime: string;
}): WaitingListEntry {
  const partySize = validatePositiveInt(input.partySize, 'Party size');
  const arrivalTime = validateArrivalTime(input.arrivalTime);

  let customer: Customer;
  if (input.customerId && input.customerId.trim().length > 0) {
    const row = db
      .prepare('SELECT * FROM customers WHERE customer_id = ?')
      .get(input.customerId.trim()) as Record<string, unknown> | undefined;
    if (!row) {
      throw new NotFoundError(`Customer ID not found: ${input.customerId}`);
    }
    customer = mapCustomerRow(row);
  } else {
    customer = createOrUpdateCustomerByPhone(input.customerName ?? '', input.phoneNumber ?? '');
  }

  const alreadyWaiting = db
    .prepare(
      `SELECT 1 FROM waiting_list WHERE customer_id = ? AND status IN ('WAITING', 'READY_TO_SEAT')`
    )
    .get(customer.customerId);
  if (alreadyWaiting) {
    throw new ReservationException(
      `${customer.name} (${customer.phoneNumber}) is already on the active waiting list.`
    );
  }

  const { estimatedWaitMinutes } = calculateEstimatedWaitMinutes(partySize);
  const entryId = nextSequenceId('waiting_list', 'entry_id', 'WL', 301);
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO waiting_list (entry_id, customer_id, party_size, arrival_time, estimated_wait_minutes, status, matched_table_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entryId,
    customer.customerId,
    partySize,
    arrivalTime,
    estimatedWaitMinutes,
    WaitingStatus.WAITING,
    null,
    createdAt
  );

  return getWaitingListEntryById(entryId);
}

function matchNextWaitingCustomerInternal(tableId: string): WaitingListEntry | null {
  const table = getTableById(tableId);
  if (table.currentStatus === TableStatus.MAINTENANCE) {
    return null;
  }

  const alreadyHeld = db
    .prepare(`SELECT 1 FROM waiting_list WHERE matched_table_id = ? AND status = 'READY_TO_SEAT'`)
    .get(tableId);
  if (alreadyHeld) {
    return null;
  }

  const nextCandidate = db
    .prepare(
      `SELECT entry_id FROM waiting_list
       WHERE status = 'WAITING' AND party_size <= ?
       ORDER BY arrival_time ASC, created_at ASC
       LIMIT 1`
    )
    .get(table.seatingCapacity) as { entry_id: string } | undefined;

  if (!nextCandidate) {
    return null;
  }

  db.prepare(
    `UPDATE waiting_list SET status = 'READY_TO_SEAT', matched_table_id = ? WHERE entry_id = ?`
  ).run(tableId, nextCandidate.entry_id);

  db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
    TableStatus.RESERVED,
    tableId
  );

  return getWaitingListEntryById(nextCandidate.entry_id);
}

export function releaseTableAndMatchNext(tableId: string): {
  table: RestaurantTable;
  matchedEntry: WaitingListEntry | null;
} {
  const table = getTableById(tableId);
  if (table.currentStatus === TableStatus.MAINTENANCE) {
    throw new ReservationException(
      `Table ${tableId} is currently in MAINTENANCE. Switch it to AVAILABLE before releasing.`
    );
  }

  const existingHold = db
    .prepare(
      `SELECT w.entry_id, c.name FROM waiting_list w
       JOIN customers c ON w.customer_id = c.customer_id
       WHERE w.matched_table_id = ? AND w.status = 'READY_TO_SEAT'`
    )
    .get(tableId) as { entry_id: string; name: string } | undefined;

  if (existingHold) {
    throw new ReservationException(
      `Table ${tableId} is already held for ${existingHold.name} (${existingHold.entry_id}). Seat or cancel that entry first.`
    );
  }

  let matchedEntry: WaitingListEntry | null = null;

  const tx = db.transaction(() => {
    const today = getTodayIsoDate();
    db.prepare(
      `UPDATE reservations SET status = 'COMPLETED'
       WHERE table_id = ? AND booking_date = ? AND status = 'SEATED'`
    ).run(tableId, today);

    db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
      TableStatus.AVAILABLE,
      tableId
    );

    matchedEntry = matchNextWaitingCustomerInternal(tableId);
  });

  tx();
  return {
    table: getTableById(tableId),
    matchedEntry,
  };
}

export function updateWaitingListStatus(
  entryId: string,
  status: WaitingStatus
): { entry: WaitingListEntry; nextMatchedEntry: WaitingListEntry | null } {
  const existing = getWaitingListEntryById(entryId);
  if (!Object.values(WaitingStatus).includes(status)) {
    throw new InvalidInputError(`Invalid waiting list status: ${status}`);
  }
  if (
    existing.status === WaitingStatus.SEATED ||
    existing.status === WaitingStatus.CANCELLED
  ) {
    throw new ReservationException(
      `Cannot update status of a ${existing.status.toLowerCase()} waiting-list entry (${entryId}).`
    );
  }

  let nextMatchedEntry: WaitingListEntry | null = null;

  const tx = db.transaction(() => {
    if (status === WaitingStatus.SEATED) {
      if (!existing.matchedTableId) {
        // Attempt to find a best-fit AVAILABLE table right now
        const openTable = db
          .prepare(
            `SELECT table_id FROM restaurant_tables
             WHERE current_status = 'AVAILABLE' AND seating_capacity >= ?
             ORDER BY seating_capacity ASC, table_number ASC LIMIT 1`
          )
          .get(existing.partySize) as { table_id: string } | undefined;

        if (!openTable) {
          throw new TableNotAvailableError(
            `No available table can seat ${existing.customerName} (party of ${existing.partySize}) right now.`
          );
        }

        db.prepare(
          `UPDATE waiting_list SET status = 'SEATED', matched_table_id = ? WHERE entry_id = ?`
        ).run(openTable.table_id, entryId);
        db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
          TableStatus.OCCUPIED,
          openTable.table_id
        );
      } else {
        db.prepare(`UPDATE waiting_list SET status = 'SEATED' WHERE entry_id = ?`).run(entryId);
        db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
          TableStatus.OCCUPIED,
          existing.matchedTableId
        );
      }
    } else if (status === WaitingStatus.READY_TO_SEAT) {
      if (existing.matchedTableId) {
        db.prepare(`UPDATE waiting_list SET status = 'READY_TO_SEAT' WHERE entry_id = ?`).run(entryId);
        db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
          TableStatus.RESERVED,
          existing.matchedTableId
        );
      } else {
        const openTable = db
          .prepare(
            `SELECT table_id FROM restaurant_tables
             WHERE current_status = 'AVAILABLE' AND seating_capacity >= ?
             ORDER BY seating_capacity ASC, table_number ASC LIMIT 1`
          )
          .get(existing.partySize) as { table_id: string } | undefined;

        if (!openTable) {
          throw new TableNotAvailableError(
            `No available table can seat ${existing.customerName} (party of ${existing.partySize}) right now.`
          );
        }

        db.prepare(
          `UPDATE waiting_list SET status = 'READY_TO_SEAT', matched_table_id = ? WHERE entry_id = ?`
        ).run(openTable.table_id, entryId);
        db.prepare('UPDATE restaurant_tables SET current_status = ? WHERE table_id = ?').run(
          TableStatus.RESERVED,
          openTable.table_id
        );
      }
    } else if (status === WaitingStatus.CANCELLED) {
      const freedTableId = existing.matchedTableId;
      db.prepare(
        `UPDATE waiting_list SET status = 'CANCELLED', matched_table_id = NULL WHERE entry_id = ?`
      ).run(entryId);

      if (freedTableId && existing.status === WaitingStatus.READY_TO_SEAT) {
        syncTableStatus(freedTableId);
        const table = getTableById(freedTableId);
        if (table.currentStatus === TableStatus.AVAILABLE) {
          nextMatchedEntry = matchNextWaitingCustomerInternal(freedTableId);
        }
      }
    } else {
      db.prepare('UPDATE waiting_list SET status = ? WHERE entry_id = ?').run(status, entryId);
    }
  });

  tx();
  return {
    entry: getWaitingListEntryById(entryId),
    nextMatchedEntry,
  };
}

export function deleteWaitingListEntry(entryId: string): void {
  const existing = getWaitingListEntryById(entryId);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM waiting_list WHERE entry_id = ?').run(entryId);
    if (existing.matchedTableId && existing.status === WaitingStatus.READY_TO_SEAT) {
      syncTableStatus(existing.matchedTableId);
    }
  });
  tx();
}

export function getOccupancySummary(dateRaw?: string): {
  date: string;
  tablesSummary: {
    totalTables: number;
    operationalTables: number;
    availableTables: number;
    reservedTables: number;
    occupiedTables: number;
    maintenanceTables: number;
    totalOperationalSeats: number;
    occupiedSeats: number;
  };
  dailySummary: {
    totalActiveBookings: number;
    totalExpectedGuests: number;
    peakSlot: string | null;
    peakUtilizationPercent: number;
    averageSlotUtilizationPercent: number;
  };
  slotOccupancy: SlotOccupancy[];
  tables: RestaurantTable[];
} {
  const date = dateRaw ? validateIsoDate(dateRaw, true) : getTodayIsoDate();
  const rules = getBookingRules();
  const tables = listTables();

  const operationalTables = tables.filter((t) => t.currentStatus !== TableStatus.MAINTENANCE);
  const availableTables = tables.filter((t) => t.currentStatus === TableStatus.AVAILABLE).length;
  const reservedTables = tables.filter((t) => t.currentStatus === TableStatus.RESERVED).length;
  const occupiedTables = tables.filter((t) => t.currentStatus === TableStatus.OCCUPIED).length;
  const maintenanceTables = tables.filter((t) => t.currentStatus === TableStatus.MAINTENANCE).length;

  const totalOperationalSeats = operationalTables.reduce((sum, t) => sum + t.seatingCapacity, 0);
  const occupiedSeats = tables
    .filter((t) => t.currentStatus === TableStatus.OCCUPIED)
    .reduce((sum, t) => sum + t.seatingCapacity, 0);

  const reservationsForDate = listReservations({ date }).filter(
    (r) => r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.SEATED
  );

  const opCount = Math.max(1, operationalTables.length);
  const slotOccupancy: SlotOccupancy[] = rules.timeSlots.map((slot) => {
    const slotRes = reservationsForDate.filter((r) => r.timeSlot === slot);
    const bookedTables = new Set(slotRes.map((r) => r.tableId)).size;
    const totalGuests = slotRes.reduce((sum, r) => sum + r.partySize, 0);
    const utilizationPercent = Math.round((bookedTables / opCount) * 100);
    let demandLevel: 'Low' | 'Moderate' | 'Busy' = 'Low';
    if (utilizationPercent >= 50) {
      demandLevel = 'Busy';
    } else if (utilizationPercent >= 25) {
      demandLevel = 'Moderate';
    }
    return {
      timeSlot: slot,
      bookedTables,
      operationalTables: operationalTables.length,
      totalGuests,
      utilizationPercent,
      demandLevel,
    };
  });

  const sortedByUtil = [...slotOccupancy].sort(
    (a, b) => b.utilizationPercent - a.utilizationPercent || b.totalGuests - a.totalGuests
  );
  const peak = sortedByUtil[0];
  const averageSlotUtilizationPercent =
    slotOccupancy.length > 0
      ? Math.round(
          slotOccupancy.reduce((sum, s) => sum + s.utilizationPercent, 0) / slotOccupancy.length
        )
      : 0;

  return {
    date,
    tablesSummary: {
      totalTables: tables.length,
      operationalTables: operationalTables.length,
      availableTables,
      reservedTables,
      occupiedTables,
      maintenanceTables,
      totalOperationalSeats,
      occupiedSeats,
    },
    dailySummary: {
      totalActiveBookings: reservationsForDate.length,
      totalExpectedGuests: reservationsForDate.reduce((sum, r) => sum + r.partySize, 0),
      peakSlot: peak && peak.bookedTables > 0 ? peak.timeSlot : null,
      peakUtilizationPercent: peak ? peak.utilizationPercent : 0,
      averageSlotUtilizationPercent,
    },
    slotOccupancy,
    tables,
  };
}

export function getDashboardData(dateRaw?: string) {
  const date = dateRaw ? validateIsoDate(dateRaw, true) : getTodayIsoDate();
  const occupancy = getOccupancySummary(date);
  const allReservations = listReservations();
  const todaysBookings = allReservations.filter((r) => r.bookingDate === date);
  const activeWaiting = listWaitingList();
  const recentReservations = allReservations.slice(0, 8);
  const rules = getBookingRules();

  return {
    date,
    stats: {
      totalTables: occupancy.tablesSummary.totalTables,
      availableTables: occupancy.tablesSummary.availableTables,
      occupiedTables: occupancy.tablesSummary.occupiedTables,
      reservedTables: occupancy.tablesSummary.reservedTables,
      maintenanceTables: occupancy.tablesSummary.maintenanceTables,
      totalReservations: allReservations.length,
      todaysBookingsCount: todaysBookings.filter((r) => r.status !== ReservationStatus.CANCELLED).length,
      todaysExpectedGuests: todaysBookings
        .filter((r) => r.status !== ReservationStatus.CANCELLED)
        .reduce((sum, r) => sum + r.partySize, 0),
      waitingCustomersCount: activeWaiting.filter((w) => w.status === WaitingStatus.WAITING).length,
      readyToSeatCount: activeWaiting.filter((w) => w.status === WaitingStatus.READY_TO_SEAT).length,
    },
    tables: occupancy.tables,
    slotOccupancy: occupancy.slotOccupancy,
    recentReservations,
    todaysBookings,
    waitingList: activeWaiting,
    rules,
  };
}

export function generateReport(
  reportType: string,
  options?: { date?: string; customerId?: string }
) {
  const date = options?.date ? validateIsoDate(options.date, true) : getTodayIsoDate();

  switch (reportType) {
    case 'daily': {
      const bookings = listReservations({ date });
      const confirmed = bookings.filter((b) => b.status === ReservationStatus.CONFIRMED).length;
      const seated = bookings.filter((b) => b.status === ReservationStatus.SEATED).length;
      const completed = bookings.filter((b) => b.status === ReservationStatus.COMPLETED).length;
      const cancelled = bookings.filter((b) => b.status === ReservationStatus.CANCELLED).length;
      const totalExpectedGuests = bookings
        .filter((b) => b.status !== ReservationStatus.CANCELLED)
        .reduce((sum, b) => sum + b.partySize, 0);
      return {
        type: 'daily',
        date,
        summary: {
          totalBookings: bookings.length,
          confirmed,
          seated,
          completed,
          cancelled,
          totalExpectedGuests,
        },
        rows: bookings,
      };
    }

    case 'history': {
      const rows = listReservations();
      return {
        type: 'history',
        summary: {
          totalRecords: rows.length,
          activeRecords: rows.filter(
            (r) => r.status === ReservationStatus.CONFIRMED || r.status === ReservationStatus.SEATED
          ).length,
          completedRecords: rows.filter((r) => r.status === ReservationStatus.COMPLETED).length,
          cancelledRecords: rows.filter((r) => r.status === ReservationStatus.CANCELLED).length,
        },
        rows,
      };
    }

    case 'waiting-list': {
      const rows = listWaitingList({ includeAll: true });
      const waiting = rows.filter((r) => r.status === WaitingStatus.WAITING);
      const avgWait =
        waiting.length > 0
          ? Math.round(waiting.reduce((s, r) => s + r.estimatedWaitMinutes, 0) / waiting.length)
          : 0;
      return {
        type: 'waiting-list',
        summary: {
          totalEntries: rows.length,
          waitingCount: waiting.length,
          readyToSeatCount: rows.filter((r) => r.status === WaitingStatus.READY_TO_SEAT).length,
          seatedCount: rows.filter((r) => r.status === WaitingStatus.SEATED).length,
          cancelledCount: rows.filter((r) => r.status === WaitingStatus.CANCELLED).length,
          averageEstimatedWaitMinutes: avgWait,
        },
        rows,
      };
    }

    case 'occupancy': {
      const occ = getOccupancySummary(date);
      const bookingsForDate = listReservations({ date }).filter(
        (r) => r.status !== ReservationStatus.CANCELLED
      );
      const tableBreakdown = occ.tables.map((t) => {
        const tableBookings = bookingsForDate.filter((r) => r.tableId === t.tableId);
        return {
          ...t,
          bookingsToday: tableBookings.length,
          guestsToday: tableBookings.reduce((s, r) => s + r.partySize, 0),
        };
      });
      return {
        type: 'occupancy',
        date,
        summary: occ.tablesSummary,
        slotOccupancy: occ.slotOccupancy,
        rows: tableBreakdown,
      };
    }

    case 'customer': {
      if (options?.customerId) {
        return {
          type: 'customer',
          ...getCustomerHistory(options.customerId),
        };
      }
      const customers = listCustomers();
      return {
        type: 'customer',
        customers,
      };
    }

    default:
      throw new InvalidInputError(`Unknown report type: ${reportType}`);
  }
}
