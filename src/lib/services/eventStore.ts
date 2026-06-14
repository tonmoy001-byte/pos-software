import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type EventAggregateType =
  | "Sale"
  | "Product"
  | "Customer"
  | "Supplier"
  | "Loan"
  | "Transaction"
  | "SecondHandRecord"
  | "DailyBalance"
  | "Store";

export type EventType =
  | "CREATED"
  | "UPDATED"
  | "DELETED"
  | "STATUS_CHANGED"
  | "SALE_CREATED"
  | "SALE_ITEM_ADDED"
  | "PAYMENT_RECEIVED"
  | "REFUND_PROCESSED"
  | "CANCELLED"
  | "EMI_INSTALLMENT_PAID"
  | "EMI_EARLY_PAYOFF";

export interface EventPayload {
  [key: string]: any;
}

export interface EventMetadata {
  userId?: string;
  storeId?: string;
  reason?: string;
  previousState?: EventPayload;
  newState?: EventPayload;
}

export interface EventStoreData {
  aggregateType: EventAggregateType;
  aggregateId: string;
  type: EventType;
  payload: EventPayload;
  metadata?: EventMetadata;
  userId?: string;
  storeId: string;
}

export class EventStore {
  async append(data: EventStoreData, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.event.create({
      data: {
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        type: data.type,
        payload: JSON.stringify(data.payload),
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        userId: data.userId,
        storeId: data.storeId,
      },
    });
  }

  async getEventsForAggregate(
    aggregateType: EventAggregateType,
    aggregateId: string
  ) {
    return prisma.event.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getEventsByStore(
    storeId: string,
    options?: {
      aggregateType?: EventAggregateType;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const where: any = { storeId };

    if (options?.aggregateType) {
      where.aggregateType = options.aggregateType;
    }

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    return prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });
  }

  async getLatestEvent(
    aggregateType: EventAggregateType,
    aggregateId: string
  ): Promise<any | null> {
    return prisma.event.findFirst({
      where: { aggregateType, aggregateId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const eventStore = new EventStore();

export function calculateProfit(salePrice: number, costPrice: number): number {
  const profit = salePrice - costPrice;
  return profit;
}

export function applyEventToState(
  currentState: EventPayload,
  event: any
): EventPayload {
  const payload = typeof event.payload === "string"
    ? JSON.parse(event.payload)
    : event.payload;

  const metadata = event.metadata
    ? (typeof event.metadata === "string"
      ? JSON.parse(event.metadata)
      : event.metadata)
    : {};

  switch (event.type) {
    case "CREATED":
    case "SALE_CREATED":
      return { ...currentState, ...payload };

    case "UPDATED":
    case "STATUS_CHANGED":
      return { ...currentState, ...metadata.newState };

    case "DELETED":
    case "CANCELLED":
      return { ...currentState, ...metadata.previousState, deletedAt: event.createdAt };

    case "REFUND_PROCESSED":
      return {
        ...currentState,
        refundedAmount: (currentState.refundedAmount || 0) + payload.amount,
        status: "REFUNDED"
      };

    default:
      return currentState;
  }
}

export async function replayEvents(
  aggregateType: EventAggregateType,
  aggregateId: string
): Promise<EventPayload> {
  const events = await eventStore.getEventsForAggregate(aggregateType, aggregateId);

  let state: EventPayload = {};
  for (const event of events) {
    state = applyEventToState(state, event);
  }

  return state;
}