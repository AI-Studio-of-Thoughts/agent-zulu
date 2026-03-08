/**
 * Offline Outbox — Persistent queue for failed network operations.
 *
 * Uses IndexedDB to store pending operations (shadow logs, community flywheel,
 * specialist calls) when offline or on network failure. Automatically flushes
 * when connectivity is restored.
 *
 * Design principles:
 * - Never lose cultural data — every interaction has sovereign training value
 * - Silent operation — outbox should never block the user experience
 * - Exponential backoff on repeated failures
 * - Max queue size to prevent storage bloat on extended offline periods
 */

const DB_NAME = "agent-zulu-outbox";
const DB_VERSION = 1;
const STORE_NAME = "pending_ops";
const MAX_QUEUE_SIZE = 500;
const MAX_RETRIES = 5;
const FLUSH_INTERVAL = 30_000; // 30s
const MIN_BACKOFF = 2_000;
const MAX_BACKOFF = 60_000;

export interface OutboxEntry {
  id?: number; // auto-incremented by IndexedDB
  target: "session_logs" | "community_logs" | "edge_function";
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  lastAttempt: number;
}

type FlushHandler = (entry: OutboxEntry) => Promise<boolean>;

let db: IDBDatabase | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isOnline = navigator.onLine;
let flushHandler: FlushHandler | null = null;
let listeners: Array<(count: number) => void> = [];

// ── IndexedDB Setup ─────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("target", "target", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onerror = () => {
      console.debug("[Outbox] IndexedDB open failed, falling back to memory");
      reject(request.error);
    };
  });
}

// ── Memory Fallback ─────────────────────────────────────────
// For environments where IndexedDB isn't available (private browsing, etc.)

let memoryQueue: OutboxEntry[] = [];
let useMemoryFallback = false;

// ── Public API ──────────────────────────────────────────────

/**
 * Initialize the outbox system. Call once on app startup.
 */
export async function initOutbox(handler: FlushHandler): Promise<void> {
  flushHandler = handler;

  try {
    await openDB();
  } catch {
    useMemoryFallback = true;
    console.debug("[Outbox] Using memory fallback");
  }

  // Listen for connectivity changes
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  isOnline = navigator.onLine;

  // Start periodic flush
  flushTimer = setInterval(() => {
    if (isOnline) flushQueue();
  }, FLUSH_INTERVAL);

  // Initial flush if online
  if (isOnline) {
    setTimeout(flushQueue, 3000);
  }
}

/**
 * Enqueue a failed operation for later retry.
 */
export async function enqueue(
  target: OutboxEntry["target"],
  payload: Record<string, unknown>
): Promise<void> {
  const entry: OutboxEntry = {
    target,
    payload,
    createdAt: Date.now(),
    retries: 0,
    lastAttempt: 0,
  };

  if (useMemoryFallback) {
    if (memoryQueue.length >= MAX_QUEUE_SIZE) {
      memoryQueue.shift(); // Drop oldest
    }
    memoryQueue.push(entry);
    notifyListeners();
    return;
  }

  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Check queue size
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result >= MAX_QUEUE_SIZE) {
        // Delete oldest entries
        const cursor = store.openCursor();
        let deleted = 0;
        const toDelete = countReq.result - MAX_QUEUE_SIZE + 1;
        cursor.onsuccess = () => {
          const result = cursor.result;
          if (result && deleted < toDelete) {
            result.delete();
            deleted++;
            result.continue();
          }
        };
      }
    };

    store.add(entry);
    tx.oncomplete = () => notifyListeners();
  } catch {
    // Last resort: memory fallback
    memoryQueue.push(entry);
    notifyListeners();
  }
}

/**
 * Flush all pending operations.
 */
export async function flushQueue(): Promise<number> {
  if (!flushHandler) return 0;

  if (useMemoryFallback) {
    return flushMemoryQueue();
  }

  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const entries: OutboxEntry[] = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    let flushed = 0;

    for (const entry of entries) {
      // Skip if backoff hasn't elapsed
      const backoff = Math.min(MAX_BACKOFF, MIN_BACKOFF * Math.pow(2, entry.retries));
      if (entry.lastAttempt > 0 && Date.now() - entry.lastAttempt < backoff) continue;

      // Skip if max retries exceeded
      if (entry.retries >= MAX_RETRIES) {
        await deleteEntry(entry.id!);
        continue;
      }

      try {
        const success = await flushHandler(entry);
        if (success) {
          await deleteEntry(entry.id!);
          flushed++;
        } else {
          await updateRetry(entry.id!, entry.retries + 1);
        }
      } catch {
        await updateRetry(entry.id!, entry.retries + 1);
      }
    }

    notifyListeners();
    return flushed;
  } catch {
    return 0;
  }
}

/**
 * Get the current pending count.
 */
export async function getPendingCount(): Promise<number> {
  if (useMemoryFallback) return memoryQueue.length;

  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * Subscribe to queue count changes.
 */
export function onQueueChange(listener: (count: number) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Get current online status.
 */
export function getOnlineStatus(): boolean {
  return isOnline;
}

/**
 * Subscribe to online/offline changes.
 */
export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  const onlineHandler = () => listener(true);
  const offlineHandler = () => listener(false);
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", offlineHandler);
  return () => {
    window.removeEventListener("online", onlineHandler);
    window.removeEventListener("offline", offlineHandler);
  };
}

/**
 * Cleanup — call on app unmount.
 */
export function destroyOutbox(): void {
  if (flushTimer) clearInterval(flushTimer);
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  db?.close();
  db = null;
}

// ── Internal ────────────────────────────────────────────────

function handleOnline() {
  isOnline = true;
  console.debug("[Outbox] Online — flushing queue");
  // Flush after brief delay to let connection stabilize
  setTimeout(flushQueue, 2000);
}

function handleOffline() {
  isOnline = false;
  console.debug("[Outbox] Offline — queuing operations");
}

async function deleteEntry(id: number): Promise<void> {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch {}
}

async function updateRetry(id: number, retries: number): Promise<void> {
  try {
    const database = await openDB();
    const tx = database.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const entry = req.result;
      if (entry) {
        entry.retries = retries;
        entry.lastAttempt = Date.now();
        store.put(entry);
      }
    };
  } catch {}
}

async function flushMemoryQueue(): Promise<number> {
  if (!flushHandler) return 0;
  let flushed = 0;
  const remaining: OutboxEntry[] = [];

  for (const entry of memoryQueue) {
    if (entry.retries >= MAX_RETRIES) continue;
    try {
      const success = await flushHandler(entry);
      if (success) {
        flushed++;
      } else {
        entry.retries++;
        entry.lastAttempt = Date.now();
        remaining.push(entry);
      }
    } catch {
      entry.retries++;
      entry.lastAttempt = Date.now();
      remaining.push(entry);
    }
  }

  memoryQueue = remaining;
  notifyListeners();
  return flushed;
}

async function notifyListeners() {
  const count = await getPendingCount();
  listeners.forEach((l) => l(count));
}
