// Small inline SVG icons (stroke = currentColor) so the bundle needs no icon library.
type P = { className?: string };
const base = (className = "h-4 w-4") => ({
  className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const MicIcon = ({ className }: P) => (
  <svg {...base(className)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" /></svg>
);
export const PhoneOffIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M10.7 13.3a16 16 0 0 0 3.4 2.6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.8 2v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8" /><path d="M22 2 2 22" /></svg>
);
export const ChatIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
export const CalendarIcon = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
);
export const StethoscopeIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M5 3v6a5 5 0 0 0 10 0V3M5 3H3m2 0h2m8 0h-2m2 0h2M10 14v2a5 5 0 0 0 10 0v-3" /><circle cx="20" cy="11" r="2" /></svg>
);
export const ClockIcon = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);
export const CheckIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const XIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const PulseIcon = ({ className }: P) => (
  <svg {...base(className)}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
