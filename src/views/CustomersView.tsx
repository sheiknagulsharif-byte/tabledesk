import { Edit2, History, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusLabel } from '../components/StatusLabel';
import { Customer, Reservation, WaitingListEntry } from '../types';

interface CustomersViewProps {
  refreshTrigger: number;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message?: string) => void;
  onDataChanged: () => void;
  onViewSlip: (res: Reservation) => void;
}

export function CustomersView({
  refreshTrigger,
  onNotify,
  onDataChanged,
  onViewSlip,
}: CustomersViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<{
    customer: Customer;
    reservations: Reservation[];
    waitingListEntries: WaitingListEntry[];
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const list = await api.getCustomers(search.trim() || undefined);
      setCustomers(list);
      if (list.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(list[0].customerId);
      }
    } catch (err) {
      onNotify('error', 'Failed to load customers', err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, [search, refreshTrigger]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setHistoryData(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    api
      .getCustomerHistory(selectedCustomerId)
      .then((res) => {
        if (!cancelled) setHistoryData(res);
      })
      .catch(() => {
        if (!cancelled) setHistoryData(null);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, refreshTrigger]);

  function openAddModal() {
    setEditingCustomer(null);
    setName('');
    setPhoneNumber('');
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(c: Customer) {
    setEditingCustomer(c);
    setName(c.name);
    setPhoneNumber(c.phoneNumber);
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.customerId, { name, phoneNumber });
        onNotify('success', 'Customer updated', `${name} (${phoneNumber}) saved.`);
      } else {
        const created = await api.createCustomer({ name, phoneNumber });
        onNotify('success', 'Customer added', `${created.customerId} — ${created.name} created.`);
        setSelectedCustomerId(created.customerId);
      }
      setModalOpen(false);
      await loadCustomers();
      onDataChanged();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name, phone, or ID..."
              aria-label="Search customers"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 w-fit"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add Customer</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-slate-900">No customers found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try a different search term or register a new customer.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4 text-right">Bookings</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {customers.map((c) => {
                    const selected = selectedCustomerId === c.customerId;
                    return (
                      <tr
                        key={c.customerId}
                        onClick={() => setSelectedCustomerId(c.customerId)}
                        className={`cursor-pointer transition-colors ${
                          selected ? 'bg-teal-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {c.customerId}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {c.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {c.phoneNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700 text-right tabular-nums whitespace-nowrap">
                          {c.reservationCount ?? 0} res · {c.waitingCount ?? 0} wl
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div
                            className="inline-flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedCustomerId(c.customerId)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
                            >
                              <History className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>History</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              aria-label={`Edit ${c.name}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              aria-label={`Delete ${c.name}`}
                              className="p-1.5 text-rose-600 hover:text-rose-800 border border-rose-200 rounded-md hover:bg-rose-50"
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
        </div>
      </div>

      {/* Customer History Panel */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
        {historyLoading ? (
          <div className="space-y-3">
            <div className="h-6 bg-slate-100 rounded w-1/2 animate-pulse" />
            <div className="h-24 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : !historyData ? (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-slate-900">Select a customer</p>
            <p className="text-xs text-slate-500 mt-1">
              Click any row on the left to inspect their reservation and waiting-list history.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="pb-4 border-b border-slate-200 flex items-start justify-between">
              <div>
                <p className="text-xs font-mono text-slate-500">{historyData.customer.customerId}</p>
                <h2 className="text-lg font-semibold text-slate-900 mt-0.5">
                  {historyData.customer.name}
                </h2>
                <p className="text-sm font-mono text-slate-600 tabular-nums mt-0.5">
                  {historyData.customer.phoneNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openEditModal(historyData.customer)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
              >
                Edit Profile
              </button>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                Reservation History ({historyData.reservations.length})
              </h3>
              {historyData.reservations.length === 0 ? (
                <p className="text-xs text-slate-500">No reservations recorded for this guest.</p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {historyData.reservations.map((r) => (
                    <li
                      key={r.reservationId}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-semibold text-slate-900">
                          {r.reservationId} · {r.confirmationCode}
                        </p>
                        <p className="text-slate-600 font-mono tabular-nums mt-0.5">
                          {r.bookingDate} at {r.timeSlot} · Party {r.partySize} · Table #{r.tableNumber}
                        </p>
                      </div>
                      <div className="text-right space-y-1 shrink-0">
                        <div>
                          <StatusLabel status={r.status} />
                        </div>
                        <button
                          type="button"
                          onClick={() => onViewSlip(r)}
                          className="text-xs font-medium text-teal-700 hover:underline"
                        >
                          View Slip
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                Waiting List History ({historyData.waitingListEntries.length})
              </h3>
              {historyData.waitingListEntries.length === 0 ? (
                <p className="text-xs text-slate-500">No waiting-list entries for this guest.</p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {historyData.waitingListEntries.map((w) => (
                    <li
                      key={w.entryId}
                      className="p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-semibold text-slate-900">{w.entryId}</p>
                        <p className="text-slate-600 font-mono tabular-nums mt-0.5">
                          Arrival {w.arrivalTime} · Party {w.partySize} · Est. {w.estimatedWaitMinutes} min
                        </p>
                      </div>
                      <StatusLabel status={w.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 id="customer-modal-title" className="text-base font-semibold text-slate-900">
                {editingCustomer ? `Edit ${editingCustomer.customerId}` : 'Add Customer'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label htmlFor="c-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="c-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ananya Rao"
                  required
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="c-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number (10–12 digits)
                </label>
                <input
                  id="c-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 9848012345"
                  required
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
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
                  {saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Customer"
        description={
          deleteTarget
            ? `Delete customer ${deleteTarget.name} (${deleteTarget.customerId})? Customers with existing reservations or waiting-list records cannot be deleted.`
            : ''
        }
        confirmLabel="Delete Customer"
        destructive
        busy={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            await api.deleteCustomer(deleteTarget.customerId);
            onNotify('success', 'Customer deleted', `${deleteTarget.name} removed.`);
            if (selectedCustomerId === deleteTarget.customerId) {
              setSelectedCustomerId(null);
            }
            setDeleteTarget(null);
            await loadCustomers();
            onDataChanged();
          } catch (err) {
            onNotify('error', 'Cannot delete customer', err instanceof ApiError ? err.message : undefined);
            setDeleteTarget(null);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
