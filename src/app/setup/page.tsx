"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Smartphone, CheckCircle2, Loader2, Copy, Check } from "lucide-react";
import { safeFetch } from "@/lib/api-client";

interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt: string;
  store: {
    id: string;
    name: string;
    status: string;
  };
}

function SetupContent() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const data = await safeFetch<{ users: User[] }>("/api/setup/users");
      if (data.users) {
        setUsers(data.users);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function approveStore(storeId: string) {
    setApproving(storeId);
    try {
      const data = await safeFetch<{ success: boolean }>("/api/setup/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      if (data.success) {
        setApproved(storeId);
        fetchUsers();
      }
    } catch {
      // ignore
    } finally {
      setApproving(null);
    }
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Setup</h1>
          </div>
          <p className="text-secondary text-sm">
            Complete the setup to get started.
          </p>
        </div>

        <div className="bg-surface rounded-2xl border border-border card-shadow p-6 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Super Admin Setup</h2>
          <p className="text-secondary text-xs leading-relaxed">
            To access the admin panel, you need to add your user ID to the{" "}
            <code className="bg-background px-1 py-0.5 rounded text-primary text-[11px] font-mono">
              SUPER_ADMIN_IDS
            </code>{" "}
            environment variable in your{" "}
            <code className="bg-background px-1 py-0.5 rounded text-primary text-[11px] font-mono">
              .env
            </code>{" "}
            file, then restart the server.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-secondary text-sm">
              No users found. Please sign up first.
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-background rounded-xl border border-border"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">
                      {user.name}
                    </div>
                    <div className="text-xs text-secondary">
                      {user.username} • {user.store.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.store.status === "pending_approval" ? (
                      <button
                        onClick={() => approveStore(user.store.id)}
                        disabled={approving === user.store.id || approved === user.store.id}
                        className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                      >
                        {approving === user.store.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : approved === user.store.id ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          "Approve"
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-green-500 font-medium">
                        Active
                      </span>
                    )}
                    <button
                      onClick={() => copyId(user.id)}
                      className="p-1.5 hover:bg-surface rounded-lg transition-colors"
                      title="Copy User ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-secondary" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="bg-background rounded-xl border border-border p-4 space-y-2">
              <div className="text-xs font-bold text-secondary uppercase tracking-widest">
                Steps
              </div>
              <ol className="text-xs text-secondary space-y-1 list-decimal list-inside">
                <li>Copy your User ID using the copy button above</li>
                <li>
                  Open{" "}
                  <code className="bg-surface px-1 py-0.5 rounded text-primary font-mono">
                    .env
                  </code>{" "}
                  and add:{" "}
                  <code className="bg-surface px-1 py-0.5 rounded text-primary font-mono">
                    SUPER_ADMIN_IDS=&quot;your-user-id&quot;
                  </code>
                </li>
                <li>Restart the dev server</li>
                <li>Log in at /auth/signin</li>
              </ol>
            </div>
          )}
        </div>

        <div className="text-center">
          <a
            href="/auth/signin"
            className="text-sm text-secondary hover:text-foreground transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
