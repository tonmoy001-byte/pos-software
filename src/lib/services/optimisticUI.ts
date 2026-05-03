import type { ApiResponse } from "@/types";

export interface OptimisticUpdate<T> {
  id: string;
  tempId: string;
  data: Partial<T>;
  status: "pending" | "confirmed" | "failed";
  error?: string;
  timestamp: number;
}

export interface OptimisticState {
  [key: string]: OptimisticUpdate<any>;
}

export class OptimisticUIStore {
  private pendingUpdates: OptimisticState = {};

  addUpdate<T>(id: string, data: Partial<T>, tempId?: string): string {
    const key = tempId || `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.pendingUpdates[key] = {
      id,
      tempId: key,
      data,
      status: "pending",
      timestamp: Date.now(),
    };

    return key;
  }

  confirmUpdate(tempId: string): void {
    if (this.pendingUpdates[tempId]) {
      this.pendingUpdates[tempId].status = "confirmed";
      setTimeout(() => this.removeUpdate(tempId), 5000);
    }
  }

  failUpdate(tempId: string, error: string): void {
    if (this.pendingUpdates[tempId]) {
      this.pendingUpdates[tempId].status = "failed";
      this.pendingUpdates[tempId].error = error;
    }
  }

  removeUpdate(tempId: string): void {
    delete this.pendingUpdates[tempId];
  }

  getPendingUpdates(): OptimisticUpdate<any>[] {
    return Object.values(this.pendingUpdates).filter(u => u.status === "pending");
  }

  getUpdate(tempId: string): OptimisticUpdate<any> | undefined {
    return this.pendingUpdates[tempId];
  }

  hasPendingUpdates(): boolean {
    return this.getPendingUpdates().length > 0;
  }

  clearFailed(): void {
    const failed = Object.entries(this.pendingUpdates).filter(([, u]) => u.status === "failed");
    for (const [key] of failed) {
      delete this.pendingUpdates[key];
    }
  }
}

export interface OptimisticRollback<T> {
  original: T;
  update: Partial<T>;
  applied: boolean;
}

export class OptimisticRollbackManager {
  private rollbacks: Map<string, OptimisticRollback<any>> = new Map();

  saveOriginal<T>(key: string, original: T): void {
    this.rollbacks.set(key, {
      original: JSON.parse(JSON.stringify(original)),
      update: null as any,
      applied: false,
    });
  }

  applyUpdate<T>(key: string, update: Partial<T>): void {
    const rollback = this.rollbacks.get(key);
    if (rollback) {
      rollback.update = update;
      rollback.applied = true;
    }
  }

  getRollback<T>(key: string): T | null {
    const rollback = this.rollbacks.get(key);
    if (!rollback || !rollback.applied) return null;
    
    return rollback.original as T;
  }

  remove(key: string): void {
    this.rollbacks.delete(key);
  }

  clear(): void {
    this.rollbacks.clear();
  }
}

export interface ConflictResolution<T> {
  strategy: "server_wins" | "client_wins" | "merge" | "manual";
  resolved: T;
  hasConflict: boolean;
}

export function resolveConflict<T>(
  serverState: T,
  clientState: T,
  strategy: "server_wins" | "client_wins" | "merge"
): ConflictResolution<T> {
  if (JSON.stringify(serverState) === JSON.stringify(clientState)) {
    return { strategy, resolved: serverState, hasConflict: false };
  }

  switch (strategy) {
    case "server_wins":
      return { strategy, resolved: serverState, hasConflict: true };
    case "client_wins":
      return { strategy, resolved: clientState, hasConflict: true };
    case "merge":
      const merged = { ...serverState, ...clientState };
      return { strategy, resolved: merged, hasConflict: true };
    default:
      return { strategy: "server_wins", resolved: serverState, hasConflict: true };
  }
}

export function createOptimisticResponse<T>(
  data: T,
  tempId: string
): ApiResponse<T> {
  return {
    data,
    message: `Optimistic update ${tempId}`,
  };
}

export function createRollbackResponse<T>(
  original: T,
  error: string
): ApiResponse<T> {
  return {
    data: original,
    error: `Rollback performed: ${error}`,
  };
}

export const optimisticStore = new OptimisticUIStore();
export const rollbackManager = new OptimisticRollbackManager();