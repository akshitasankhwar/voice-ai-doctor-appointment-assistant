import { type BotOutputData, RTVIEvent, type TranscriptData } from "@pipecat-ai/client-js";
import { usePipecatClientTransportState, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { fetchAppointments, fetchDoctors } from "./api";
import AppointmentsPanel from "./components/AppointmentsPanel";
import CallControls from "./components/CallControls";
import DoctorsPanel from "./components/DoctorsPanel";
import { CalendarIcon, ClockIcon, StethoscopeIcon, XIcon } from "./components/icons";
import Transcript from "./components/Transcript";
import type { Appointment, Doctor, Line } from "./types";
import { useActivity } from "./useActivity";

function Stat({ label, value, icon, tone, delay }: { label: string; value: number; icon: ReactNode; tone: string; delay: number }) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-up flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}>{icon}</span>
      <div>
        <div key={value} className="animate-pop text-xl font-semibold tabular-nums text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const state = usePipecatClientTransportState();
  const activity = useActivity();

  const refresh = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([fetchDoctors(), fetchAppointments()]);
      setDoctors(d);
      setAppointments(a);
      setError(null);
    } catch {
      setError("Cannot reach the server. Is it running on port 7860?");
    }
  }, []);

  // Load on mount, and again whenever a call ends.
  useEffect(() => {
    if (state === "disconnected") void refresh();
  }, [state, refresh]);

  // Same speaker still talking -> extend their last bubble; otherwise start a new one.
  const add = useCallback((role: Line["role"], text: string) => {
    if (!text?.trim()) return;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === role) {
        return [...prev.slice(0, -1), { role, text: `${last.text} ${text.trim()}` }];
      }
      return [...prev, { role, text: text.trim() }];
    });
  }, []);

  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    useCallback((d: TranscriptData) => { if (d.final) add("user", d.text); }, [add]),
  );
  useRTVIClientEvent(
    RTVIEvent.BotOutput,
    // Pipecat sends each sentence once as "new", then re-sends the whole sentence
    // with every spoken word ("in-progress" / "completed"). Keep only the first.
    useCallback((d: BotOutputData) => {
      if (d.spoken_status && d.spoken_status !== "new") return;
      add("bot", d.text);
    }, [add]),
  );
  useRTVIClientEvent(
    RTVIEvent.ServerMessage,
    useCallback((d: { type?: string }) => { if (d?.type === "data_changed") void refresh(); }, [refresh]),
  );

  const active = appointments.filter((a) => a.status === "booked").length;
  const freeSlots = doctors.reduce((n, d) => n + d.slots.length, 0);
  const live = state === "ready";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft floating background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-float absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
        <div style={{ animationDelay: "-5s" }} className="animate-float absolute -right-24 top-40 h-[28rem] w-[28rem] rounded-full bg-sky-300/30 blur-3xl" />
        <div style={{ animationDelay: "-9s" }} className="animate-float absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="animate-fade-up mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/30">
              <StethoscopeIcon className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                City Care Clinic{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">· Voice Receptionist</span>
              </h1>
              <p className="text-sm text-slate-500">Call Maya to check doctor availability, book or cancel an appointment.</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ring-1 transition-colors ${
              live ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white/80 text-slate-500 ring-slate-200"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-300"}`} />
            </span>
            {live ? "Call in progress" : "Maya is available"}
          </span>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Active bookings" value={active} icon={<CalendarIcon className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-600" delay={40} />
          <Stat label="Doctors" value={doctors.length} icon={<StethoscopeIcon className="h-5 w-5" />} tone="bg-indigo-50 text-indigo-600" delay={80} />
          <Stat label="Free slots this week" value={freeSlots} icon={<ClockIcon className="h-5 w-5" />} tone="bg-sky-50 text-sky-600" delay={120} />
          <Stat label="Cancelled" value={appointments.length - active} icon={<XIcon className="h-5 w-5" />} tone="bg-rose-50 text-rose-600" delay={160} />
        </div>

        {error && (
          <div className="animate-pop mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 p-3 text-sm text-red-700 shadow-sm">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="rounded-md p-1 hover:bg-red-100" aria-label="Dismiss">
              <XIcon />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <CallControls activity={activity} onStart={() => setLines([])} onError={setError} />
            <Transcript lines={lines} activity={activity} />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <AppointmentsPanel appointments={appointments} />
            <DoctorsPanel doctors={doctors} />
          </div>
        </div>
      </div>
    </div>
  );
}
