"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [label, setLabel] = useState("");
  const [cadence, setCadence] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/alerts");
    const data = await res.json();
    setAlerts(data.alerts ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, cadenceDays: Number(cadence) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create alert");
      return;
    }
    setLabel("");
    load();
  };

  const act = async (id: number, action: "snooze" | "toggle", active?: boolean) => {
    const res = await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, active }),
    });
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts);
    }
  };

  const remove = async (id: number) => {
    const res = await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const due = (alerts ?? []).filter((a) => a.active && a.nextDue <= today);
  const rest = (alerts ?? []).filter((a) => !(a.active && a.nextDue <= today));

  const Row = ({ alert }: { alert: Alert }) => {
    const overdue = alert.active && alert.nextDue <= today;
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div>
          <p className={`font-medium ${!alert.active ? "text-ink-400 line-through" : ""}`}>
            {alert.label}
          </p>
          <p className="text-xs text-ink-400">
            {overdue ? "Due now" : `Next ${formatDate(alert.nextDue)}`} · every {alert.cadenceDays}{" "}
            day{alert.cadenceDays === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          {overdue && (
            <button className="btn-moss" onClick={() => act(alert.id, "snooze")}>
              Done for now
            </button>
          )}
          <button className="btn-secondary" onClick={() => act(alert.id, "toggle", !alert.active)}>
            {alert.active ? "Pause" : "Resume"}
          </button>
          <button className="btn-danger" onClick={() => remove(alert.id)}>
            Delete
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Declutter alerts</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Recurring prompts to keep the pile down. “Reconsider the camping gear” every quarter is
          more effective than a one-time purge.
        </p>
      </div>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label className="label" htmlFor="label">
            Alert
          </label>
          <input
            id="label"
            className="input"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Review the garage shelves"
          />
        </div>
        <div>
          <label className="label" htmlFor="cadence">
            Every (days)
          </label>
          <input
            id="cadence"
            type="number"
            min="1"
            max="365"
            className="input w-32"
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary">
          Add alert
        </button>
      </form>
      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

      <section className="card">
        <h2 className="mb-2 font-semibold text-clay-600">Due now ({due.length})</h2>
        {due.length === 0 ? (
          <p className="py-4 text-sm text-ink-400">Nothing due. Enjoy the quiet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {due.map((a) => (
              <Row key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Scheduled</h2>
        {rest.length === 0 ? (
          <p className="py-4 text-sm text-ink-400">No alerts scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rest.map((a) => (
              <Row key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
