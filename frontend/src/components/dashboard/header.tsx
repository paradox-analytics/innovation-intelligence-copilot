"use client";

import {
  notificationConfig,
  useNotifications,
} from "@/components/notifications/notification-provider";
import { cn } from "@/lib/utils";
import { Bell, ChevronRight, LogOut, User, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const pathLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/analyze": "Analysis",
  "/documents": "Documents",
  "/knowledge": "Knowledge Graph",
  "/reports": "Reports",
  "/settings": "Settings",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { notifications, unreadCount, markAllRead, remove, clearAll } =
    useNotifications();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = segments.map((segment, index) => {
    const path = "/" + segments.slice(0, index + 1).join("/");
    return {
      label:
        pathLabels[path] || segment.charAt(0).toUpperCase() + segment.slice(1),
      path,
    };
  });

  const userName = session?.user?.name ?? session?.user?.email ?? "User";
  const userImage = session?.user?.image;

  const toggleNotif = () => {
    setShowNotif((open) => {
      // Mark everything read when opening the panel.
      if (!open && unreadCount > 0) markAllRead();
      return !open;
    });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-bg-secondary px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="text-text-muted">Home</span>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="font-medium text-text-primary">{crumb.label}</span>
          </span>
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotif}
            className={cn(
              "relative rounded-lg p-2 text-text-muted transition-colors",
              "hover:bg-bg-hover hover:text-text-secondary"
            )}
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-blue px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-xl">
              <div className="flex items-center justify-between border-b border-border-default px-4 py-2.5">
                <p className="text-sm font-semibold text-text-primary">
                  Notifications
                </p>
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-text-muted transition-colors hover:text-text-primary"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-text-muted">
                    No notifications yet
                  </div>
                )}
                {notifications.map((n) => {
                  const config = notificationConfig[n.type];
                  const body = (
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                          config.color
                        )}
                      >
                        {config.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary">
                          {n.title}
                        </p>
                        {n.description && (
                          <p className="mt-0.5 text-xs text-text-muted line-clamp-2">
                            {n.description}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-text-tertiary">
                          {timeAgo(n.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          remove(n.id);
                        }}
                        className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
                        aria-label="Dismiss"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                  return n.href ? (
                    <Link
                      key={n.id}
                      href={n.href}
                      onClick={() => setShowNotif(false)}
                      className="block border-b border-border-default px-4 py-3 transition-colors last:border-0 hover:bg-bg-hover"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      key={n.id}
                      className="border-b border-border-default px-4 py-3 last:border-0"
                    >
                      {body}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-1.5 transition-colors hover:bg-bg-hover"
          >
            {userImage ? (
              <img
                src={userImage}
                alt={userName}
                className="h-7 w-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-blue/20">
                <User className="h-4 w-4 text-accent-blue" />
              </div>
            )}
            <span className="text-sm font-medium text-text-primary">
              {userName}
            </span>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-border-default bg-bg-secondary shadow-xl">
              <div className="border-b border-border-default px-4 py-3">
                <p className="text-sm font-medium text-text-primary">
                  {userName}
                </p>
                {session?.user?.email && (
                  <p className="text-xs text-text-muted">{session.user.email}</p>
                )}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
