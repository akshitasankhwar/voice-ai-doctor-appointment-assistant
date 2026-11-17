export type Slot = { id: number; start_time: string };
export type Doctor = { id: number; name: string; speciality: string; slots: Slot[] };
export type Appointment = {
  id: number;
  patient_name: string;
  phone: string;
  status: "booked" | "cancelled";
  created_at: string;
  start_time: string;
  doctor_name: string;
  speciality: string;
};
export type Line = { role: "user" | "bot"; text: string };
