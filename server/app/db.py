"""SQLite storage: schema, mock doctors, and a rolling 7-day slot calendar."""

import os
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta

DB_PATH = os.getenv("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "clinic.db"))

# name, speciality, working hours (start, end) — 30-minute slots, Mon–Sat
DOCTORS = [
    ("Dr. Ananya Sharma", "General Physician", (9, 13)),
    ("Dr. Rohan Mehta", "Cardiologist", (10, 14)),
    ("Dr. Priya Nair", "Dermatologist", (14, 18)),
    ("Dr. Arjun Rao", "Pediatrician", (9, 12)),
    ("Dr. Kavita Iyer", "Orthopedic", (11, 16)),
]
DAYS_AHEAD = 7

SCHEMA = """
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, speciality TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY, doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    start_time TEXT NOT NULL, is_booked INTEGER NOT NULL DEFAULT 0,
    UNIQUE (doctor_id, start_time));
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY, slot_id INTEGER NOT NULL REFERENCES slots(id),
    doctor_id INTEGER NOT NULL REFERENCES doctors(id), patient_name TEXT NOT NULL,
    phone TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')));
CREATE INDEX IF NOT EXISTS idx_appt_phone ON appointments(phone, status);
"""


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables, seed doctors, and top up slots for the next DAYS_AHEAD days."""
    with connect() as conn:
        conn.executescript(SCHEMA)
        for name, speciality, _ in DOCTORS:
            conn.execute(
                "INSERT OR IGNORE INTO doctors (name, speciality) VALUES (?, ?)", (name, speciality)
            )
        for name, _, (start_h, end_h) in DOCTORS:
            (doctor_id,) = conn.execute("SELECT id FROM doctors WHERE name = ?", (name,)).fetchone()
            for offset in range(DAYS_AHEAD):
                day = date.today() + timedelta(days=offset)
                if day.weekday() == 6:  # clinic closed on Sunday
                    continue
                t = datetime.combine(day, time(start_h))
                while t.hour < end_h:
                    conn.execute(
                        "INSERT OR IGNORE INTO slots (doctor_id, start_time) VALUES (?, ?)",
                        (doctor_id, t.strftime("%Y-%m-%dT%H:%M")),
                    )
                    t += timedelta(minutes=30)


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M")


def list_doctors_with_slots() -> list[dict]:
    with connect() as conn:
        doctors = [dict(r) for r in conn.execute("SELECT * FROM doctors ORDER BY id")]
        for d in doctors:
            d["slots"] = [
                dict(r)
                for r in conn.execute(
                    "SELECT id, start_time FROM slots WHERE doctor_id = ? AND is_booked = 0"
                    " AND start_time > ? ORDER BY start_time",
                    (d["id"], now_str()),
                )
            ]
    return doctors


def list_appointments() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT a.id, a.patient_name, a.phone, a.status, a.created_at, s.start_time,"
            " d.name AS doctor_name, d.speciality FROM appointments a"
            " JOIN slots s ON s.id = a.slot_id JOIN doctors d ON d.id = a.doctor_id"
            " ORDER BY a.id DESC"
        )
        return [dict(r) for r in rows]
