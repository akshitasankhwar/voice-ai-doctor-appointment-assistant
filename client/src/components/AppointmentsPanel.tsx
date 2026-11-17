import { useEffect, useRef, useState } from "react";
import { formatTime } from "../api";
import type { Appointment } from "../types";
import Card from "./Card";
import { CalendarIcon, CheckIcon, XIcon } from "./icons";

type Filter = "all" | "booked" | "cancelled";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "booked", label: "Active" },
  { id: "cancelled", label: "Cancelled" },
];

/** Ids of rows that are new or changed status since the last refresh (highlighted for a few seconds). */
function useChangedRows(appointments: Appointment[]) {
  const prev = useRef<Map<number, string> | null>(null);
  const [changed, setChanged] = useState<Set<number>>(new Set());
  useEffect(() => {
    const now = new Map(appointments.map((a) => [a.id, a.status]));
    if (prev.current) {
      const ids = appointments.filter((a) => prev.current!.get(a.id) !== a.status).map((a) => a.id);
      if (ids.length) {
        setChanged(new Set(ids));
        const t = setTimeout(() => setChanged(new Set()), 2600);
        prev.current = now;
        return () => clearTimeout(t);
      }
    } else if (appointments.length === 0) {
      return; // wait for the first real load before taking a baseline
    }
    prev.current = now;
  }, [appointments]);
  return changed;
}

export default function AppointmentsPanel({ appointments }: { appointments: Appointment[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const changed = useChangedRows(appointments);
  const count = (f: Filter) => (f === "all" ? appointments.length : appointments.filter((a) => a.status === f).length);
  const rows = filter === "all" ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <Card
      title="Appointments"
      icon={<CalendarIcon />}
      delay={120}
      extra={
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                filter === f.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f.label} <span className="text-slate-400">{count(f.id)}</span>
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="animate-pop py-8 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-500">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">
            {appointments.length === 0 ? "No appointments yet" : "Nothing in this view"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Bookings made on the call appear here instantly.</p>
        </div>
      ) : (
        <div className="scroll-thin max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white/95 text-[11px] uppercase tracking-wider text-slate-400 backdrop-blur">
              <tr>
                <th className="py-2 pl-2 pr-3 font-medium">Patient</th>
                <th className="py-2 pr-3 font-medium">Doctor</th>
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => {
                const booked = a.status === "booked";
                return (
                  <tr
                    key={a.id}
                    style={{ animationDelay: changed.has(a.id) ? undefined : `${Math.min(i, 8) * 30}ms` }}
                    className={`border-t border-slate-100 transition-colors hover:bg-slate-50/80 ${
                      changed.has(a.id) ? "animate-flash" : "animate-fade-up"
                    } ${booked ? "text-slate-800" : "text-slate-400"}`}
                  >
                    <td className="py-2.5 pl-2 pr-3">
                      <div className="font-medium">{a.patient_name}</div>
                      <div className="font-mono text-xs text-slate-400">#{a.id} · {a.phone}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      {a.doctor_name}
                      <div className="text-xs text-slate-400">{a.speciality}</div>
                    </td>
                    <td className={`whitespace-nowrap py-2.5 pr-3 ${booked ? "" : "line-through"}`}>{formatTime(a.start_time)}</td>
                    <td className="py-2.5 pr-2 text-right">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          booked ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {booked ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                        {booked ? "Booked" : "Cancelled"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
