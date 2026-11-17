import { useEffect, useRef } from "react";
import type { Line } from "../types";
import type { Activity } from "../useActivity";
import Card from "./Card";
import { ChatIcon } from "./icons";

const Avatar = ({ role }: { role: Line["role"] }) =>
  role === "bot" ? (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-[11px] font-semibold text-white shadow-sm">M</span>
  ) : (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600">You</span>
  );

export default function Transcript({ lines, activity }: { lines: Line[]; activity: Activity }) {
  const end = useRef<HTMLDivElement>(null);
  const thinking = activity === "thinking";
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines, thinking]);

  return (
    <Card
      title="Live transcript"
      icon={<ChatIcon />}
      delay={80}
      extra={lines.length > 0 && <span className="text-xs text-slate-400">{lines.length} turns</span>}
    >
      <div className="scroll-thin h-[26rem] space-y-3 overflow-y-auto pr-1">
        {lines.length === 0 && !thinking && (
          <div className="grid h-full place-items-center text-center">
            <div className="animate-pop">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">
                <ChatIcon className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-600">No conversation yet</p>
              <p className="mt-1 text-xs text-slate-400">Start a call and try “Is Dr. Sharma free tomorrow?”</p>
            </div>
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={`animate-fade-up flex items-end gap-2 ${l.role === "user" ? "flex-row-reverse" : ""}`}>
            <Avatar role={l.role} />
            <div
              className={`max-w-[80%] px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                l.role === "user"
                  ? "rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-indigo-600 text-white"
                  : "rounded-2xl rounded-bl-md border border-slate-100 bg-white text-slate-700"
              }`}
            >
              {l.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="animate-fade-up flex items-end gap-2">
            <Avatar role="bot" />
            <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-100 bg-white px-4 py-3 shadow-sm">
              {[0, 150, 300].map((d) => (
                <span key={d} style={{ animationDelay: `${d}ms` }} className="animate-dot h-1.5 w-1.5 rounded-full bg-indigo-400" />
              ))}
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
    </Card>
  );
}
