import {
  BookingRulesConfig,
  Customer,
  DashboardPayload,
  OccupancyPayload,
  Reservation,
  ReservationStatus,
  RestaurantTable,
  TableStatus,
  WaitingListEntry,
  WaitingStatus,
} from './types';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed with status ${res.status}`,
      res.status,
      data.code || 'API_ERROR',
      data.details
    );
  }
  return data as T;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const api = {
  getDashboard: (date?: string) =>
    request<DashboardPayload>(`/api/dashboard${date ? `?date=${encodeURIComponent(date)}` : ''}`),

  getRules: () => request<BookingRulesConfig>('/api/rules'),
  updateRules: (payload: Partial<BookingRulesConfig>) =>
    request<BookingRulesConfig>('/api/rules', { method: 'PUT', body: JSON.stringify(payload) }),

  // Tables
  getTables: (status?: string) =>
    request<RestaurantTable[]>(
      `/api/tables${status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : ''}`
    ),
  createTable: (payload: {
    tableId?: string;
    tableNumber: number;
    seatingCapacity: number;
    location: string;
    currentStatus?: TableStatus;
  }) => request<RestaurantTable>('/api/tables', { method: 'POST', body: JSON.stringify(payload) }),
  updateTable: (
    tableId: string,
    payload: {
      tableNumber?: number;
      seatingCapacity?: number;
      location?: string;
      currentStatus?: TableStatus;
    }
  ) =>
    request<RestaurantTable>(`/api/tables/${encodeURIComponent(tableId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateTableStatus: (tableId: string, status: TableStatus) =>
    request<RestaurantTable>(`/api/tables/${encodeURIComponent(tableId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  releaseTable: (tableId: string) =>
    request<{ table: RestaurantTable; matchedEntry: WaitingListEntry | null }>(
      `/api/tables/${encodeURIComponent(tableId)}/release`,
      { method: 'POST' }
    ),
  deleteTable: (tableId: string) =>
    request<{ deleted: boolean }>(`/api/tables/${encodeURIComponent(tableId)}`, {
      method: 'DELETE',
    }),

  // Customers
  getCustomers: (search?: string) =>
    request<Customer[]>(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (payload: { name: string; phoneNumber: string }) =>
    request<Customer>('/api/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (customerId: string, payload: { name?: string; phoneNumber?: string }) =>
    request<Customer>(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getCustomerHistory: (customerId: string) =>
    request<{
      customer: Customer;
      reservations: Reservation[];
      waitingListEntries: WaitingListEntry[];
    }>(`/api/customers/${encodeURIComponent(customerId)}/history`),
  deleteCustomer: (customerId: string) =>
    request<{ deleted: boolean }>(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: 'DELETE',
    }),

  // Availability & Reservations
  checkAvailability: (params: {
    date: string;
    timeSlot: string;
    partySize: number;
    excludeReservationId?: string;
  }) => {
    const q = new URLSearchParams({
      date: params.date,
      timeSlot: params.timeSlot,
      partySize: String(params.partySize),
    });
    if (params.excludeReservationId) {
      q.set('excludeReservationId', params.excludeReservationId);
    }
    return request<{
      availableTables: RestaurantTable[];
      bestFitTable: RestaurantTable | null;
      maxTableCapacity: number;
    }>(`/api/availability?${q.toString()}`);
  },
  getReservations: (filters?: {
    date?: string;
    timeSlot?: string;
    status?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (filters?.date) q.set('date', filters.date);
    if (filters?.timeSlot && filters.timeSlot !== 'ALL') q.set('timeSlot', filters.timeSlot);
    if (filters?.status && filters.status !== 'ALL') q.set('status', filters.status);
    if (filters?.search) q.set('search', filters.search);
    const qs = q.toString();
    return request<Reservation[]>(`/api/reservations${qs ? `?${qs}` : ''}`);
  },
  createReservation: (payload: {
    customerId?: string;
    customerName?: string;
    phoneNumber?: string;
    bookingDate: string;
    timeSlot: string;
    partySize: number;
    preferredTableId?: string;
  }) => request<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(payload) }),
  updateReservation: (
    reservationId: string,
    payload: {
      bookingDate?: string;
      timeSlot?: string;
      partySize?: number;
      preferredTableId?: string;
      status?: ReservationStatus;
    }
  ) =>
    request<Reservation>(`/api/reservations/${encodeURIComponent(reservationId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateReservationStatus: (reservationId: string, status: ReservationStatus) =>
    request<{ reservation: Reservation; matchedWaitingEntry: WaitingListEntry | null }>(
      `/api/reservations/${encodeURIComponent(reservationId)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),

  // Waiting List
  getWaitingList: (includeAll = false) =>
    request<WaitingListEntry[]>(`/api/waiting-list${includeAll ? '?includeAll=true' : ''}`),
  estimateWaitTime: (partySize: number) =>
    request<{ estimatedWaitMinutes: number; aheadCount: number; capableTablesCount: number }>(
      `/api/waiting-list/estimate?partySize=${encodeURIComponent(String(partySize))}`
    ),
  addWaitingListEntry: (payload: {
    customerId?: string;
    customerName?: string;
    phoneNumber?: string;
    partySize: number;
    arrivalTime: string;
  }) =>
    request<WaitingListEntry>('/api/waiting-list', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWaitingListStatus: (entryId: string, status: WaitingStatus) =>
    request<{ entry: WaitingListEntry; nextMatchedEntry: WaitingListEntry | null }>(
      `/api/waiting-list/${encodeURIComponent(entryId)}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),
  deleteWaitingListEntry: (entryId: string) =>
    request<{ deleted: boolean }>(`/api/waiting-list/${encodeURIComponent(entryId)}`, {
      method: 'DELETE',
    }),

  // Occupancy & Reports
  getOccupancy: (date?: string) =>
    request<OccupancyPayload>(`/api/occupancy${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getReport: <T = unknown>(type: string, params?: { date?: string; customerId?: string }) => {
    const q = new URLSearchParams({ type });
    if (params?.date) q.set('date', params.date);
    if (params?.customerId) q.set('customerId', params.customerId);
    return request<T>(`/api/reports?${q.toString()}`);
  },
};
