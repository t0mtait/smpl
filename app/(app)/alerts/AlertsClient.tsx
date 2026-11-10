"use client";

import { useEffect, useState } from "react";
import type { Alert } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { IconBell, IconPlus, IconTrash } from "@/components/icons";

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [label, setLabel] = useState("");
  const [cadence, setCadence] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/alerts");
    if (res.status === 401) {
      window.location.href = "/auth/login?next=/alerts";
      return;
    }
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
      <li className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <p
            className={`font-medium ${
              !alert.active ? "text-muted line-through" : "text-ink"
            }`}
          >
            {alert.label}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {overdue ? "Due now" : `Next ${formatDate(alert.nextDue)}`} · every{" "}
            {alert.cadenceDays} day{alert.cadenceDays === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {overdue ? (
            <button className="btn-moss" onClick={() => act(alert.id, "snooze")}>
              Done for now
            </button>
          ) : null}
          <button
            className="btn-secondary"
            onClick={() => act(alert.id, "toggle", !alert.active)}
          >
            {alert.active ? "Pause" : "Resume"}
          </button>
          <button
            className="btn-danger"
            onClick={() => remove(alert.id)}
            aria-label={`Delete ${alert.label}`}
          >
            <IconTrash width={15} height={15} />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <p className="eyebrow">Alerts</p>
        <h1 className="display mt-2 text-4xl leading-[1.1] sm:text-5xl">Keep the pile down</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
          Recurring prompts to stay on top of it. “Reconsider the camping gear” every quarter
          beats a heroic one-time purge.
        </p>
      </header>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-5">
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
          <IconPlus width={15} height={15} />
          Add alert
        </button>
      </form>

      {error ? (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-clay-50 text-clay-500">
            <IconBell width={15} height={15} />
          </span>
          <h2 className="display text-lg">Due now</h2>
          <span className="pill bg-clay-50 text-clay-600 ml-auto">{due.length}</span>
        </div>
        {due.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">Nothing due. Enjoy the quiet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {due.map((a) => (
              <Row key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-6 py-4">
          <h2 className="display text-lg">Scheduled</h2>
        </div>
        {rest.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted">
            No alerts scheduled yet. Add one above.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rest.map((a) => (
              <Row key={a.id} alert={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
