import { useMemo, useState } from "react";
import type { Doctor } from "../types";
import Card from "./Card";
import { ClockIcon, StethoscopeIcon } from "./icons";

// One colour per speciality, cycled in order of first appearance.
const PALETTE = [
  { avatar: "from-sky-400 to-blue-600", chip: "bg-sky-50 text-sky-700 hover:bg-sky-100", tag: "text-sky-700 bg-sky-50" },
  { avatar: "from-violet-400 to-purple-600", chip: "bg-violet-50 text-violet-700 hover:bg-violet-100", tag: "text-violet-700 bg-violet-50" },
  { avatar: "from-rose-400 to-pink-600", chip: "bg-rose-50 text-rose-700 hover:bg-rose-100", tag: "text-rose-700 bg-rose-50" },
  { avatar: "from-amber-400 to-orange-600", chip: "bg-amber-50 text-amber-700 hover:bg-amber-100", tag: "text-amber-700 bg-amber-50" },
  { avatar: "from-emerald-400 to-teal-600", chip: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100", tag: "text-emerald-700 bg-emerald-50" },
];

const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (key: string, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow"
    : new Date(`${key}T00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const initials = (name: string) =>
  name.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function DoctorsPanel({ doctors }: { doctors: Doctor[] }) {
  const [speciality, setSpeciality] = useState<string>("all");
  const [day, setDay] = useState(0);

  const specialities = useMemo(() => [...new Set(doctors.map((d) => d.speciality))], [doctors]);
  // Next 7 calendar days starting today, so the selector is stable even if a day is fully booked.
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
    [],
  );
  const shown = speciality === "all" ? doctors : doctors.filter((d) => d.speciality === speciality);

  return (
    <Card
      title="Doctors & free slots"
      icon={<StethoscopeIcon />}
      delay={160}
      extra={<span className="text-xs text-slate-400">{doctors.reduce((n, d) => n + d.slots.length, 0)} free slots this week</span>}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["all", ...specialities].map((s) => (
          <button
            key={s}
            onClick={() => setSpeciality(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              speciality === s ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {s === "all" ? "All specialities" : s}
          </button>
        ))}
      </div>

      <div className="scroll-thin mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {days.map((k, i) => (
          <button
            key={k}
            onClick={() => setDay(i)}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              day === i
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            {dayLabel(k, i)}
          </button>
        ))}
      </div>

      {doctors.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}
        </div>
      ) : (
        <div key={`${speciality}-${day}`} className="grid gap-3 md:grid-cols-2">
          {shown.map((d, i) => {
            const c = PALETTE[specialities.indexOf(d.speciality) % PALETTE.length];
            const slots = d.slots.filter((s) => dayKey(s.start_time) === days[day]);
            return (
              <div
                key={d.id}
                style={{ animationDelay: `${i * 50}ms` }}
                className="animate-fade-up group rounded-xl border border-slate-100 bg-white p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/60"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br ${c.avatar} text-sm font-semibold text-white shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                    {initials(d.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{d.name}</div>
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${c.tag}`}>{d.speciality}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {slots.length}
                  </span>
                </div>
                {slots.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 py-2 text-center text-xs text-slate-400">No free slots this day</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {slots.map((s) => (
                      <span key={s.id} className={`animate-pop cursor-default rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${c.chip}`}>
                        {timeLabel(s.start_time)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
