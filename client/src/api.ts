import type { Appointment, Doctor } from "./types";

const get = async <T,>(path: string): Promise<T> => {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

export const fetchDoctors = () => get<Doctor[]>("/api/doctors");
export const fetchAppointments = () => get<Appointment[]>("/api/appointments");

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  });
