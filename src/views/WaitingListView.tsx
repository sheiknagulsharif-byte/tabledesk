import { ArrowRightLeft, BellRing, Clock, Plus, Trash2, UserCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusLabel } from '../components/StatusLabel';
import { RestaurantTable, WaitingListEntry } from '../types';

interface WaitingListViewProps {
  refreshTrigger: number;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onDataChanged: () => void;
}

export function WaitingListView({
  refreshTrigger,
  onNotify,
  onDataChanged,
}: WaitingListViewProps) {
  const [entries, setEntries] = useState<WaitingListEntry[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [includeAll, setIncludeAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [partySize, setPartySize] = useState<number>(2);
  const [arrivalTime, setArrivalTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [estimatePreview, setEstimatePreview] = useState<{
    estimatedWaitMinutes: number;
    aheadCount: number;
    capableTablesCount: number;
  } | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedTableToRelease, setSelectedTableToRelease] = useState('');
  const [matchingBusy, setMatchingBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<WaitingListEntry | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [queue, allTables] = await Promise.all([
        api.getWaitingList(includeAll),
        api.getTables(),
      ]);
      setEntries(queue);
      setTables(allTables);
      const releasable = allTables.filter((t) => t.currentStatus !== 'MAINTENANCE');
      if (releasable.length > 0 && !releasable.some((t) => t.tableId === selectedTableToRelease)) {
        setSelectedTableToRelease(releasable[0].tableId);
      }
    } catch (err) {
      onNotify('error', 'Failed to load waiting list', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [includeAll, refreshTrigger]);

  useEffect(() => {
    if (!partySize || partySize < 1) return;
    let cancelled = false;
    api
      .estimateWaitTime(partySize)
      .then((res) => {
        if (!cancelled) {
          setEstimatePreview(res);
          setEstimateError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEstimatePreview(null);
          setEstimateError(err instanceof ApiError ? err.message : null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [partySize, entries.length, refreshTrigger]);

  async function handleEnqueue(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await api.addWaitingListEntry({
        customerName,
        phoneNumber,
        partySize,
        arrivalTime,
      });
      onNotify(
        'success',
        `Added ${created.entryId} to waiting queue`,
        `${created.customerName} (Party of ${created.partySize}) · Est. wait ${created.estimatedWaitMinutes} min.`
      );
      setCustomerName('');
      setPhoneNumber('');
      await loadData();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to enqueue customer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReleaseAndMatch() {
    if (!selectedTableToRelease) return;
    setMatchingBusy(true);
    try {
      const res = await api.releaseTable(selectedTableToRelease);
      if (res.matchedEntry) {
        onNotify(
          'success',
          `Matched ${res.matchedEntry.entryId} to Table #${res.table.tableNumber}`,
          `${res.matchedEntry.customerName} (Party of ${res.matchedEntry.partySize}) is now READY_TO_SEAT.`
        );
      } else {
        onNotify(
          'info',
          `Table #${res.table.tableNumber} released`,
          'Table marked AVAILABLE. No waiting party fits its seating capacity.'
        );
      }
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Table release failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setMatchingBusy(false);
    }
  }

  async function handleMatchAvailableTable(table: RestaurantTable) {
    setMatchingBusy(true);
    try {
      const res = await api.releaseTable(table.tableId);
      if (res.matchedEntry) {
        onNotify(
          'success',
          `Matched ${res.matchedEntry.entryId} to Table #${res.table.tableNumber}`,
          `${res.matchedEntry.customerName} (Party of ${res.matchedEntry.partySize}) is now READY_TO_SEAT.`
        );
      } else {
        onNotify(
          'info',
          `No suitable waiting party for Table #${res.table.tableNumber}`,
          `No active waiting customer fits ${table.seatingCapacity} seats.`
        );
      }
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Match failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setMatchingBusy(false);
    }
  }

  async function handleMarkReady(entry: WaitingListEntry) {
    setActionBusyId(entry.entryId);
    try {
      const res = await api.updateWaitingListStatus(entry.entryId, 'READY_TO_SEAT');
      onNotify(
        'success',
        `${entry.customerName} marked Ready to Seat`,
        res.entry.matchedTableNumber
          ? `Held Table #${res.entry.matchedTableNumber} (${res.entry.matchedTableId}).`
          : undefined
      );
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'No suitable available table', err instanceof ApiError ? err.message : undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleSeatGuest(entry: WaitingListEntry) {
    setActionBusyId(entry.entryId);
    try {
      const res = await api.updateWaitingListStatus(entry.entryId, 'SEATED');
      onNotify(
        'success',
        `${entry.customerName} seated`,
        res.entry.matchedTableNumber
          ? `Table #${res.entry.matchedTableNumber} is now OCCUPIED.`
          : undefined
      );
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Unable to seat guest', err instanceof ApiError ? err.message : undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelEntry(entry: WaitingListEntry) {
    setActionBusyId(entry.entryId);
    try {
      const res = await api.updateWaitingListStatus(entry.entryId, 'CANCELLED');
      onNotify(
        'info',
        `${entry.entryId} cancelled`,
        res.nextMatchedEntry
          ? `Freed table automatically matched to ${res.nextMatchedEntry.customerName} (${res.nextMatchedEntry.entryId}).`
          : undefined
      );
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Cancel failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!removeTarget) return;
    setActionBusyId(removeTarget.entryId);
    try {
      await api.deleteWaitingListEntry(removeTarget.entryId);
      onNotify('success', 'Entry removed', `${removeTarget.entryId} deleted from waiting list.`);
      setRemoveTarget(null);
      await loadData();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Remove failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setActionBusyId(null);
    }
  }

  const releasableTables = tables.filter((t) => t.currentStatus !== 'MAINTENANCE');
  const availableTables = tables.filter((t) => t.currentStatus === 'AVAILABLE');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left column: Enqueue Form + Release Table Matcher */}
      <div className="lg:col-span-4 space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900">Add to Waiting List</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Walk-in guests are queued in FIFO arrival order with rule-based wait estimates.
          </p>

          <form onSubmit={handleEnqueue} className="mt-4 space-y-3.5">
            <div>
              <label htmlFor="wl-name" className="block text-xs font-medium text-slate-700 mb-1">
                Customer Name
              </label>
              <input
                id="wl-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Sameer Khan"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="wl-phone" className="block text-xs font-medium text-slate-700 mb-1">
                Phone Number (10–12 digits)
              </label>
              <input
                id="wl-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9848099112"
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="wl-party" className="block text-xs font-medium text-slate-700 mb-1">
                  Party Size
                </label>
                <input
                  id="wl-party"
                  type="number"
                  min={1}
                  max={20}
                  value={partySize}
                  onChange={(e) => setPartySize(Math.max(1, Number(e.target.value) || 1))}
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="wl-time" className="block text-xs font-medium text-slate-700 mb-1">
                  Arrival Time (24h)
                </label>
                <input
                  id="wl-time"
                  type="time"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            {estimatePreview && !estimateError && (
              <div className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                <Clock className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <span>
                  Estimated wait:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {estimatePreview.estimatedWaitMinutes} min
                  </strong>{' '}
                  ({estimatePreview.aheadCount} ahead · {estimatePreview.capableTablesCount} capable tables)
                </span>
              </div>
            )}

            {estimateError && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {estimateError}
              </p>
            )}

            {formError && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || Boolean(estimateError)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{submitting ? 'Adding...' : 'Add to Queue'}</span>
            </button>
          </form>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Release Table &amp; Match Next Guest
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Frees a table and selects the earliest suitable waiting party (party size &le; table capacity).
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="wl-release-table"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Select Table to Release
              </label>
              <select
                id="wl-release-table"
                value={selectedTableToRelease}
                onChange={(e) => setSelectedTableToRelease(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                {releasableTables.map((t) => (
                  <option key={t.tableId} value={t.tableId}>
                    {t.tableId} — Table #{t.tableNumber} ({t.seatingCapacity} seats · {t.currentStatus})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleReleaseAndMatch}
              disabled={matchingBusy || !selectedTableToRelease}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
              <span>{matchingBusy ? 'Matching...' : 'Release Table & Match Next'}</span>
            </button>
          </div>
        </section>
        <section className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Suitable Available Tables
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Currently open tables ready to match the next eligible waiting party.
          </p>

          {availableTables.length === 0 ? (
            <p className="text-xs text-slate-500 mt-3">
              No tables are currently AVAILABLE. Release an occupied table below when guests finish.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {availableTables.map((t) => (
                <li
                  key={t.tableId}
                  className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-slate-50"
                >
                  <div>
                    <span className="font-semibold text-slate-900">Table #{t.tableNumber}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="font-mono text-slate-700">{t.seatingCapacity} seats</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-600">{t.location}</span>
                  </div>
                  <button
                    type="button"
                    disabled={matchingBusy}
                    onClick={() => handleMatchAvailableTable(t)}
                    className="px-2.5 py-1 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    Match Next
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Right column: Queue Table */}
      <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Waiting List Queue</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Ordered by seating readiness and FIFO arrival timestamp
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setIncludeAll(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                !includeAll
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Queue
            </button>
            <button
              type="button"
              onClick={() => setIncludeAll(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                includeAll
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Entries
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">Waiting list is empty</p>
            <p className="text-xs text-slate-500 mt-1">
              Add walk-in guests on the left when suitable tables are occupied.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Pos / ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-right">Party</th>
                  <th className="py-3 px-4">Arrival</th>
                  <th className="py-3 px-4 text-right">Est. Wait</th>
                  <th className="py-3 px-4">Status &amp; Match</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {entries.map((entry) => {
                  const isBusy = actionBusyId === entry.entryId;
                  const canSeat = entry.status === 'WAITING' || entry.status === 'READY_TO_SEAT';
                  return (
                    <tr key={entry.entryId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {entry.queuePosition ? `#${entry.queuePosition} · ` : ''}
                          {entry.entryId}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{entry.customerName}</div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          {entry.customerPhone}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-900 text-right tabular-nums whitespace-nowrap">
                        {entry.partySize}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {entry.arrivalTime}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right tabular-nums whitespace-nowrap">
                        {entry.estimatedWaitMinutes} min
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusLabel status={entry.status} />
                        {entry.matchedTableNumber && (
                          <div className="text-xs font-mono text-teal-700 mt-0.5">
                            Matched: Table #{entry.matchedTableNumber} ({entry.matchedTableId})
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {entry.status === 'WAITING' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleMarkReady(entry)}
                              title="Match best-fit available table and mark Ready to Seat"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 disabled:opacity-50"
                            >
                              <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Ready</span>
                            </button>
                          )}
                          {canSeat && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleSeatGuest(entry)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Seat</span>
                            </button>
                          )}
                          {canSeat && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleCancelEntry(entry)}
                              aria-label={`Cancel ${entry.entryId}`}
                              title="Cancel entry"
                              className="p-1.5 text-amber-700 hover:text-amber-900 border border-amber-200 rounded-md hover:bg-amber-50 disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setRemoveTarget(entry)}
                            aria-label={`Remove ${entry.entryId}`}
                            title="Delete record"
                            className="p-1.5 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-md hover:bg-rose-50 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove Waiting List Entry"
        description={
          removeTarget
            ? `Permanently remove ${removeTarget.entryId} (${removeTarget.customerName}) from the waiting list?`
            : ''
        }
        confirmLabel="Remove Entry"
        destructive
        busy={actionBusyId !== null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
