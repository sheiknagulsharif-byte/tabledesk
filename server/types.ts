export const TableStatus = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];

export const ReservationStatus = {
  CONFIRMED: 'CONFIRMED',
  SEATED: 'SEATED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export const WaitingStatus = {
  WAITING: 'WAITING',
  READY_TO_SEAT: 'READY_TO_SEAT',
  SEATED: 'SEATED',
  CANCELLED: 'CANCELLED',
} as const;
export type WaitingStatus = (typeof WaitingStatus)[keyof typeof WaitingStatus];

export interface RestaurantTable {
  tableId: string;
  tableNumber: number;
  seatingCapacity: number;
  location: string;
  currentStatus: TableStatus;
}

export interface Customer {
  customerId: string;
  name: string;
  phoneNumber: string;
  createdAt: string;
}

export interface Reservation {
  reservationId: string;
  confirmationCode: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  tableId: string;
  tableNumber: number;
  tableCapacity: number;
  tableLocation: string;
  bookingDate: string;
  timeSlot: string;
  partySize: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface WaitingListEntry {
  entryId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  arrivalTime: string;
  estimatedWaitMinutes: number;
  status: WaitingStatus;
  matchedTableId: string | null;
  matchedTableNumber: number | null;
  matchedTableCapacity: number | null;
  matchedTableLocation: string | null;
  queuePosition: number | null;
  createdAt: string;
}

export interface BookingRulesConfig {
  avgDiningMinutes: number;
  turnoverBufferMinutes: number;
  maxPartySize: number;
  timeSlots: string[];
}

export interface SlotOccupancy {
  timeSlot: string;
  bookedTables: number;
  operationalTables: number;
  totalGuests: number;
  utilizationPercent: number;
  demandLevel: 'Low' | 'Moderate' | 'Busy';
}
