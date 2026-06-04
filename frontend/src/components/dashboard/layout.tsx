"use client";

import { CommandPalette } from "./command-palette";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <div data-print-hide>
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div data-print-hide>
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto bg-bg-primary print:overflow-visible">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
