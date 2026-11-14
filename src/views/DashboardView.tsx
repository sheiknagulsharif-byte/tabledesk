import { ArrowRight, CalendarCheck, FileText } from 'lucide-react';
import { StatusLabel } from '../components/StatusLabel';
import { ActiveTab, DashboardPayload, Reservation } from '../types';

interface DashboardViewProps {
  data: DashboardPayload | null;
  loading: boolean;
  onNavigate: (tab: ActiveTab) => void;
  onViewSlip: (reservation: Reservation) => void;
  onOpenNewReservation: () => void;
}

export function DashboardView({
  data,
  loading,
  onNavigate,
  onViewSlip,
  onOpenNewReservation,
}: DashboardViewProps) {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const { stats, tables, slotOccupancy, recentReservations, waitingList } = data;

  const kpis = [
    { label: 'Total Tables', value: stats.totalTables, sub: `${stats.maintenanceTables} maintenance` },
    { label: 'Available Tables', value: stats.availableTables, sub: 'Ready for seating' },
    { label: 'Occupied Tables', value: stats.occupiedTables, sub: `${stats.reservedTables} reserved` },
    { label: 'Total Reservations', value: stats.totalReservations, sub: 'All-time records' },
    { label: 'Waiting Customers', value: stats.waitingCustomersCount, sub: `${stats.readyToSeatCount} ready to seat` },
    { label: "Today's Bookings", value: stats.todaysBookingsCount, sub: `${stats.todaysExpectedGuests} expected guests` },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section aria-label="Operational summary metrics" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between"
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="text-2xl font-display font-semibold text-slate-900 font-mono tabular-nums mt-2">
              {item.value}
            </p>
            <p className="text-xs text-slate-500 mt-1">{item.sub}</p>
          </div>
        ))}
      </section>

      {/* Main Split: Occupancy Overview + Live Floor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Time-Slot Occupancy</h2>
              <p className="text-xs text-slate-500 mt-0.5">Service utilization for {data.date}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('occupancy')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>Full Monitor</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-3.5 flex-1">
            {slotOccupancy.map((slot) => (
              <div key={slot.timeSlot} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-900 tabular-nums">
                      {slot.timeSlot}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <StatusLabel status={slot.demandLevel} />
                  </div>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {slot.bookedTables}/{slot.operationalTables} tables ({slot.utilizationPercent}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Floor Table Overview</h2>
              <p className="text-xs text-slate-500 mt-0.5">Live table inventory and capacities</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('tables')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>Manage Tables</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {tables.map((t) => (
              <div
                key={t.tableId}
                className="border border-slate-200 rounded-lg p-3 flex flex-col justify-between bg-slate-50/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">
                    Table #{t.tableNumber}
                  </span>
                  <span className="text-xs font-mono text-slate-500">{t.tableId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                  <span className="font-mono tabular-nums">{t.seatingCapacity} seats</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{t.location}</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                  <StatusLabel status={t.currentStatus} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Reservations & Active Waiting List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Reservations</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest bookings across dining slots
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('reservations')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>All Reservations</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {recentReservations.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-900 mt-2">No reservations recorded</p>
              <p className="text-xs text-slate-500 mt-1">
                Create the first reservation to allocate a table.
              </p>
              <button
                type="button"
                onClick={onOpenNewReservation}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800"
              >
                New Reservation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-2.5 px-4">ID / Code</th>
                    <th className="py-2.5 px-4">Guest</th>
                    <th className="py-2.5 px-4">Date &amp; Slot</th>
                    <th className="py-2.5 px-4 text-right">Party</th>
                    <th className="py-2.5 px-4">Table</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentReservations.map((res) => (
                    <tr key={res.reservationId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{res.reservationId}</span>
                        <span className="text-slate-400 mx-1">·</span>
                        <span className="text-slate-600">{res.confirmationCode}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-slate-900">{res.customerName}</p>
                        <p className="text-xs font-mono text-slate-500 tabular-nums">
                          {res.customerPhone}
                        </p>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {res.bookingDate} · {res.timeSlot}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-900 text-right tabular-nums">
                        {res.partySize}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                        Table #{res.tableNumber}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <StatusLabel status={res.status} />
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewSlip(res)}
                          aria-label={`View confirmation slip for ${res.reservationId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                        >
                          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Active Waiting Queue</h2>
              <p className="text-xs text-slate-500 mt-0.5">FIFO arrival order</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('waiting-list')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              <span>Manage Queue</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {waitingList.length === 0 ? (
            <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-slate-900">No guests waiting</p>
              <p className="text-xs text-slate-500 mt-1">
                Walk-in overflow guests will appear here in arrival order.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {waitingList.map((entry) => (
                <li key={entry.entryId} className="px-5 py-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                      <span className="font-semibold text-slate-900">{entry.entryId}</span>
                      <span aria-hidden="true">·</span>
                      <span>Arrived {entry.arrivalTime}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                      {entry.customerName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                      Party of {entry.partySize} · Est. {entry.estimatedWaitMinutes} min
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusLabel status={entry.status} />
                    {entry.matchedTableNumber && (
                      <p className="text-xs font-mono text-teal-700 mt-1">
                        Table #{entry.matchedTableNumber}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
