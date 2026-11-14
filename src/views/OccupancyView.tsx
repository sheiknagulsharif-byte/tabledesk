import { useEffect, useState } from 'react';
import { api, getTodayIsoDate } from '../api';
import { StatusLabel } from '../components/StatusLabel';
import { OccupancyPayload } from '../types';

export function OccupancyView({
  refreshTrigger,
  onNotify,
}: {
  refreshTrigger: number;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
}) {
  const [date, setDate] = useState(getTodayIsoDate());
  const [data, setData] = useState<OccupancyPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getOccupancy(date)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          onNotify('error', 'Failed to load occupancy', err instanceof Error ? err.message : undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, refreshTrigger]);

  const summary = data?.tablesSummary;
  const seatUtilization =
    summary && summary.totalOperationalSeats > 0
      ? Math.round((summary.occupiedSeats / summary.totalOperationalSeats) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Table &amp; Time-Slot Occupancy Monitor
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track live dining floor status and slot-by-slot capacity utilization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="occ-date" className="text-xs font-medium text-slate-600">
            Target Date:
          </label>
          <input
            id="occ-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : data && summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Operational Tables</p>
              <p className="text-2xl font-display font-semibold text-slate-900 font-mono tabular-nums mt-2">
                {summary.operationalTables}/{summary.totalTables}
              </p>
              <p className="text-xs text-slate-500 mt-1">{summary.maintenanceTables} in maintenance</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Available Now</p>
              <p className="text-2xl font-display font-semibold text-emerald-700 font-mono tabular-nums mt-2">
                {summary.availableTables}
              </p>
              <p className="text-xs text-slate-500 mt-1">Open for immediate seating</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Reserved Now</p>
              <p className="text-2xl font-display font-semibold text-amber-700 font-mono tabular-nums mt-2">
                {summary.reservedTables}
              </p>
              <p className="text-xs text-slate-500 mt-1">Allocated or held</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Occupied Now</p>
              <p className="text-2xl font-display font-semibold text-indigo-700 font-mono tabular-nums mt-2">
                {summary.occupiedTables}
              </p>
              <p className="text-xs text-slate-500 mt-1">Currently dining</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-medium text-slate-500">Live Seat Utilization</p>
              <p className="text-2xl font-display font-semibold text-slate-900 font-mono tabular-nums mt-2">
                {seatUtilization}%
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {summary.occupiedSeats}/{summary.totalOperationalSeats} seats occupied
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Daily Occupancy Summary ({data.date})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 pt-3 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Active Bookings</p>
                <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {data.dailySummary.totalActiveBookings}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Expected Guests</p>
                <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {data.dailySummary.totalExpectedGuests}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Peak Dining Slot</p>
                <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {data.dailySummary.peakSlot
                    ? `${data.dailySummary.peakSlot} (${data.dailySummary.peakUtilizationPercent}%)`
                    : 'No bookings'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Avg Slot Utilization</p>
                <p className="text-lg font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                  {data.dailySummary.averageSlotUtilizationPercent}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-base font-semibold text-slate-900">
                Time-Slot Occupancy ({data.date})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-5">
                Active bookings per dining slot against operational table capacity
              </p>

              <div className="space-y-4">
                {data.slotOccupancy.map((slot) => (
                  <div
                    key={slot.timeSlot}
                    className="border border-slate-200 rounded-lg p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                          {slot.timeSlot}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <StatusLabel status={slot.demandLevel} />
                      </div>
                      <div className="text-right font-mono text-xs text-slate-700 tabular-nums">
                        {slot.bookedTables}/{slot.operationalTables} tables · {slot.totalGuests} guests ({slot.utilizationPercent}%)
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          slot.demandLevel === 'Busy'
                            ? 'bg-rose-600'
                            : slot.demandLevel === 'Moderate'
                              ? 'bg-amber-500'
                              : 'bg-teal-600'
                        }`}
                        style={{ width: `${Math.min(100, slot.utilizationPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-base font-semibold text-slate-900">
                  Live Table Status Breakdown
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current state across all dining zones
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                      <th className="py-2.5 px-4">ID</th>
                      <th className="py-2.5 px-4">Table</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4 text-right">Seats</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {data.tables.map((t) => (
                      <tr key={t.tableId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                          {t.tableId}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          Table #{t.tableNumber}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{t.location}</td>
                        <td className="py-2.5 px-4 font-mono text-right tabular-nums text-slate-700">
                          {t.seatingCapacity}
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusLabel status={t.currentStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
