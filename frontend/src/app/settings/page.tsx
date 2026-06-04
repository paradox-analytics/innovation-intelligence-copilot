"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toggle } from "@/components/ui/toggle";
import {
  Bell,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Moon,
  Plus,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  active: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState(false);

  const [notifyAnalysisComplete, setNotifyAnalysisComplete] = useState(true);
  const [notifyDocumentProcessed, setNotifyDocumentProcessed] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);
  const [notifyEntityDiscovered, setNotifyEntityDiscovered] = useState(true);

  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("iic-api-keys");
      if (stored) setApiKeys(JSON.parse(stored) as ApiKey[]);
    } catch { /* ignore */ }
  }, []);

  const generateApiKey = useCallback(async () => {
    setGeneratingKey(true);
    const key = `iic_${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
    const newKey: ApiKey = {
      id: crypto.randomUUID(),
      name: `API Key ${apiKeys.length + 1}`,
      key,
      createdAt: new Date().toISOString(),
      active: true,
    };
    const updated = [...apiKeys, newKey];
    setApiKeys(updated);
    localStorage.setItem("iic-api-keys", JSON.stringify(updated));
    setGeneratingKey(false);
  }, [apiKeys]);

  const deleteApiKey = (id: string) => {
    const updated = apiKeys.filter((k) => k.id !== id);
    setApiKeys(updated);
    localStorage.setItem("iic-api-keys", JSON.stringify(updated));
  };

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyKey = async (key: string, id: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch { /* ignore */ }
  };

  const handleExport = () => {
    try {
      const analyses = localStorage.getItem("iic-analyses") || "[]";
      const blob = new Blob([analyses], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `iic-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="mt-1 text-text-secondary">
            Manage your account, API keys, and preferences.
          </p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-accent-blue" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-14 w-14 rounded-full border-2 border-border-default"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-blue/20 text-lg font-bold text-accent-blue">
                    {(session?.user?.name || session?.user?.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {session?.user?.name || "User"}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {session?.user?.email || ""}
                  </p>
                  <Badge variant="blue" className="mt-1">Analyst</Badge>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-5 w-5 text-accent-amber" />
                API Keys
              </CardTitle>
              <Button
                size="sm"
                onClick={generateApiKey}
                disabled={generatingKey}
              >
                {generatingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate Key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {apiKeys.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                No API keys generated yet.
              </p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center gap-3 rounded-lg bg-bg-tertiary px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text-primary">
                        {apiKey.name}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-text-muted">
                        {showKeys.has(apiKey.id)
                          ? apiKey.key
                          : `${apiKey.key.slice(0, 8)}${"•".repeat(32)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleShowKey(apiKey.id)}
                      className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                    >
                      {showKeys.has(apiKey.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => copyKey(apiKey.key, apiKey.id)}
                      className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                    >
                      {copiedKey === apiKey.id ? (
                        <Check className="h-4 w-4 text-accent-emerald" />
                      ) : (
                        <ClipboardCopy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteApiKey(apiKey.id)}
                      className="rounded p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-rose"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-accent-cyan" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Toggle
                label="Analysis Complete"
                description="Get notified when an analysis finishes"
                checked={notifyAnalysisComplete}
                onChange={setNotifyAnalysisComplete}
              />
              <Toggle
                label="Document Processed"
                description="Get notified when a document is ingested"
                checked={notifyDocumentProcessed}
                onChange={setNotifyDocumentProcessed}
              />
              <Toggle
                label="Entity Discovered"
                description="Get notified when new entities are added to the graph"
                checked={notifyEntityDiscovered}
                onChange={setNotifyEntityDiscovered}
              />
              <Toggle
                label="Weekly Digest"
                description="Receive a weekly summary of platform activity"
                checked={notifyWeeklyDigest}
                onChange={setNotifyWeeklyDigest}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {darkMode ? (
                <Moon className="h-5 w-5 text-accent-violet" />
              ) : (
                <Sun className="h-5 w-5 text-accent-amber" />
              )}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Toggle
              label="Dark Mode"
              description="Use dark theme throughout the application"
              checked={darkMode}
              onChange={setDarkMode}
            />
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-accent-emerald" />
              Data Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-text-secondary">
              Download all your analysis data as a JSON file.
            </p>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export All Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
