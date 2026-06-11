"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type NotificationType =
  | "analysis_started"
  | "analysis_completed"
  | "analysis_error"
  | "document_uploaded"
  | "document_deleted"
  | "info";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description?: string;
  timestamp: string; // ISO
  read: boolean;
  href?: string;
}

interface NotifyInput {
  type: NotificationType;
  title: string;
  description?: string;
  href?: string;
  /** Also surface a transient toast (default true). */
  toast?: boolean;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (input: NotifyInput) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY = "iic.notifications.v1";
const MAX_STORED = 50;
const TOAST_MS = 6000;

export const notificationConfig: Record<
  NotificationType,
  { icon: ReactNode; color: string }
> = {
  analysis_started: {
    icon: <Search className="h-4 w-4" />,
    color: "bg-accent-blue/15 text-accent-blue",
  },
  analysis_completed: {
    icon: <Brain className="h-4 w-4" />,
    color: "bg-accent-emerald/15 text-accent-emerald",
  },
  analysis_error: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "bg-accent-rose/15 text-accent-rose",
  },
  document_uploaded: {
    icon: <Upload className="h-4 w-4" />,
    color: "bg-accent-violet/15 text-accent-violet",
  },
  document_deleted: {
    icon: <Trash2 className="h-4 w-4" />,
    color: "bg-accent-rose/15 text-accent-rose",
  },
  info: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-accent-blue/15 text-accent-blue",
  },
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted notifications on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setNotifications(JSON.parse(raw) as AppNotification[]);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration so we don't clobber stored data).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED)));
    } catch {
      // ignore quota errors
    }
  }, [notifications, hydrated]);

  const notify = useCallback((input: NotifyInput) => {
    const item: AppNotification = {
      id: makeId(),
      type: input.type,
      title: input.title,
      description: input.description,
      href: input.href,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [item, ...prev].slice(0, MAX_STORED));
    if (input.toast !== false) {
      setToasts((prev) => [item, ...prev].slice(0, 4));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, TOAST_MS);
    }
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => setNotifications([]), []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      notify,
      markAllRead,
      remove,
      clearAll,
    }),
    [notifications, notify, markAllRead, remove, clearAll]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const config = notificationConfig[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border-default bg-bg-secondary p-3 shadow-xl animate-fade-in"
              role="status"
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  config.color
                )}
              >
                {config.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="text-text-muted transition-colors hover:text-text-primary"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
