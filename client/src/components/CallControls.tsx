import { usePipecatClient, usePipecatClientTransportState, VoiceVisualizer } from "@pipecat-ai/client-react";
import { useEffect, useState } from "react";
import type { Activity } from "../useActivity";
import { MicIcon, PhoneOffIcon } from "./icons";

type Props = { activity: Activity; onStart: () => void; onError: (message: string) => void };

const LABEL: Record<Activity, string> = {
  idle: "Tap to call Maya",
  listening: "Listening… go ahead",
  user: "You're speaking",
  thinking: "Maya is thinking…",
  bot: "Maya is speaking",
};

/** mm:ss since the call became ready. */
function useCallTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function CallControls({ activity, onStart, onError }: Props) {
  const client = usePipecatClient();
  const state = usePipecatClientTransportState();
  const idle = state === "disconnected" || state === "error";
  const ready = state === "ready";
  const connecting = !idle && !ready;
  const timer = useCallTimer(ready);

  const start = async () => {
    onStart();
    try {
      await client?.connect({ webrtcRequestParams: { endpoint: "/api/offer" } });
    } catch (e) {
      onError(`Could not start the call: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const ring = activity === "bot" ? "bg-sky-400" : activity === "user" ? "bg-emerald-400" : "bg-violet-400";

  return (
    <section className="animate-fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl shadow-indigo-950/20">
      {/* soft moving glow */}
      <div className="animate-float pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="animate-float pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl [animation-delay:-7s]" />

      <div className="relative flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 font-medium uppercase tracking-widest text-white/60">
          <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" : connecting ? "animate-pulse bg-amber-400" : "bg-white/30"}`} />
          {ready ? "Live call" : connecting ? "Connecting" : "Ready"}
        </span>
        <span className={`font-mono tabular-nums text-white/70 transition-opacity ${ready ? "opacity-100" : "opacity-0"}`}>{timer}</span>
      </div>

      <div className="relative mt-6 flex flex-col items-center">
        <div className="relative grid h-32 w-32 place-items-center">
          {ready && (
            <>
              <span className={`animate-ripple absolute inset-0 rounded-full ${ring}`} />
              <span className={`animate-ripple absolute inset-0 rounded-full ${ring} [animation-delay:1.1s]`} />
            </>
          )}
          {connecting && <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/10 border-t-amber-300" />}
          <button
            onClick={idle ? start : () => client?.disconnect()}
            disabled={connecting}
            aria-label={idle ? "Start call" : "End call"}
            className={`relative grid h-24 w-24 place-items-center rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-wait ${
              idle
                ? "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/40"
                : connecting
                  ? "bg-white/10"
                  : "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-600/40"
            }`}
          >
            {idle || connecting ? <MicIcon className="h-9 w-9" /> : <PhoneOffIcon className="h-9 w-9" />}
          </button>
        </div>

        <p key={connecting ? "c" : activity} className="animate-fade-up mt-5 text-lg font-medium">
          {connecting ? "Connecting to Maya…" : LABEL[activity]}
        </p>
        <p className="mt-1 text-xs text-white/50">{idle ? "Start call" : ready ? "Tap the red button to hang up" : "Allow microphone access"}</p>

        {/* live audio bars: Maya (sky) and you (emerald) */}
        <div className={`mt-5 flex h-10 items-center gap-6 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
          {ready && (
            <>
              <div className="flex flex-col items-center gap-1">
                <VoiceVisualizer participantType="bot" barColor="#7dd3fc" barCount={7} barWidth={4} barGap={3} barMaxHeight={28} barOrigin="center" />
                <span className="text-[10px] uppercase tracking-wider text-white/40">Maya</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <VoiceVisualizer participantType="local" barColor="#6ee7b7" barCount={7} barWidth={4} barGap={3} barMaxHeight={28} barOrigin="center" />
                <span className="text-[10px] uppercase tracking-wider text-white/40">You</span>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="relative mt-4 border-t border-white/10 pt-3 text-center text-[11px] leading-relaxed text-white/45">
        No login needed. Maya identifies you only by the phone number you say.
      </p>
    </section>
  );
}
