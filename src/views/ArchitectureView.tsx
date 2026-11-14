import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { BookingRulesConfig } from '../types';

export function ArchitectureView({
  onNotify,
  onRulesUpdated,
}: {
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onRulesUpdated: () => void;
}) {
  const [rules, setRules] = useState<BookingRulesConfig | null>(null);
  const [avgDining, setAvgDining] = useState(20);
  const [turnoverBuffer, setTurnoverBuffer] = useState(10);
  const [maxPartySize, setMaxPartySize] = useState(8);
  const [slotsText, setSlotsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getRules().then((r) => {
      setRules(r);
      setAvgDining(r.avgDiningMinutes);
      setTurnoverBuffer(r.turnoverBufferMinutes);
      setMaxPartySize(r.maxPartySize);
      setSlotsText(r.timeSlots.join(', '));
    });
  }, []);

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const timeSlots = slotsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await api.updateRules({
        avgDiningMinutes: avgDining,
        turnoverBufferMinutes: turnoverBuffer,
        maxPartySize,
        timeSlots,
      });
      setRules(updated);
      setSlotsText(updated.timeSlots.join(', '));
      onNotify('success', 'Booking rules updated', 'Wait-time estimation and slot validation updated.');
      onRulesUpdated();
    } catch (err) {
      onNotify('error', 'Invalid rule configuration', err instanceof ApiError ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Academic Java Reference vs. Full-Stack Web Implementation
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Faithful translation of the project report specifications into a persistent Node.js + React + SQLite web system.
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                <th className="py-2.5 px-3">Layer / Concern</th>
                <th className="py-2.5 px-3">Academic Java CLI Design (PDF)</th>
                <th className="py-2.5 px-3">This Web Application (Node.js + React)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">Presentation</td>
                <td className="py-2.5 px-3">
                  Console menu loop (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Main.java</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Scanner</code>)
                </td>
                <td className="py-2.5 px-3">Responsive React + TypeScript + Tailwind dashboard</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">Service &amp; Rules</td>
                <td className="py-2.5 px-3">
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">RestaurantManager</code> &amp;{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">BookingRulesConfig</code>
                </td>
                <td className="py-2.5 px-3">
                  Express REST API +{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">server/service.ts</code>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">Persistence</td>
                <td className="py-2.5 px-3">
                  In-memory <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">LinkedHashMap</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">ArrayList</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">LinkedList</code>
                </td>
                <td className="py-2.5 px-3">Persistent SQLite relational schema (Figure 9.1 PK/FK)</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">Exceptions</td>
                <td className="py-2.5 px-3">
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">InvalidInputException</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">TableNotAvailableException</code>,{' '}
                  <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">ReservationException</code>
                </td>
                <td className="py-2.5 px-3">Typed HTTP 400 / 409 domain errors with UI notifications</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-900">Future Extensions (Ch. 16)</td>
                <td className="py-2.5 px-3">Automated SMS/Email gateways &amp; multi-week forecasting</td>
                <td className="py-2.5 px-3">Not simulated — deferred per report scope</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
          <p className="font-semibold text-slate-900">Implemented Core Algorithms (Chapter 10)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Best-Fit Allocation:</strong> Filters operational tables (
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">status != MAINTENANCE</code>,{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">seatingCapacity &gt;= partySize</code>,
              unbooked in <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">(date, slot)</code>) sorted
              ascending by capacity then table number.
            </li>
            <li>
              <strong>Double-Booking Guard:</strong> Prevents duplicate active (
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">CONFIRMED</code> /{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">SEATED</code>) reservations for the same
              normalized 10–12 digit phone number in the same{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">(date, timeSlot)</code>.
            </li>
            <li>
              <strong>FIFO Queue Matching:</strong> Scans{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">WAITING</code> entries ordered by{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">arrivalTime</code> and marks the earliest
              party with{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                partySize &lt;= freedTable.seatingCapacity
              </code>{' '}
              as <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">READY_TO_SEAT</code>.
            </li>
            <li>
              <strong>Rule-Based Wait Estimate:</strong>{' '}
              <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                ceil((aheadCount + 1) / capableTables) * ((avgDining + turnoverBuffer) / 2)
              </code>
            </li>
          </ul>
        </div>
      </section>

      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Configured Booking &amp; Turnover Rules
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Persisted in SQLite (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">booking_rules</code>) and
          used live by wait estimation and slot checks.
        </p>

        {rules && (
          <form onSubmit={handleSaveRules} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="rule-dining" className="block text-xs font-medium text-slate-700 mb-1">
                  Avg Dining Duration (min)
                </label>
                <input
                  id="rule-dining"
                  type="number"
                  min={5}
                  value={avgDining}
                  onChange={(e) => setAvgDining(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
              <div>
                <label htmlFor="rule-buffer" className="block text-xs font-medium text-slate-700 mb-1">
                  Turnover Buffer (min)
                </label>
                <input
                  id="rule-buffer"
                  type="number"
                  min={0}
                  value={turnoverBuffer}
                  onChange={(e) => setTurnoverBuffer(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="rule-max-party" className="block text-xs font-medium text-slate-700 mb-1">
                Max Party Size Rule
              </label>
              <input
                id="rule-max-party"
                type="number"
                min={1}
                max={30}
                value={maxPartySize}
                onChange={(e) => setMaxPartySize(Number(e.target.value))}
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label htmlFor="rule-slots" className="block text-xs font-medium text-slate-700 mb-1">
                Service Time Slots (comma-separated)
              </label>
              <textarea
                id="rule-slots"
                rows={3}
                value={slotsText}
                onChange={(e) => setSlotsText(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{saving ? 'Saving...' : 'Save Rule Configuration'}</span>
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
