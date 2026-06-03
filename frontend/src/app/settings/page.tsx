"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
  Bell,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  Key,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useState } from "react";

// --- Types ---

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  active: boolean;
}

// --- Mock data ---

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: "key1",
    name: "Production",
    key: "iic_prod_sk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    createdAt: "2024-01-10",
    lastUsed: "2024-01-22",
    active: true,
  },
  {
    id: "key2",
    name: "Development",
    key: "iic_dev_sk_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4",
    createdAt: "2024-01-05",
    lastUsed: "2024-01-21",
    active: true,
  },
  {
    id: "key3",
    name: "Testing (deprecated)",
    key: "iic_test_sk_j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6",
    createdAt: "2023-12-15",
    lastUsed: null,
    active: false,
  },
];

export default function SettingsPage() {
  // Profile
  const [name, setName] = useState("Admin User");
  const [email, setEmail] = useState("admin@company.com");
  const [role] = useState("Administrator");
  const [profileSaved, setProfileSaved] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");

  // Notifications
  const [notifyAnalysisComplete, setNotifyAnalysisComplete] = useState(true);
  const [notifyDocumentProcessed, setNotifyDocumentProcessed] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);
  const [notifyEntityDiscovered, setNotifyEntityDiscovered] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);

  // Theme
  const [darkMode, setDarkMode] = useState(true);

  const handleProfileSave = () => {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
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
    } catch {
      // ignore
    }
  };

  const generateKey = () => {
    if (!newKeyName.trim()) return;
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let randomPart = "";
    for (let i = 0; i < 32; i++) {
      randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: `iic_new_sk_${randomPart}`,
      createdAt: new Date().toISOString().split("T")[0],
      lastUsed: null,
      active: true,
    };
    setApiKeys((prev) => [...prev, newKey]);
    setNewKeyName("");
  };

  const revokeKey = (id: string) => {
    setApiKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, active: false } : k))
    );
  };

  const deleteKey = (id: string) => {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleExportData = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      analyses: [],
      documents: [],
      entities: [],
      note: "This is a placeholder export. In production, this would contain all user data.",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `iic-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {/* Page header */}
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
          <CardContent className="space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Role
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="blue">{role}</Badge>
                <span className="text-xs text-text-muted">
                  Contact your administrator to change roles
                </span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleProfileSave}>
                {profileSaved ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-accent-amber" />
              API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Generate new key */}
            <div className="flex gap-2">
              <Input
                placeholder="Key name (e.g., Production)"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && generateKey()}
              />
              <Button
                size="md"
                onClick={generateKey}
                disabled={!newKeyName.trim()}
                className="shrink-0"
              >
                <Plus className="h-4 w-4" />
                Generate
              </Button>
            </div>

            {/* Key list */}
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className={cn(
                    "rounded-lg border p-4 transition-colors",
                    apiKey.active
                      ? "border-border-default bg-bg-tertiary"
                      : "border-border-default/50 bg-bg-tertiary/50 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">
                          {apiKey.name}
                        </span>
                        <Badge
                          variant={apiKey.active ? "emerald" : "default"}
                        >
                          {apiKey.active ? "Active" : "Revoked"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-text-muted font-mono">
                          {showKeys.has(apiKey.id)
                            ? apiKey.key
                            : apiKey.key.slice(0, 12) + "..." + apiKey.key.slice(-4)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(apiKey.id)}
                          className="text-text-muted hover:text-text-secondary"
                          aria-label={showKeys.has(apiKey.id) ? "Hide key" : "Show key"}
                        >
                          {showKeys.has(apiKey.id) ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyKey(apiKey.key, apiKey.id)}
                          className="text-text-muted hover:text-text-secondary"
                          aria-label="Copy key"
                        >
                          {copiedKey === apiKey.id ? (
                            <Check className="h-3.5 w-3.5 text-accent-emerald" />
                          ) : (
                            <ClipboardCopy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-text-muted">
                        <span>Created {apiKey.createdAt}</span>
                        {apiKey.lastUsed && <span>Last used {apiKey.lastUsed}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {apiKey.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeKey(apiKey.id)}
                        >
                          Revoke
                        </Button>
                      )}
                      <button
                        onClick={() => deleteKey(apiKey.id)}
                        className="rounded p-1.5 text-text-muted hover:bg-accent-rose/10 hover:text-accent-rose transition-colors"
                        aria-label="Delete key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5 text-accent-violet" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase text-text-muted">Events</p>
              <Toggle
                checked={notifyAnalysisComplete}
                onChange={setNotifyAnalysisComplete}
                label="Analysis Complete"
                description="Notify when an analysis finishes processing"
              />
              <Toggle
                checked={notifyDocumentProcessed}
                onChange={setNotifyDocumentProcessed}
                label="Document Processed"
                description="Notify when document indexing completes"
              />
              <Toggle
                checked={notifyEntityDiscovered}
                onChange={setNotifyEntityDiscovered}
                label="New Entity Discovered"
                description="Notify when new entities are added to the knowledge graph"
              />
              <Toggle
                checked={notifyWeeklyDigest}
                onChange={setNotifyWeeklyDigest}
                label="Weekly Digest"
                description="Receive a weekly summary of activity and insights"
              />
            </div>
            <div className="border-t border-border-default pt-4 space-y-3">
              <p className="text-xs font-medium uppercase text-text-muted">Channels</p>
              <Toggle
                checked={notifyEmail}
                onChange={setNotifyEmail}
                label="Email Notifications"
              />
              <Toggle
                checked={notifyBrowser}
                onChange={setNotifyBrowser}
                label="Browser Notifications"
              />
            </div>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {darkMode ? (
                <Moon className="h-5 w-5 text-accent-blue" />
              ) : (
                <Sun className="h-5 w-5 text-accent-amber" />
              )}
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Toggle
              checked={darkMode}
              onChange={setDarkMode}
              label={darkMode ? "Dark Mode" : "Light Mode"}
              description="Toggle between dark and light theme"
            />
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-accent-cyan" />
              Data Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              Download a JSON export of all your analyses, documents, and entities.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4" />
              Export All Data
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
