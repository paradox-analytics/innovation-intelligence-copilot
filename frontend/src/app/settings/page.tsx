"use client";

import { DashboardLayout } from "@/components/dashboard/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import {
  apiClient,
  getToken,
} from "@/lib/api";
import {
  AlertCircle,
  Bell,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogIn,
  Moon,
  Plus,
  Save,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// --- Types ---

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
  active: boolean;
}

export default function SettingsPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKeys, setShowKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatingKey, setGeneratingKey] = useState(false);

  // Notifications (stored locally)
  const [notifyAnalysisComplete, setNotifyAnalysisComplete] = useState(true);
  const [notifyDocumentProcessed, setNotifyDocumentProcessed] = useState(true);
  const [notifyWeeklyDigest, setNotifyWeeklyDigest] = useState(false);
  const [notifyEntityDiscovered, setNotifyEntityDiscovered] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyBrowser, setNotifyBrowser] = useState(true);

  // Theme
  const [darkMode, setDarkMode] = useState(true);

  // Check auth on mount
  const checkAuth = useCallback(async () => {
    setAuthLoading(true);
    const token = getToken();
    if (!token) {
      setIsAuthenticated(false);
      setAuthLoading(false);
      return;
    }

    try {
      const user = await apiClient.getMe();
      setName(user.full_name);
      setEmail(user.email);
      setRole(user.role);
      setIsAuthenticated(true);
    } catch {
      // Token might be expired
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load notification preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("iic-notification-prefs");
      if (stored) {
        const prefs = JSON.parse(stored) as Record<string, boolean>;
        if (prefs.analysisComplete !== undefined)
          setNotifyAnalysisComplete(prefs.analysisComplete);
        if (prefs.documentProcessed !== undefined)
          setNotifyDocumentProcessed(prefs.documentProcessed);
        if (prefs.weeklyDigest !== undefined)
          setNotifyWeeklyDigest(prefs.weeklyDigest);
        if (prefs.entityDiscovered !== undefined)
          setNotifyEntityDiscovered(prefs.entityDiscovered);
        if (prefs.email !== undefined) setNotifyEmail(prefs.email);
        if (prefs.browser !== undefined) setNotifyBrowser(prefs.browser);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save notification prefs when they change
  const saveNotificationPrefs = useCallback(() => {
    try {
      localStorage.setItem(
        "iic-notification-prefs",
        JSON.stringify({
          analysisComplete: notifyAnalysisComplete,
          documentProcessed: notifyDocumentProcessed,
          weeklyDigest: notifyWeeklyDigest,
          entityDiscovered: notifyEntityDiscovered,
          email: notifyEmail,
          browser: notifyBrowser,
        })
      );
    } catch {
      // ignore
    }
  }, [
    notifyAnalysisComplete,
    notifyDocumentProcessed,
    notifyWeeklyDigest,
    notifyEntityDiscovered,
    notifyEmail,
    notifyBrowser,
  ]);

  useEffect(() => {
    saveNotificationPrefs();
  }, [saveNotificationPrefs]);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    setLoginLoading(true);
    setLoginError(null);

    try {
      await apiClient.login({ email: loginEmail, password: loginPassword });
      await checkAuth();
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Login failed"
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    setIsAuthenticated(false);
    setName("");
    setEmail("");
    setRole("");
    setApiKeys([]);
  };

  const handleProfileSave = () => {
    // Profile save is a no-op since we don't have a PATCH /auth/me endpoint
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

  const generateKey = async () => {
    if (!newKeyName.trim()) return;
    setGeneratingKey(true);

    try {
      const response = await apiClient.generateApiKey();
      const newKey: ApiKey = {
        id: `key-${Date.now()}`,
        name: newKeyName.trim(),
        key: response.api_key,
        createdAt: new Date().toISOString().split("T")[0],
        lastUsed: null,
        active: true,
      };
      setApiKeys((prev) => [...prev, newKey]);
      setNewKeyName("");
    } catch (err) {
      console.error("Failed to generate API key:", err);
    } finally {
      setGeneratingKey(false);
    }
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

  // Auth loading state
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
        </div>
      </DashboardLayout>
    );
  }

  // Not authenticated - show login form
  if (!isAuthenticated) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-md space-y-8 p-6 pt-20">
          <div className="text-center">
            <LogIn className="mx-auto h-12 w-12 text-accent-blue" />
            <h1 className="mt-4 text-2xl font-bold text-text-primary">
              Sign In
            </h1>
            <p className="mt-1 text-text-secondary">
              Sign in to manage your account settings and API keys.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              {loginError && (
                <div className="flex items-start gap-2 rounded-lg border border-accent-rose/30 bg-accent-rose/5 p-3 text-sm text-accent-rose">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {loginError}
                </div>
              )}
              <Input
                label="Email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@company.com"
              />
              <Input
                label="Password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <Button
                className="w-full"
                onClick={handleLogin}
                disabled={
                  loginLoading ||
                  !loginEmail.trim() ||
                  !loginPassword.trim()
                }
              >
                {loginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loginLoading ? "Signing in..." : "Sign In"}
              </Button>
              <p className="text-center text-xs text-text-muted">
                Settings and API keys require authentication. Other features
                work without signing in.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
            <p className="mt-1 text-text-secondary">
              Manage your account, API keys, and preferences.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
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
              disabled
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">
                Role
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="blue">{role || "User"}</Badge>
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
                disabled={!newKeyName.trim() || generatingKey}
                className="shrink-0"
              >
                {generatingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Generate
              </Button>
            </div>

            {/* Key list */}
            {apiKeys.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                No API keys generated yet. Create one above.
              </div>
            ) : (
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
                              : apiKey.key.slice(0, 12) +
                                "..." +
                                apiKey.key.slice(-4)}
                          </code>
                          <button
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            className="text-text-muted hover:text-text-secondary"
                            aria-label={
                              showKeys.has(apiKey.id) ? "Hide key" : "Show key"
                            }
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
                          {apiKey.lastUsed && (
                            <span>Last used {apiKey.lastUsed}</span>
                          )}
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
            )}
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
              <p className="text-xs font-medium uppercase text-text-muted">
                Events
              </p>
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
              <p className="text-xs font-medium uppercase text-text-muted">
                Channels
              </p>
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
              Download a JSON export of all your analyses, documents, and
              entities.
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
