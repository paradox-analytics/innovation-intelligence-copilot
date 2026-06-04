"use client";

import { cn } from "@/lib/utils";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Network,
  Search,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: "Analysis",
    href: "/analyze",
    icon: <Search className="h-5 w-5" />,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    label: "Knowledge Graph",
    href: "/knowledge",
    icon: <Network className="h-5 w-5" />,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: <Brain className="h-5 w-5" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border-default bg-bg-secondary transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border-default px-4">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent-blue" />
            <span className="text-sm font-bold text-text-primary">
              IIC
            </span>
          </Link>
        )}
        {collapsed && (
          <Link href="/" className="mx-auto">
            <Sparkles className="h-6 w-6 text-accent-blue" />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-accent-blue/10 text-accent-blue"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border-default p-3">
        {/* User avatar */}
        {session?.user && (
          <div
            className={cn(
              "mb-2 flex items-center gap-3 rounded-lg px-3 py-2",
              collapsed && "justify-center px-2"
            )}
          >
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User avatar"}
                className="h-7 w-7 shrink-0 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-blue/20">
                <User className="h-4 w-4 text-accent-blue" />
              </div>
            )}
            {!collapsed && (
              <span className="truncate text-sm font-medium text-text-secondary">
                {session.user.name ?? session.user.email}
              </span>
            )}
          </div>
        )}

        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-all duration-200 hover:bg-bg-hover hover:text-text-secondary",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Settings" : undefined}
        >
          <Settings className="h-5 w-5" />
          {!collapsed && <span>Settings</span>}
        </Link>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-2 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-secondary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
