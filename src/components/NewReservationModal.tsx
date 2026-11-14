import { AlertCircle, CheckCircle2, Clock, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api, getTodayIsoDate } from '../api';
import { BookingRulesConfig, Customer, Reservation, RestaurantTable } from '../types';

export interface ReservationPrefill {
  bookingDate: string;
  timeSlot: string;
  partySize: number;
  preferredTableId?: string;
}

interface NewReservationModalProps {
  open: boolean;
  editingReservation?: Reservation | null;
  prefill?: ReservationPrefill | null;
  rules: BookingRulesConfig;
  defaultDate?: string;
  onClose: () => void;
  onSuccess: (reservation: Reservation, message: string) => void;
  onAddedToWaitlist: (message: string) => void;
}

export function NewReservationModal({
  open,
  editingReservation,
  prefill,
  rules,
  defaultDate,
  onClose,
  onSuccess,
  onAddedToWaitlist,
}: NewReservationModalProps) {
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(defaultDate || getTodayIsoDate());
  const [timeSlot, setTimeSlot] = useState(rules.timeSlots[0] || '08:00 PM');
  const [partySize, setPartySize] = useState<number>(2);
  const [preferredTableId, setPreferredTableId] = useState<string>('');

  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [bestFitTable, setBestFitTable] = useState<RestaurantTable | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [canOfferWaitlist, setCanOfferWaitlist] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setCanOfferWaitlist(false);
    setAvailabilityMessage(null);

    api
      .getCustomers()
      .then((list) => setCustomers(list))
      .catch(() => setCustomers([]));

    if (editingReservation) {
      setCustomerMode('existing');
      setSelectedCustomerId(editingReservation.customerId);
      setCustomerName(editingReservation.customerName);
      setPhoneNumber(editingReservation.customerPhone);
      setBookingDate(editingReservation.bookingDate);
      setTimeSlot(editingReservation.timeSlot);
      setPartySize(editingReservation.partySize);
      setPreferredTableId(editingReservation.tableId);
    } else {
      setCustomerMode('new');
      setSelectedCustomerId('');
      setCustomerName('');
      setPhoneNumber('');
      setBookingDate(prefill?.bookingDate || defaultDate || getTodayIsoDate());
      setTimeSlot(
        prefill?.timeSlot || (rules.timeSlots.includes('08:00 PM') ? '08:00 PM' : rules.timeSlots[0] || '')
      );
      setPartySize(prefill?.partySize || 2);
      setPreferredTableId(prefill?.preferredTableId || '');
    }
  }, [open, editingReservation, prefill, defaultDate, rules.timeSlots]);

  useEffect(() => {
    if (!open || !bookingDate || !timeSlot || !partySize || partySize < 1) return;

    let cancelled = false;
    setCheckingAvail(true);
    setAvailabilityMessage(null);
    setCanOfferWaitlist(false);

    api
      .checkAvailability({
        date: bookingDate,
        timeSlot,
        partySize,
        excludeReservationId: editingReservation?.reservationId,
      })
      .then((res) => {
        if (cancelled) return;
        setAvailableTables(res.availableTables);
        setBestFitTable(res.bestFitTable);
        if (!res.bestFitTable) {
          setAvailabilityMessage(
            `No open table fits ${partySize} guests at ${timeSlot} on ${bookingDate}.`
          );
          setCanOfferWaitlist(true);
          setPreferredTableId('');
        } else {
          setAvailabilityMessage(null);
          setPreferredTableId((currentPreferred) => {
            if (
              currentPreferred &&
              res.availableTables.some((t) => t.tableId === currentPreferred)
            ) {
              return currentPreferred;
            }
            return res.bestFitTable!.tableId;
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAvailableTables([]);
        setBestFitTable(null);
        if (err instanceof ApiError) {
          setAvailabilityMessage(err.message);
          setCanOfferWaitlist(err.details?.canWaitlist === true);
        } else {
          setAvailabilityMessage('Unable to verify table availability.');
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingAvail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, bookingDate, timeSlot, partySize, editingReservation?.reservationId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (editingReservation) {
        const updated = await api.updateReservation(editingReservation.reservationId, {
          bookingDate,
          timeSlot,
          partySize,
          preferredTableId: preferredTableId || undefined,
        });
        onSuccess(updated, `Reservation ${updated.reservationId} updated.`);
      } else {
        const payload =
          customerMode === 'existing'
            ? {
                customerId: selectedCustomerId,
                bookingDate,
                timeSlot,
                partySize,
                preferredTableId: preferredTableId || undefined,
              }
            : {
                customerName,
                phoneNumber,
                bookingDate,
                timeSlot,
                partySize,
                preferredTableId: preferredTableId || undefined,
              };
        const created = await api.createReservation(payload);
        onSuccess(
          created,
          `Confirmed ${created.confirmationCode} for ${created.customerName} at Table #${created.tableNumber}.`
        );
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
        if (err.code === 'TABLE_NOT_AVAILABLE' && err.details?.canWaitlist !== false) {
          setCanOfferWaitlist(true);
        }
      } else {
        setErrorMsg('Failed to save reservation.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddToWaitlistFallback() {
    setErrorMsg(null);
    if (customerMode === 'existing' && !selectedCustomerId) {
      setErrorMsg('Please select an existing customer before adding to the waiting list.');
      return;
    }
    setSubmitting(true);
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const arrivalTime = `${hh}:${mm}`;

      const entry = await api.addWaitingListEntry(
        customerMode === 'existing'
          ? { customerId: selectedCustomerId, partySize, arrivalTime }
          : { customerName, phoneNumber, partySize, arrivalTime }
      );
      onAddedToWaitlist(
        `Added ${entry.customerName} (${entry.entryId}) to waiting list. Estimated wait: ${entry.estimatedWaitMinutes} min.`
      );
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof ApiError ? err.message : 'Unable to add guest to waiting list.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 shadow-lg my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h3 id="reservation-modal-title" className="text-lg font-semibold text-slate-900">
              {editingReservation
                ? `Edit Reservation ${editingReservation.reservationId}`
                : 'New Table Reservation'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Best-fit allocation selects the smallest open table for the party size.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {!editingReservation && (
            <div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setCustomerMode('new')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    customerMode === 'new'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  New / Walk-in Guest
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('existing')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    customerMode === 'existing'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Existing Customer
                </button>
              </div>
            </div>
          )}

          {editingReservation ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
              <span className="text-slate-500">Guest: </span>
              <span className="font-medium text-slate-900">{editingReservation.customerName}</span>
              <span className="text-slate-400 mx-2">·</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {editingReservation.customerPhone}
              </span>
            </div>
          ) : customerMode === 'existing' ? (
            <div>
              <label
                htmlFor="res-customer-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Select Customer
              </label>
              <select
                id="res-customer-select"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="">Choose a registered customer...</option>
                {customers.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.name} ({c.phoneNumber}) — {c.customerId}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="res-customer-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Customer Name
                </label>
                <input
                  id="res-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Karthik Verma"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label
                  htmlFor="res-phone"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Phone Number (10–12 digits)
                </label>
                <input
                  id="res-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 9848023456"
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="res-date" className="block text-xs font-medium text-slate-700 mb-1">
                Booking Date
              </label>
              <input
                id="res-date"
                type="date"
                value={bookingDate}
                min={getTodayIsoDate()}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="res-slot" className="block text-xs font-medium text-slate-700 mb-1">
                Time Slot
              </label>
              <select
                id="res-slot"
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {rules.timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="res-party" className="block text-xs font-medium text-slate-700 mb-1">
                Party Size
              </label>
              <input
                id="res-party"
                type="number"
                min={1}
                max={20}
                value={partySize}
                onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">
                Table Availability &amp; Best-Fit Allocation
              </span>
              {checkingAvail && (
                <span className="text-xs text-slate-500">Checking slots...</span>
              )}
            </div>

            {availableTables.length > 0 && bestFitTable ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {availableTables.length} suitable table{availableTables.length > 1 ? 's' : ''} open · Best-fit: Table #{bestFitTable.tableNumber} ({bestFitTable.seatingCapacity} seats, {bestFitTable.location})
                  </span>
                </div>
                <div>
                  <label htmlFor="res-table-select" className="block text-xs text-slate-600 mb-1">
                    Allocated Table (sorted ascending by capacity)
                  </label>
                  <select
                    id="res-table-select"
                    value={preferredTableId}
                    onChange={(e) => setPreferredTableId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {availableTables.map((t, idx) => (
                      <option key={t.tableId} value={t.tableId}>
                        {t.tableId} — Table #{t.tableNumber} ({t.seatingCapacity} seats · {t.location})
                        {idx === 0 ? ' [Best Fit]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs text-amber-800">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {availabilityMessage || 'No available tables for this selection.'}
                  </p>
                  {canOfferWaitlist && !editingReservation && (
                    <button
                      type="button"
                      onClick={handleAddToWaitlistFallback}
                      disabled={submitting}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Guest to Waiting List Instead</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-medium">{errorMsg}</p>
                {canOfferWaitlist && !editingReservation && (
                  <button
                    type="button"
                    onClick={handleAddToWaitlistFallback}
                    disabled={submitting}
                    className="mt-2 underline font-semibold text-rose-900 hover:text-rose-700"
                  >
                    Enqueue guest on Waiting List now
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || checkingAvail || availableTables.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : editingReservation
                  ? 'Save Changes'
                  : 'Confirm Reservation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
