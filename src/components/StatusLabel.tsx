import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import { ReservationStatus, TableStatus, WaitingStatus } from '../types';

type AnyStatus = TableStatus | ReservationStatus | WaitingStatus | 'Low' | 'Moderate' | 'Busy';

interface StatusConfig {
  label: string;
  textClass: string;
  Icon: typeof CheckCircle2;
}

const STATUS_MAP: Record<AnyStatus, StatusConfig> = {
  AVAILABLE: { label: 'Available', textClass: 'text-emerald-700', Icon: CheckCircle2 },
  CONFIRMED: { label: 'Confirmed', textClass: 'text-emerald-700', Icon: CheckCircle2 },
  RESERVED: { label: 'Reserved', textClass: 'text-amber-700', Icon: Clock },
  OCCUPIED: { label: 'Occupied', textClass: 'text-indigo-700', Icon: Users },
  SEATED: { label: 'Seated', textClass: 'text-indigo-700', Icon: Users },
  COMPLETED: { label: 'Completed', textClass: 'text-slate-600', Icon: CheckCircle2 },
  MAINTENANCE: { label: 'Maintenance', textClass: 'text-rose-700', Icon: Wrench },
  CANCELLED: { label: 'Cancelled', textClass: 'text-rose-700', Icon: XCircle },
  WAITING: { label: 'Waiting', textClass: 'text-amber-700', Icon: Clock },
  READY_TO_SEAT: { label: 'Ready to Seat', textClass: 'text-teal-700', Icon: BellRing },
  Low: { label: 'Low Demand', textClass: 'text-emerald-700', Icon: CheckCircle2 },
  Moderate: { label: 'Moderate', textClass: 'text-amber-700', Icon: AlertTriangle },
  Busy: { label: 'Busy Peak', textClass: 'text-rose-700', Icon: AlertTriangle },
};

export function StatusLabel({ status }: { status: AnyStatus }) {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    textClass: 'text-slate-600',
    Icon: Clock,
  };
  const { Icon, label, textClass } = cfg;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${textClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
