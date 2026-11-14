import { Printer, X } from 'lucide-react';
import { Reservation } from '../types';
import { StatusLabel } from './StatusLabel';

export function ReservationSlipModal({
  reservation,
  onClose,
}: {
  reservation: Reservation | null;
  onClose: () => void;
}) {
  if (!reservation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slip-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono text-slate-500">Individual Reservation Confirmation</p>
            <h3 id="slip-modal-title" className="text-lg font-semibold text-slate-900 mt-0.5">
              Booking Confirmation Slip
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reservation slip"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors no-print"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-slate-500">Confirmation Code</p>
              <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
                {reservation.confirmationCode}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Reservation ID</p>
              <p className="text-sm font-mono font-medium text-slate-700 tabular-nums">
                {reservation.reservationId}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Guest Name</dt>
              <dd className="font-medium text-slate-900 mt-0.5">{reservation.customerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Phone Number</dt>
              <dd className="font-mono text-slate-900 tabular-nums mt-0.5">
                {reservation.customerPhone}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Booking Date</dt>
              <dd className="font-mono text-slate-900 tabular-nums mt-0.5">
                {reservation.bookingDate}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Time Slot</dt>
              <dd className="font-mono text-slate-900 tabular-nums mt-0.5">
                {reservation.timeSlot}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Allocated Table</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                Table #{reservation.tableNumber}{' '}
                <span className="text-slate-500 font-normal">
                  ({reservation.tableId} · {reservation.tableCapacity} seats · {reservation.tableLocation})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Party Size &amp; Status</dt>
              <dd className="flex items-center gap-3 mt-0.5">
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {reservation.partySize} guests
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <StatusLabel status={reservation.status} />
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
