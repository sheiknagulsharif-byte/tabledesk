import { ArrowRightLeft, Edit2, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusLabel } from '../components/StatusLabel';
import { RestaurantTable, TableStatus, WaitingListEntry } from '../types';

interface TablesViewProps {
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onDataChanged: () => void;
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'All Tables' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
];

export function TablesView({ onNotify, onDataChanged }: TablesViewProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);

  const [tableId, setTableId] = useState('');
  const [tableNumber, setTableNumber] = useState<number>(10);
  const [seatingCapacity, setSeatingCapacity] = useState<number>(4);
  const [location, setLocation] = useState('Main Hall');
  const [currentStatus, setCurrentStatus] = useState<TableStatus>('AVAILABLE');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  async function loadTables() {
    setLoading(true);
    try {
      const list = await api.getTables(filter);
      setTables(list);
    } catch (err) {
      onNotify('error', 'Failed to load tables', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTables();
  }, [filter]);

  function openAddModal() {
    setEditingTable(null);
    setFormError(null);
    const maxNum = tables.reduce((m, t) => Math.max(m, t.tableNumber), 0);
    setTableId('');
    setTableNumber(maxNum + 1);
    setSeatingCapacity(4);
    setLocation('Main Hall');
    setCurrentStatus('AVAILABLE');
    setModalOpen(true);
  }

  function openEditModal(t: RestaurantTable) {
    setEditingTable(t);
    setFormError(null);
    setTableId(t.tableId);
    setTableNumber(t.tableNumber);
    setSeatingCapacity(t.seatingCapacity);
    setLocation(t.location);
    setCurrentStatus(t.currentStatus);
    setModalOpen(true);
  }

  async function handleSaveTable(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editingTable) {
        await api.updateTable(editingTable.tableId, {
          tableNumber,
          seatingCapacity,
          location,
          currentStatus,
        });
        onNotify('success', 'Table updated', `${editingTable.tableId} (Table #${tableNumber}) saved.`);
      } else {
        const created = await api.createTable({
          tableId: tableId.trim() || undefined,
          tableNumber,
          seatingCapacity,
          location,
          currentStatus,
        });
        onNotify('success', 'Table added', `${created.tableId} (Table #${created.tableNumber}) created.`);
      }
      setModalOpen(false);
      await loadTables();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save table.');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(t: RestaurantTable, nextStatus: TableStatus) {
    try {
      await api.updateTableStatus(t.tableId, nextStatus);
      onNotify('success', 'Status updated', `Table #${t.tableNumber} is now ${nextStatus}.`);
      await loadTables();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Status update rejected', err instanceof ApiError ? err.message : undefined);
    }
  }

  async function handleReleaseAndMatch(t: RestaurantTable) {
    setReleasingId(t.tableId);
    try {
      const result: { table: RestaurantTable; matchedEntry: WaitingListEntry | null } =
        await api.releaseTable(t.tableId);
      if (result.matchedEntry) {
        onNotify(
          'success',
          `Table #${t.tableNumber} matched to ${result.matchedEntry.customerName}`,
          `${result.matchedEntry.entryId} (Party of ${result.matchedEntry.partySize}) marked READY_TO_SEAT.`
        );
      } else {
        onNotify(
          'info',
          `Table #${t.tableNumber} released`,
          'Table is now AVAILABLE. No waiting guests match its seating capacity.'
        );
      }
      await loadTables();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Release failed', err instanceof ApiError ? err.message : undefined);
    } finally {
      setReleasingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteTable(deleteTarget.tableId);
      onNotify('success', 'Table deleted', `${deleteTarget.tableId} removed from inventory.`);
      setDeleteTarget(null);
      await loadTables();
      onDataChanged();
    } catch (err) {
      onNotify('error', 'Cannot delete table', err instanceof ApiError ? err.message : undefined);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filter === f.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 w-fit"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Table</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-slate-900">No tables match this filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Add a new table or switch the status filter above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Table ID</th>
                  <th className="py-3 px-4">Table Number</th>
                  <th className="py-3 px-4 text-right">Seating Capacity</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4">Change Status</th>
                  <th className="py-3 px-4 text-right">Allocation &amp; Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tables.map((t) => (
                  <tr key={t.tableId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                      {t.tableId}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      Table #{t.tableNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 text-right tabular-nums whitespace-nowrap">
                      {t.seatingCapacity} seats
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{t.location}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusLabel status={t.currentStatus} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        aria-label={`Change status for Table #${t.tableNumber}`}
                        value={t.currentStatus}
                        onChange={(e) => handleStatusChange(t, e.target.value as TableStatus)}
                        className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                      >
                        <option value="AVAILABLE">AVAILABLE</option>
                        <option value="RESERVED">RESERVED</option>
                        <option value="OCCUPIED">OCCUPIED</option>
                        <option value="MAINTENANCE">MAINTENANCE</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        {t.currentStatus !== 'MAINTENANCE' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseAndMatch(t)}
                            disabled={releasingId === t.tableId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors disabled:opacity-50"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {releasingId === t.tableId ? 'Matching...' : 'Release & Match'}
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(t)}
                          aria-label={`Edit Table #${t.tableNumber}`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          aria-label={`Delete Table #${t.tableNumber}`}
                          className="p-1.5 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-md hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Table Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 id="table-modal-title" className="text-base font-semibold text-slate-900">
                {editingTable ? `Edit ${editingTable.tableId}` : 'Add Restaurant Table'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close table modal"
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="mt-4 space-y-4">
              {!editingTable && (
                <div>
                  <label htmlFor="t-id" className="block text-xs font-medium text-slate-700 mb-1">
                    Table ID (optional — auto-generated if blank)
                  </label>
                  <input
                    id="t-id"
                    type="text"
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    placeholder="e.g. T-110"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="t-num" className="block text-xs font-medium text-slate-700 mb-1">
                    Table Number
                  </label>
                  <input
                    id="t-num"
                    type="number"
                    min={1}
                    value={tableNumber}
                    onChange={(e) => setTableNumber(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="t-cap" className="block text-xs font-medium text-slate-700 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    id="t-cap"
                    type="number"
                    min={1}
                    max={24}
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="t-loc" className="block text-xs font-medium text-slate-700 mb-1">
                    Location / Zone
                  </label>
                  <input
                    id="t-loc"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Window, Main Hall, Patio..."
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="t-status" className="block text-xs font-medium text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    id="t-status"
                    value={currentStatus}
                    onChange={(e) => setCurrentStatus(e.target.value as TableStatus)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="RESERVED">RESERVED</option>
                    <option value="OCCUPIED">OCCUPIED</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>

              {formError && (
                <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTable ? 'Update Table' : 'Add Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Table"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.tableId} (Table #${deleteTarget.tableNumber})? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete Table"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
