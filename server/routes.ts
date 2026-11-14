import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  DomainError,
  addWaitingListEntry,
  calculateEstimatedWaitMinutes,
  checkAvailability,
  createCustomer,
  createReservation,
  createTable,
  deleteCustomer,
  deleteTable,
  deleteWaitingListEntry,
  generateReport,
  getBookingRules,
  getCustomerHistory,
  getDashboardData,
  getOccupancySummary,
  getReservationById,
  listCustomers,
  listReservations,
  listTables,
  listWaitingList,
  releaseTableAndMatchNext,
  updateBookingRules,
  updateCustomer,
  updateReservation,
  updateReservationStatus,
  updateTable,
  updateWaitingListStatus,
} from './service.ts';
import type { ReservationStatus, TableStatus, WaitingStatus } from './types.ts';

export const apiRouter = Router();

function asyncHandler(fn: (req: Request, res: Response) => Promise<void> | void) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

apiRouter.get(
  '/health',
  asyncHandler((_req, res) => {
    res.json({ ok: true });
  })
);

apiRouter.get(
  '/dashboard',
  asyncHandler((req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    res.json(getDashboardData(date));
  })
);

apiRouter.get(
  '/rules',
  asyncHandler((_req, res) => {
    res.json(getBookingRules());
  })
);

apiRouter.put(
  '/rules',
  asyncHandler((req, res) => {
    res.json(updateBookingRules(req.body ?? {}));
  })
);

// Tables
apiRouter.get(
  '/tables',
  asyncHandler((req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(listTables(status));
  })
);

apiRouter.post(
  '/tables',
  asyncHandler((req, res) => {
    const created = createTable(req.body ?? {});
    res.status(201).json(created);
  })
);

apiRouter.put(
  '/tables/:tableId',
  asyncHandler((req, res) => {
    const updated = updateTable(String(req.params.tableId), req.body ?? {});
    res.json(updated);
  })
);

apiRouter.patch(
  '/tables/:tableId/status',
  asyncHandler((req, res) => {
    const currentStatus = req.body?.status as TableStatus;
    const updated = updateTable(String(req.params.tableId), { currentStatus });
    res.json(updated);
  })
);

apiRouter.post(
  '/tables/:tableId/release',
  asyncHandler((req, res) => {
    const result = releaseTableAndMatchNext(String(req.params.tableId));
    res.json(result);
  })
);

apiRouter.delete(
  '/tables/:tableId',
  asyncHandler((req, res) => {
    deleteTable(String(req.params.tableId));
    res.json({ deleted: true, tableId: req.params.tableId });
  })
);

// Customers
apiRouter.get(
  '/customers',
  asyncHandler((req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    res.json(listCustomers(search));
  })
);

apiRouter.post(
  '/customers',
  asyncHandler((req, res) => {
    const created = createCustomer(req.body ?? {});
    res.status(201).json(created);
  })
);

apiRouter.put(
  '/customers/:customerId',
  asyncHandler((req, res) => {
    const updated = updateCustomer(String(req.params.customerId), req.body ?? {});
    res.json(updated);
  })
);

apiRouter.get(
  '/customers/:customerId/history',
  asyncHandler((req, res) => {
    res.json(getCustomerHistory(String(req.params.customerId)));
  })
);

apiRouter.delete(
  '/customers/:customerId',
  asyncHandler((req, res) => {
    deleteCustomer(String(req.params.customerId));
    res.json({ deleted: true, customerId: req.params.customerId });
  })
);

// Availability & Reservations
apiRouter.get(
  '/availability',
  asyncHandler((req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const timeSlot = typeof req.query.timeSlot === 'string' ? req.query.timeSlot : '';
    const partySize = Number(req.query.partySize);
    const excludeId =
      typeof req.query.excludeReservationId === 'string' ? req.query.excludeReservationId : undefined;
    res.json(checkAvailability(date, timeSlot, partySize, excludeId));
  })
);

apiRouter.get(
  '/reservations',
  asyncHandler((req, res) => {
    const date = typeof req.query.date === 'string' && req.query.date ? req.query.date : undefined;
    const timeSlot = typeof req.query.timeSlot === 'string' ? req.query.timeSlot : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    res.json(listReservations({ date, timeSlot, status, search, customerId }));
  })
);

apiRouter.get(
  '/reservations/:reservationId',
  asyncHandler((req, res) => {
    res.json(getReservationById(String(req.params.reservationId)));
  })
);

apiRouter.post(
  '/reservations',
  asyncHandler((req, res) => {
    const created = createReservation(req.body ?? {});
    res.status(201).json(created);
  })
);

apiRouter.put(
  '/reservations/:reservationId',
  asyncHandler((req, res) => {
    const updated = updateReservation(String(req.params.reservationId), req.body ?? {});
    res.json(updated);
  })
);

apiRouter.patch(
  '/reservations/:reservationId/status',
  asyncHandler((req, res) => {
    const status = req.body?.status as ReservationStatus;
    const result = updateReservationStatus(String(req.params.reservationId), status);
    res.json(result);
  })
);

// Waiting List
apiRouter.get(
  '/waiting-list',
  asyncHandler((req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const includeAll = req.query.includeAll === 'true';
    res.json(listWaitingList({ status, includeAll }));
  })
);

apiRouter.get(
  '/waiting-list/estimate',
  asyncHandler((req, res) => {
    const partySize = Number(req.query.partySize);
    res.json(calculateEstimatedWaitMinutes(partySize));
  })
);

apiRouter.post(
  '/waiting-list',
  asyncHandler((req, res) => {
    const created = addWaitingListEntry(req.body ?? {});
    res.status(201).json(created);
  })
);

apiRouter.patch(
  '/waiting-list/:entryId/status',
  asyncHandler((req, res) => {
    const status = req.body?.status as WaitingStatus;
    const result = updateWaitingListStatus(String(req.params.entryId), status);
    res.json(result);
  })
);

apiRouter.delete(
  '/waiting-list/:entryId',
  asyncHandler((req, res) => {
    deleteWaitingListEntry(String(req.params.entryId));
    res.json({ deleted: true, entryId: req.params.entryId });
  })
);

// Occupancy & Reports
apiRouter.get(
  '/occupancy',
  asyncHandler((req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    res.json(getOccupancySummary(date));
  })
);

apiRouter.get(
  '/reports',
  asyncHandler((req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : 'daily';
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    const customerId = typeof req.query.customerId === 'string' ? req.query.customerId : undefined;
    res.json(generateReport(type, { date, customerId }));
  })
);

apiRouter.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'API endpoint not found.',
    code: 'NOT_FOUND',
  });
});

apiRouter.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DomainError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});
