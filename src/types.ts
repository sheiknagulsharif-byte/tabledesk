export type TableStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
export type ReservationStatus = 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED';
export type WaitingStatus = 'WAITING' | 'READY_TO_SEAT' | 'SEATED' | 'CANCELLED';

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
  reservationCount?: number;
  waitingCount?: number;
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

export interface DashboardPayload {
  date: string;
  stats: {
    totalTables: number;
    availableTables: number;
    occupiedTables: number;
    reservedTables: number;
    maintenanceTables: number;
    totalReservations: number;
    todaysBookingsCount: number;
    todaysExpectedGuests: number;
    waitingCustomersCount: number;
    readyToSeatCount: number;
  };
  tables: RestaurantTable[];
  slotOccupancy: SlotOccupancy[];
  recentReservations: Reservation[];
  todaysBookings: Reservation[];
  waitingList: WaitingListEntry[];
  rules: BookingRulesConfig;
}

export interface OccupancyPayload {
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
}

export type ActiveTab =
  | 'dashboard'
  | 'tables'
  | 'reservations'
  | 'waiting-list'
  | 'customers'
  | 'occupancy'
  | 'reports'
  | 'architecture';
