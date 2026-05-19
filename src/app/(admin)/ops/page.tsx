"use client";

import { useState, useEffect } from "react";
import { Shield, Database, RefreshCw, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { ReconciliationItem } from "@/lib/services/reconciliation";

export default function AdminOpsPage() {
  const [health, setHealth] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchBackups = () => {
    fetch("/api/admin/backup")
      .then(r => r.json())
      .then(setBackups)
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetchBackups();
  }, []);

  const createBackup = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/backup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Backup created (${(data.size / 1024).toFixed(0)} KB)` });
        fetchBackups();
      } else {
        setMessage({ type: "error", text: data.error || "Backup failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Backup failed" });
    }
    setCreating(false);
  };

  const runReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/admin/reconcile");
      const data = await res.json();
      setReconciliation(data);
    } catch {
      setMessage({ type: "error", text: "Reconciliation failed" });
    }
    setReconciling(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "match": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "minor": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "major": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="w-6 h-6" /> Operations
      </h1>

      {message && (
        <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
          <button className="ml-auto" onClick={() => setMessage(null)}>✕</button>
        </div>
      )}

      {/* Health */}
      <section className="card-shadow bg-surface rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5" /> System Health
        </h2>
        {health ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${health.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-sm">Status: {health.status}</span>
            </div>
            <div className="text-sm text-text-secondary">
              Uptime: {Math.floor(health.uptime / 60)}m
            </div>
            {Object.entries(health.checks || {}).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${val === "ok" ? "bg-green-500" : "bg-red-500"}`} />
                {key}: {val as string}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Loading...</p>
        )}
      </section>

      {/* Backups */}
      <section className="card-shadow bg-surface rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" /> Database Backups
        </h2>
        <Button onClick={createBackup} disabled={creating}>
          {creating ? "Creating..." : "Create Backup"}
        </Button>
        {backups.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">Date</th>
                <th className="py-2">Size</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2">{formatDate(b.date)}</td>
                  <td className="py-2">{(b.size / 1024).toFixed(0)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Reconciliation */}
      <section className="card-shadow bg-surface rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> Ledger Reconciliation
        </h2>
        <Button onClick={runReconciliation} disabled={reconciling}>
          {reconciling ? "Running..." : "Run Reconciliation"}
        </Button>
        {reconciliation && (
          <div className="space-y-3">
            {reconciliation.items?.map((item: ReconciliationItem, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  {statusIcon(item.status)}
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex gap-6">
                  <span>Physical: {formatCurrency(item.physical)}</span>
                  <span>Ledger: {formatCurrency(item.ledger)}</span>
                  <span className={item.difference === 0 ? "" : item.difference > 0 ? "text-red-600" : "text-green-600"}>
                    Diff: {formatCurrency(item.difference)}
                  </span>
                </div>
              </div>
            ))}
            {reconciliation.hasIssues && (
              <p className="text-sm text-yellow-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Discrepancies found — review your transactions
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
