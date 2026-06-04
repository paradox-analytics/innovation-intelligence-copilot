"use client";

import { cn } from "@/lib/utils";
import { Bell, ChevronRight, LogOut, User } from "lucide-react";
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

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
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
        pathLabels[path] ||
        segment.charAt(0).toUpperCase() + segment.slice(1),
      path,
    };
  });

  const userName = session?.user?.name ?? session?.user?.email ?? "User";
  const userImage = session?.user?.image;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border-default bg-bg-secondary px-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="text-text-muted">Home</span>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.path} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
            <span className="font-medium text-text-primary">
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* User area */}
      <div className="flex items-center gap-3">
        <button
          className={cn(
            "relative rounded-lg p-2 text-text-muted transition-colors",
            "hover:bg-bg-hover hover:text-text-secondary"
          )}
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-blue" />
        </button>

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
                  <p className="text-xs text-text-muted">
                    {session.user.email}
                  </p>
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
