import {
  Activity,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Clock,
  LayoutDashboard,
  Menu,
  Plus,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, getTodayIsoDate } from './api';
import { NewReservationModal, ReservationPrefill } from './components/NewReservationModal';
import { ReservationSlipModal } from './components/ReservationSlipModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ActiveTab, BookingRulesConfig, DashboardPayload, Reservation } from './types';
import { ArchitectureView } from './views/ArchitectureView';
import { CustomersView } from './views/CustomersView';
import { DashboardView } from './views/DashboardView';
import { OccupancyView } from './views/OccupancyView';
import { ReportsView } from './views/ReportsView';
import { ReservationsView } from './views/ReservationsView';
import { TablesView } from './views/TablesView';
import { WaitingListView } from './views/WaitingListView';

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; Icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'tables', label: 'Tables', Icon: UtensilsCrossed },
  { id: 'reservations', label: 'Reservations', Icon: CalendarCheck },
  { id: 'waiting-list', label: 'Waiting List', Icon: Clock },
  { id: 'customers', label: 'Customers', Icon: Users },
  { id: 'occupancy', label: 'Occupancy', Icon: Activity },
  { id: 'reports', label: 'Reports', Icon: BarChart3 },
  { id: 'architecture', label: 'Rules & Spec', Icon: BookOpen },
];

const DEFAULT_RULES: BookingRulesConfig = {
  avgDiningMinutes: 20,
  turnoverBufferMinutes: 10,
  maxPartySize: 8,
  timeSlots: ['12:00 PM', '01:30 PM', '06:30 PM', '08:00 PM', '09:30 PM'],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [serviceDate, setServiceDate] = useState(getTodayIsoDate());
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [rules, setRules] = useState<BookingRulesConfig>(DEFAULT_RULES);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [reservationPrefill, setReservationPrefill] = useState<ReservationPrefill | null>(null);
  const [slipReservation, setSlipReservation] = useState<Reservation | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback(
    (type: 'success' | 'error' | 'info', title: string, message?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadDashboardAndRules = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [dash, rulesCfg] = await Promise.all([
        api.getDashboard(serviceDate),
        api.getRules(),
      ]);
      setDashboardData(dash);
      setRules(rulesCfg);
    } catch (err) {
      notify('error', 'Failed to sync dashboard', err instanceof Error ? err.message : undefined);
    } finally {
      setDashboardLoading(false);
    }
  }, [serviceDate, notify]);

  useEffect(() => {
    loadDashboardAndRules();
  }, [loadDashboardAndRules, refreshTrigger]);

  function triggerGlobalRefresh() {
    setRefreshTrigger((n) => n + 1);
  }

  function handleSelectTab(tab: ActiveTab) {
    setActiveTab(tab);
    setMobileNavOpen(false);
  }

  function handleOpenNewReservation(prefill?: ReservationPrefill) {
    setEditingReservation(null);
    setReservationPrefill(prefill ?? null);
    setReservationModalOpen(true);
  }

  function handleEditReservation(res: Reservation) {
    setEditingReservation(res);
    setReservationPrefill(null);
    setReservationModalOpen(true);
  }

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            TableDesk
          </span>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
          <p className="font-medium text-slate-700">Restaurant Operations</p>
          <p className="mt-0.5">Reservations &amp; Waiting List</p>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-white border-r border-slate-200 flex flex-col z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900">
                TableDesk
              </span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectTab(id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      active
                        ? 'bg-teal-50 text-teal-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline">TableDesk</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-slate-900 truncate">
                {currentNav.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeTab === 'dashboard' && (
              <input
                type="date"
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                aria-label="Dashboard service date"
                className="hidden sm:block px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            )}
            <button
              type="button"
              onClick={() => handleOpenNewReservation()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Reservation</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={dashboardLoading}
              onNavigate={handleSelectTab}
              onViewSlip={(res) => setSlipReservation(res)}
              onOpenNewReservation={() => handleOpenNewReservation()}
            />
          )}

          {activeTab === 'tables' && (
            <TablesView onNotify={notify} onDataChanged={triggerGlobalRefresh} />
          )}

          {activeTab === 'reservations' && (
            <ReservationsView
              refreshTrigger={refreshTrigger}
              rules={rules}
              onNotify={notify}
              onDataChanged={triggerGlobalRefresh}
              onOpenNewReservation={handleOpenNewReservation}
              onEditReservation={handleEditReservation}
              onViewSlip={(res) => setSlipReservation(res)}
              onGoToWaitingList={() => handleSelectTab('waiting-list')}
            />
          )}

          {activeTab === 'waiting-list' && (
            <WaitingListView
              refreshTrigger={refreshTrigger}
              onNotify={notify}
              onDataChanged={triggerGlobalRefresh}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              refreshTrigger={refreshTrigger}
              onNotify={notify}
              onDataChanged={triggerGlobalRefresh}
              onViewSlip={(res) => setSlipReservation(res)}
            />
          )}

          {activeTab === 'occupancy' && (
            <OccupancyView refreshTrigger={refreshTrigger} onNotify={notify} />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              refreshTrigger={refreshTrigger}
              onNotify={notify}
              onViewSlip={(res) => setSlipReservation(res)}
            />
          )}

          {activeTab === 'architecture' && (
            <ArchitectureView onNotify={notify} onRulesUpdated={triggerGlobalRefresh} />
          )}
        </main>
      </div>

      <NewReservationModal
        open={reservationModalOpen}
        editingReservation={editingReservation}
        prefill={reservationPrefill}
        rules={rules}
        defaultDate={serviceDate}
        onClose={() => {
          setReservationModalOpen(false);
          setEditingReservation(null);
          setReservationPrefill(null);
        }}
        onSuccess={(reservation, message) => {
          notify('success', editingReservation ? 'Reservation updated' : 'Reservation confirmed', message);
          setSlipReservation(reservation);
          triggerGlobalRefresh();
        }}
        onAddedToWaitlist={(message) => {
          notify('info', 'Added to Waiting List', message);
          setActiveTab('waiting-list');
          triggerGlobalRefresh();
        }}
      />

      <ReservationSlipModal
        reservation={slipReservation}
        onClose={() => setSlipReservation(null)}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
