import type { ReactNode } from "react";

type Props = { title: string; icon?: ReactNode; extra?: ReactNode; children: ReactNode; delay?: number };

export default function Card({ title, icon, extra, children, delay = 0 }: Props) {
  return (
    <section
      style={{ animationDelay: `${delay}ms` }}
      className="animate-fade-up rounded-2xl border border-white/70 bg-white/80 p-5 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-12px_rgb(15_23_42/0.12)] backdrop-blur-xl transition-shadow hover:shadow-[0_1px_2px_rgb(15_23_42/0.04),0_16px_40px_-16px_rgb(15_23_42/0.18)]"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          {icon && <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600">{icon}</span>}
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
