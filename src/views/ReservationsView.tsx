import {
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  Plus,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api, getTodayIsoDate } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ReservationPrefill } from '../components/NewReservationModal';
import { StatusLabel } from '../components/StatusLabel';
import { BookingRulesConfig, Reservation, ReservationStatus, RestaurantTable } from '../types';

interface ReservationsViewProps {
  refreshTrigger: number;
  rules: BookingRulesConfig;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onDataChanged: () => void;
  onOpenNewReservation: (prefill?: ReservationPrefill) => void;
  onEditReservation: (res: Reservation) => void;
  onViewSlip: (res: Reservation) => void;
  onGoToWaitingList: () => void;
}

const STATUS_TABS = ['ALL', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED'];

export function ReservationsView({
  refreshTrigger,
  rules,
  onNotify,
  onDataChanged,
  onOpenNewReservation,
  onEditReservation,
  onViewSlip,
  onGoToWaitingList,
}: ReservationsViewProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Module 7.3: Dedicated Table Availability Checker state
  const [availDate, setAvailDate] = useState(getTodayIsoDate());
  const [availSlot, setAvailSlot] = useState(
    rules.timeSlots.includes('08:00 PM') ? '08:00 PM' : rules.timeSlots[0] || ''
  );
  const [availParty, setAvailParty] = useState<number>(2);
  const [availChecking, setAvailChecking] = useState(false);
  const [availResult, setAvailResult] = useState<{
    availableTables: RestaurantTable[];
    bestFitTable: RestaurantTable | null;
    error?: string;
    canWaitlist?: boolean;
  } | null>(null);

  async function loadReservations() {
    setLoading(true);
    try {
      const list = await api.getReservations({
        status: statusFilter,
        date: dateFilter || undefined,
        timeSlot: slotFilter !== 'ALL' ? slotFilter : undefined,
        search: search.trim() || undefined,
      });
      setReservations(list);
    } catch (err) {
      onNotify('error', 'Failed to load reservations', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReservations();
  }, [statusFilter, dateFilter, slotFilter, search, refreshTrigger]);

  useEffect(() => {
    if (rules.timeSlots.length > 0 && !rules.timeSlots.includes(availSlot)) {
      setAvailSlot(rules.timeSlots[0]);
    }
    if (slotFilter !== 'ALL' && !rules.timeSlots.includes(slotFilter)) {
      setSlotFilter('ALL');
    }
  }, [rules.timeSlots, availSlot, slotFilter]);

  async function handleCheckAvailability(e: React.FormEvent) {
    e.preventDefault();
    setAvailChecking(true);
    try {
      const res = await api.checkAvailability({
        date: availDate,
        timeSlot: availSlot,
        partySize: availParty,
      });
      setAvailResult({
        availableTables: res.availableTables,
        bestFitTable: res.bestFitTable,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setAvailResult({
          availableTables: [],
          bestFitTable: null,
          error: err.message,
          canWaitlist: err.details?.canWaitlist !== false,
        });
      } else {
        setAvailResult({
          availableTables: [],
          bestFitTable: null,
          error: 'Unable to verify availability.',
        });
      }
    } finally {
      setAvailChecking(false);
    }
  }

  async function changeStatus(res: Reservation, nextStatus: ReservationStatus) {
    setBusyId(res.reservationId);
    try {
      const result = await api.updateReservationStatus(res.reservationId, nextStatus);
      onNotify(
        'success',
        `Reservation ${res.reservationId} ${nextStatus.toLowerCase()}`,
        result.matchedWaitingEntry
          ? `Freed Table #${res.tableNumber} automatically matched to ${result.matchedWaitingEntry.customerName} (${result.matchedWaitingEntry.entryId}).`
          : undefined
      );
      setCancelTarget(null);
      await loadReservations();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Status update failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Module 7.3: Check Table Availability Panel */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Check Table Availability</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect eligible open tables sorted by best-fit ascending capacity before booking.
            </p>
          </div>

          <form onSubmit={handleCheckAvailability} className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="avail-date" className="block text-xs font-medium text-slate-700 mb-1">
                Date
              </label>
              <input
                id="avail-date"
                type="date"
                min={getTodayIsoDate()}
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                required
                className="px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="avail-slot" className="block text-xs font-medium text-slate-700 mb-1">
                Time Slot
              </label>
              <select
                id="avail-slot"
                value={availSlot}
                onChange={(e) => setAvailSlot(e.target.value)}
                required
                className="px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {rules.timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="avail-party" className="block text-xs font-medium text-slate-700 mb-1">
                Party Size
              </label>
              <input
                id="avail-party"
                type="number"
                min={1}
                max={20}
                value={availParty}
                onChange={(e) => setAvailParty(Math.max(1, Number(e.target.value) || 1))}
                required
                className="w-24 px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              disabled={availChecking}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {availChecking ? 'Checking...' : 'Check Availability'}
            </button>
          </form>
        </div>

        {availResult && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            {availResult.availableTables.length > 0 && availResult.bestFitTable ? (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-emerald-700">
                    {availResult.availableTables.length} eligible table
                    {availResult.availableTables.length > 1 ? 's' : ''} open for {availParty} guests on{' '}
                    <span className="font-mono">{availDate}</span> at{' '}
                    <span className="font-mono">{availSlot}</span>. Best fit: Table #
                    {availResult.bestFitTable.tableNumber} ({availResult.bestFitTable.seatingCapacity}{' '}
                    seats).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availResult.availableTables.map((t, index) => (
                    <button
                      key={t.tableId}
                      type="button"
                      onClick={() =>
                        onOpenNewReservation({
                          bookingDate: availDate,
                          timeSlot: availSlot,
                          partySize: availParty,
                          preferredTableId: t.tableId,
                        })
                      }
                      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        index === 0
                          ? 'bg-teal-50 border-teal-300 text-teal-900 hover:bg-teal-100'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-mono font-semibold">{t.tableId}</span>
                      <span>
                        Table #{t.tableNumber} · {t.seatingCapacity} seats · {t.location}
                      </span>
                      {index === 0 && (
                        <span className="text-teal-700 font-semibold">[Book Best Fit]</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {availResult.error ||
                      `No suitable table is available for ${availParty} guests on ${availDate} at ${availSlot}.`}
                  </span>
                </div>
                {availResult.canWaitlist !== false && (
                  <button
                    type="button"
                    onClick={onGoToWaitingList}
                    className="font-semibold text-amber-900 underline hover:text-amber-700 whitespace-nowrap"
                  >
                    Go to Waiting List
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filter & Actions Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'ALL' ? 'All Bookings' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, RES-ID, CNF..."
              aria-label="Search reservations"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <select
            value={slotFilter}
            onChange={(e) => setSlotFilter(e.target.value)}
            aria-label="Filter by time slot"
            className="px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Slots</option>
            {rules.timeSlots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter reservations by date"
            className="px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
            >
              Clear date
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenNewReservation()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* Reservations Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : reservations.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">No reservations found</p>
            <p className="text-xs text-slate-500 mt-1">
              Adjust your filters or create a new table reservation.
            </p>
            <button
              type="button"
              onClick={() => onOpenNewReservation()}
              className="mt-4 px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
            >
              Create Reservation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Reservation / Code</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date &amp; Slot</th>
                  <th className="py-3 px-4 text-right">Party</th>
                  <th className="py-3 px-4">Allocated Table</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reservations.map((res) => {
                  const isActive = res.status === 'CONFIRMED' || res.status === 'SEATED';
                  const isBusy = busyId === res.reservationId;
                  return (
                    <tr key={res.reservationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{res.reservationId}</div>
                        <div className="text-slate-500">{res.confirmationCode}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{res.customerName}</div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          {res.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>{res.bookingDate}</div>
                        <div className="text-slate-500">{res.timeSlot}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-900 text-right tabular-nums whitespace-nowrap">
                        {res.partySize}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                        <span className="font-medium text-slate-900">
                          Table #{res.tableNumber}
                        </span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span>
                          {res.tableCapacity} seats ({res.tableLocation})
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel status={res.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewSlip(res)}
                            title="View Confirmation Slip"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Slip</span>
                          </button>

                          {res.status === 'CONFIRMED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => changeStatus(res, 'SEATED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Seat</span>
                            </button>
                          )}

                          {res.status === 'SEATED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => changeStatus(res, 'COMPLETED')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Complete</span>
                            </button>
                          )}

                          {isActive && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditReservation(res)}
                                aria-label={`Edit reservation ${res.reservationId}`}
                                className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelTarget(res)}
                                aria-label={`Cancel reservation ${res.reservationId}`}
                                className="p-1.5 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-md hover:bg-rose-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Reservation"
        description={
          cancelTarget
            ? `Cancel reservation ${cancelTarget.reservationId} (${cancelTarget.confirmationCode}) for ${cancelTarget.customerName} on ${cancelTarget.bookingDate} at ${cancelTarget.timeSlot}?`
            : ''
        }
        confirmLabel="Cancel Reservation"
        destructive
        busy={busyId !== null}
        onConfirm={() => {
          if (cancelTarget) changeStatus(cancelTarget, 'CANCELLED');
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
