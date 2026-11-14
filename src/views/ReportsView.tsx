import { Download, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, getTodayIsoDate } from '../api';
import { StatusLabel } from '../components/StatusLabel';
import { Customer, Reservation, RestaurantTable, SlotOccupancy, WaitingListEntry } from '../types';

type ReportTab = 'daily' | 'history' | 'waiting-list' | 'occupancy' | 'customer';

const REPORT_TABS: Array<{ id: ReportTab; label: string }> = [
  { id: 'daily', label: 'Daily Reservation Report' },
  { id: 'history', label: 'Reservation History' },
  { id: 'waiting-list', label: 'Waiting-List Report' },
  { id: 'occupancy', label: 'Table Occupancy Report' },
  { id: 'customer', label: 'Customer Booking Details' },
];

export function ReportsView({
  refreshTrigger,
  onNotify,
  onViewSlip,
}: {
  refreshTrigger: number;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onViewSlip: (res: Reservation) => void;
}) {
  const [activeReport, setActiveReport] = useState<ReportTab>('daily');
  const [date, setDate] = useState(getTodayIsoDate());
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCustomers()
      .then((list) => {
        setCustomers(list);
        if (list.length === 0) {
          setSelectedCustomerId('');
        } else if (!selectedCustomerId || !list.some((c) => c.customerId === selectedCustomerId)) {
          setSelectedCustomerId(list[0].customerId);
        }
      })
      .catch(() => {});
  }, [refreshTrigger]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getReport<Record<string, unknown>>(activeReport, {
        date,
        customerId: activeReport === 'customer' ? selectedCustomerId || undefined : undefined,
      })
      .then((res) => {
        if (!cancelled) setReportData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          onNotify('error', 'Failed to generate report', err instanceof Error ? err.message : undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeReport, date, selectedCustomerId, refreshTrigger]);

  function exportCsv() {
    if (!reportData) return;
    let rows: Array<Record<string, unknown>> = [];
    if (Array.isArray(reportData.rows)) {
      rows = reportData.rows as Array<Record<string, unknown>>;
    } else if (
      Array.isArray(reportData.reservations) &&
      reportData.reservations.length > 0
    ) {
      rows = reportData.reservations as Array<Record<string, unknown>>;
    } else if (
      Array.isArray(reportData.waitingListEntries) &&
      reportData.waitingListEntries.length > 0
    ) {
      rows = reportData.waitingListEntries as Array<Record<string, unknown>>;
    }
    if (rows.length === 0) {
      onNotify('info', 'No rows to export', 'The selected report has no tabular rows.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabledesk-${activeReport}-report-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('success', 'CSV exported', `Downloaded tabledesk-${activeReport}-report-${date}.csv.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveReport(t.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeReport === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {(activeReport === 'daily' || activeReport === 'occupancy') && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Report date"
              className="px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          )}

          {activeReport === 'customer' && (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              aria-label="Select customer for booking report"
              className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name} ({c.phoneNumber})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Download CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : !reportData ? null : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {activeReport === 'daily' && (
            <DailyAndHistoryTable
              title={`Daily Reservation Report (${String(reportData.date)})`}
              summary={reportData.summary as Record<string, number>}
              rows={(reportData.rows as Reservation[]) || []}
              onViewSlip={onViewSlip}
            />
          )}

          {activeReport === 'history' && (
            <DailyAndHistoryTable
              title="Complete Reservation History"
              summary={reportData.summary as Record<string, number>}
              rows={(reportData.rows as Reservation[]) || []}
              onViewSlip={onViewSlip}
            />
          )}

          {activeReport === 'waiting-list' && (
            <WaitingListReportTable
              summary={reportData.summary as Record<string, number>}
              rows={(reportData.rows as WaitingListEntry[]) || []}
            />
          )}

          {activeReport === 'occupancy' && (
            <OccupancyReportTable
              date={String(reportData.date)}
              slotOccupancy={(reportData.slotOccupancy as SlotOccupancy[]) || []}
              rows={
                (reportData.rows as Array<
                  RestaurantTable & { bookingsToday: number; guestsToday: number }
                >) || []
              }
            />
          )}

          {activeReport === 'customer' && (
            <CustomerReportSection
              customer={reportData.customer as Customer | undefined}
              reservations={(reportData.reservations as Reservation[]) || []}
              waitingListEntries={(reportData.waitingListEntries as WaitingListEntry[]) || []}
              onViewSlip={onViewSlip}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DailyAndHistoryTable({
  title,
  summary,
  rows,
  onViewSlip,
}: {
  title: string;
  summary: Record<string, number>;
  rows: Reservation[];
  onViewSlip: (res: Reservation) => void;
}) {
  return (
    <div>
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
          {Object.entries(summary).map(([k, v]) => (
            <span key={k}>
              {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:{' '}
              <strong className="text-slate-900">{v}</strong>
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No reservation records for this selection.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-4">ID / Code</th>
                <th className="py-3 px-4">Guest</th>
                <th className="py-3 px-4">Date &amp; Slot</th>
                <th className="py-3 px-4 text-right">Party</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right no-print">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.map((r) => (
                <tr key={r.reservationId}>
                  <td className="py-2.5 px-4 font-mono text-xs whitespace-nowrap">
                    <span className="font-semibold text-slate-900">{r.reservationId}</span> ·{' '}
                    {r.confirmationCode}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    {r.customerName}{' '}
                    <span className="font-mono text-xs text-slate-500">({r.customerPhone})</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                    {r.bookingDate} · {r.timeSlot}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-right tabular-nums">{r.partySize}</td>
                  <td className="py-2.5 px-4 text-xs whitespace-nowrap">
                    Table #{r.tableNumber} ({r.tableLocation})
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <StatusLabel status={r.status} />
                  </td>
                  <td className="py-2.5 px-4 text-right no-print">
                    <button
                      type="button"
                      onClick={() => onViewSlip(r)}
                      className="text-xs font-medium text-teal-700 hover:underline"
                    >
                      View Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WaitingListReportTable({
  summary,
  rows,
}: {
  summary: Record<string, number>;
  rows: WaitingListEntry[];
}) {
  return (
    <div>
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">Waiting-List Queue Report</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-600 tabular-nums">
          <span>
            Total: <strong className="text-slate-900">{summary.totalEntries}</strong>
          </span>
          <span>
            Waiting: <strong className="text-slate-900">{summary.waitingCount}</strong>
          </span>
          <span>
            Ready: <strong className="text-slate-900">{summary.readyToSeatCount}</strong>
          </span>
          <span>
            Seated: <strong className="text-slate-900">{summary.seatedCount}</strong>
          </span>
          <span>
            Avg Est. Wait:{' '}
            <strong className="text-slate-900">{summary.averageEstimatedWaitMinutes} min</strong>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th className="py-3 px-4">Entry ID</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Arrival Time</th>
              <th className="py-3 px-4 text-right">Party</th>
              <th className="py-3 px-4 text-right">Est. Wait</th>
              <th className="py-3 px-4">Matched Table</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((w) => (
              <tr key={w.entryId}>
                <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                  {w.entryId}
                </td>
                <td className="py-2.5 px-4">
                  {w.customerName}{' '}
                  <span className="font-mono text-xs text-slate-500">({w.customerPhone})</span>
                </td>
                <td className="py-2.5 px-4 font-mono text-xs tabular-nums">{w.arrivalTime}</td>
                <td className="py-2.5 px-4 font-mono text-right tabular-nums">{w.partySize}</td>
                <td className="py-2.5 px-4 font-mono text-right tabular-nums">
                  {w.estimatedWaitMinutes} min
                </td>
                <td className="py-2.5 px-4 text-xs">
                  {w.matchedTableNumber ? `Table #${w.matchedTableNumber} (${w.matchedTableId})` : '—'}
                </td>
                <td className="py-2.5 px-4">
                  <StatusLabel status={w.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OccupancyReportTable({
  date,
  slotOccupancy,
  rows,
}: {
  date: string;
  slotOccupancy: SlotOccupancy[];
  rows: Array<RestaurantTable & { bookingsToday: number; guestsToday: number }>;
}) {
  return (
    <div className="divide-y divide-slate-200">
      <div className="px-5 py-4">
        <h3 className="text-base font-semibold text-slate-900">
          Table Occupancy Report ({date})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          {slotOccupancy.map((s) => (
            <div key={s.timeSlot} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
              <p className="font-mono text-xs font-semibold text-slate-900">{s.timeSlot}</p>
              <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-1">
                {s.bookedTables}/{s.operationalTables} ({s.utilizationPercent}%)
              </p>
              <div className="mt-1">
                <StatusLabel status={s.demandLevel} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <th className="py-3 px-4">Table ID</th>
              <th className="py-3 px-4">Table</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4 text-right">Capacity</th>
              <th className="py-3 px-4 text-right">Active Bookings ({date})</th>
              <th className="py-3 px-4 text-right">Expected Guests</th>
              <th className="py-3 px-4">Current Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {rows.map((t) => (
              <tr key={t.tableId}>
                <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                  {t.tableId}
                </td>
                <td className="py-2.5 px-4 font-medium text-slate-900">Table #{t.tableNumber}</td>
                <td className="py-2.5 px-4 text-slate-600">{t.location}</td>
                <td className="py-2.5 px-4 font-mono text-right tabular-nums">{t.seatingCapacity}</td>
                <td className="py-2.5 px-4 font-mono text-right tabular-nums">{t.bookingsToday}</td>
                <td className="py-2.5 px-4 font-mono text-right tabular-nums">{t.guestsToday}</td>
                <td className="py-2.5 px-4">
                  <StatusLabel status={t.currentStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerReportSection({
  customer,
  reservations,
  waitingListEntries,
  onViewSlip,
}: {
  customer?: Customer;
  reservations: Reservation[];
  waitingListEntries: WaitingListEntry[];
  onViewSlip: (res: Reservation) => void;
}) {
  if (!customer) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Select a customer to view their booking details report.
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-slate-500">{customer.customerId}</p>
          <h3 className="text-lg font-semibold text-slate-900">{customer.name}</h3>
          <p className="text-sm font-mono text-slate-600 tabular-nums">{customer.phoneNumber}</p>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
          <div>
            <span className="text-slate-500 block">Total Reservations</span>
            <strong className="text-base text-slate-900">{reservations.length}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Waiting List Entries</span>
            <strong className="text-base text-slate-900">{waitingListEntries.length}</strong>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-2">Customer Reservations</h4>
        {reservations.length === 0 ? (
          <p className="text-xs text-slate-500">No reservations found for this customer.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">ID / Code</th>
                  <th className="py-2.5 px-4">Date &amp; Slot</th>
                  <th className="py-2.5 px-4 text-right">Party</th>
                  <th className="py-2.5 px-4">Table</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right no-print">Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reservations.map((r) => (
                  <tr key={r.reservationId}>
                    <td className="py-2.5 px-4 font-mono text-xs">
                      {r.reservationId} · {r.confirmationCode}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs tabular-nums">
                      {r.bookingDate} · {r.timeSlot}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-right tabular-nums">{r.partySize}</td>
                    <td className="py-2.5 px-4 text-xs">
                      Table #{r.tableNumber} ({r.tableLocation})
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusLabel status={r.status} />
                    </td>
                    <td className="py-2.5 px-4 text-right no-print">
                      <button
                        type="button"
                        onClick={() => onViewSlip(r)}
                        className="text-xs font-medium text-teal-700 hover:underline"
                      >
                        View Slip
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-2">Customer Waiting-List History</h4>
        {waitingListEntries.length === 0 ? (
          <p className="text-xs text-slate-500">No waiting-list entries found for this customer.</p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-2.5 px-4">Entry ID</th>
                  <th className="py-2.5 px-4">Arrival Time</th>
                  <th className="py-2.5 px-4 text-right">Party</th>
                  <th className="py-2.5 px-4 text-right">Est. Wait</th>
                  <th className="py-2.5 px-4">Matched Table</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {waitingListEntries.map((w) => (
                  <tr key={w.entryId}>
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900">
                      {w.entryId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs tabular-nums">{w.arrivalTime}</td>
                    <td className="py-2.5 px-4 font-mono text-right tabular-nums">{w.partySize}</td>
                    <td className="py-2.5 px-4 font-mono text-right tabular-nums">
                      {w.estimatedWaitMinutes} min
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      {w.matchedTableNumber
                        ? `Table #${w.matchedTableNumber} (${w.matchedTableId})`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusLabel status={w.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
