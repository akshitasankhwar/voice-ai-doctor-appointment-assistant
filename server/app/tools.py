"""LLM tools: schemas + handlers for availability, booking and cancellation."""

import re
from datetime import datetime

from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.adapters.llm.schemas.tools_schema import ToolsSchema
from pipecat.processors.frameworks.rtvi.frames import RTVIServerMessageFrame
from pipecat.services.llm_service import FunctionCallParams

from app.db import connect, now_str

MAX_SLOTS_PER_DOCTOR = 6


def normalize_phone(raw: str) -> str | None:
    """Return a 10-digit mobile number, or None if it isn't one."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if len(digits) == 10 else None


def _pretty(start_time: str) -> str:
    return datetime.strptime(start_time, "%Y-%m-%dT%H:%M").strftime("%A %d %B, %I:%M %p")


async def _notify_dashboard(params: FunctionCallParams) -> None:
    """Tell the browser client that appointments/slots changed so it refetches."""
    await params.llm.push_frame(RTVIServerMessageFrame(data={"type": "data_changed"}))


# ---------- handlers ----------


async def identify_caller(params: FunctionCallParams):
    """Look the caller up by phone number: returning patient (name + upcoming visits) or new."""
    phone = normalize_phone(params.arguments.get("phone_number"))
    if not phone:
        return await params.result_callback({"error": "Invalid phone number; need 10 digits."})

    with connect() as conn:
        last = conn.execute(
            "SELECT patient_name FROM appointments WHERE phone = ? ORDER BY id DESC LIMIT 1",
            (phone,),
        ).fetchone()
        upcoming = conn.execute(
            "SELECT a.id, s.start_time, d.name FROM appointments a"
            " JOIN slots s ON s.id = a.slot_id JOIN doctors d ON d.id = a.doctor_id"
            " WHERE a.phone = ? AND a.status = 'booked' AND s.start_time > ?"
            " ORDER BY s.start_time",
            (phone, now_str()),
        ).fetchall()

    if not last:
        return await params.result_callback(
            {"known_caller": False, "message": "New caller. Ask for the patient's name when booking."}
        )
    await params.result_callback(
        {
            "known_caller": True,
            "name": last["patient_name"],
            "upcoming_appointments": [
                {"appointment_id": a["id"], "doctor": a["name"], "time": _pretty(a["start_time"])}
                for a in upcoming
            ],
        }
    )


async def check_doctor_availability(params: FunctionCallParams):
    args = params.arguments
    sql = (
        "SELECT s.id AS slot_id, s.start_time, d.name, d.speciality FROM slots s"
        " JOIN doctors d ON d.id = s.doctor_id WHERE s.is_booked = 0 AND s.start_time > ?"
    )
    values: list = [now_str()]
    if args.get("doctor_name"):
        name = re.sub(r"(?i)\b(dr\.?|doctor)\s*", "", args["doctor_name"]).strip().lower()
        sql += " AND lower(d.name) LIKE ?"
        values.append(f"%{name}%")
    if args.get("speciality"):
        sql += " AND lower(d.speciality) LIKE ?"
        values.append(f"%{args['speciality'].lower()[:6]}%")  # tolerant: 'cardio', 'dermat'
    if args.get("date"):
        sql += " AND substr(s.start_time, 1, 10) = ?"
        values.append(args["date"])
    sql += " ORDER BY d.name, s.start_time"

    with connect() as conn:
        rows = conn.execute(sql, values).fetchall()

    by_doctor: dict[str, dict] = {}
    for r in rows:
        doc = by_doctor.setdefault(
            r["name"], {"doctor": r["name"], "speciality": r["speciality"], "slots": []}
        )
        if len(doc["slots"]) < MAX_SLOTS_PER_DOCTOR:
            doc["slots"].append({"slot_id": r["slot_id"], "time": _pretty(r["start_time"])})

    if not by_doctor:
        await params.result_callback(
            {"available": [], "message": "No free slots match. Suggest another day or doctor."}
        )
    else:
        await params.result_callback({"available": list(by_doctor.values())})


async def book_appointment(params: FunctionCallParams):
    args = params.arguments
    phone = normalize_phone(args.get("phone_number"))
    if not phone:
        return await params.result_callback({"error": "Invalid phone number; need 10 digits."})
    if not args.get("confirmed"):
        return await params.result_callback(
            {"error": "Confirm the phone number and booking details with the caller first."}
        )

    with connect() as conn:
        slot = conn.execute(
            "SELECT s.id, s.start_time, s.doctor_id, d.name FROM slots s"
            " JOIN doctors d ON d.id = s.doctor_id WHERE s.id = ?",
            (args.get("slot_id"),),
        ).fetchone()
        if not slot or slot["start_time"] <= now_str():
            return await params.result_callback(
                {"error": "That slot does not exist. Check availability again."}
            )
        # Atomic claim: succeeds only if nobody booked it in the meantime.
        claimed = conn.execute(
            "UPDATE slots SET is_booked = 1 WHERE id = ? AND is_booked = 0", (slot["id"],)
        ).rowcount
        if not claimed:
            return await params.result_callback(
                {"error": "That slot was just taken. Offer another time."}
            )
        appt_id = conn.execute(
            "INSERT INTO appointments (slot_id, doctor_id, patient_name, phone) VALUES (?, ?, ?, ?)",
            (slot["id"], slot["doctor_id"], (args.get("patient_name") or "Patient").strip(), phone),
        ).lastrowid

    await _notify_dashboard(params)
    await params.result_callback(
        {
            "success": True,
            "appointment_id": appt_id,
            "doctor": slot["name"],
            "time": _pretty(slot["start_time"]),
        }
    )


async def cancel_appointment(params: FunctionCallParams):
    args = params.arguments
    phone = normalize_phone(args.get("phone_number"))
    if not phone:
        return await params.result_callback({"error": "Invalid phone number; need 10 digits."})

    with connect() as conn:
        upcoming = conn.execute(
            "SELECT a.id, a.slot_id, s.start_time, d.name FROM appointments a"
            " JOIN slots s ON s.id = a.slot_id JOIN doctors d ON d.id = a.doctor_id"
            " WHERE a.phone = ? AND a.status = 'booked' AND s.start_time > ?"
            " ORDER BY s.start_time",
            (phone, now_str()),
        ).fetchall()
        if not upcoming:
            return await params.result_callback(
                {"error": "No upcoming appointments found for this number."}
            )

        appt_id = args.get("appointment_id")
        if appt_id is None and len(upcoming) == 1:
            appt_id = upcoming[0]["id"]
        target = next((a for a in upcoming if a["id"] == appt_id), None)
        if target is None or not args.get("confirmed"):
            listing = [
                {"appointment_id": a["id"], "doctor": a["name"], "time": _pretty(a["start_time"])}
                for a in upcoming
            ]
            return await params.result_callback(
                {
                    "needs_confirmation": True,
                    "appointments": listing,
                    "message": "Confirm with the caller which appointment to cancel, "
                    "then call again with appointment_id and confirmed=true.",
                }
            )

        conn.execute("UPDATE appointments SET status = 'cancelled' WHERE id = ?", (target["id"],))
        conn.execute("UPDATE slots SET is_booked = 0 WHERE id = ?", (target["slot_id"],))

    await _notify_dashboard(params)
    await params.result_callback(
        {"success": True, "cancelled": {"doctor": target["name"], "time": _pretty(target["start_time"])}}
    )


# ---------- schemas ----------

_PHONE = {
    "type": "string",
    "description": "Caller's 10-digit mobile number, digits only, as confirmed by the caller.",
}
_CONFIRMED = {
    "type": "boolean",
    "description": "True only after the caller explicitly confirmed the number and details.",
}

TOOLS = ToolsSchema(
    standard_tools=[
        FunctionSchema(
            name="identify_caller",
            description="Identify the caller by their confirmed phone number. Returns whether they "
            "are a returning patient, their name and upcoming appointments.",
            properties={"phone_number": _PHONE},
            required=["phone_number"],
        ),
        FunctionSchema(
            name="check_doctor_availability",
            description="List free appointment slots, filtered by doctor name, speciality and/or date.",
            properties={
                "doctor_name": {"type": "string", "description": "Doctor's name, e.g. 'Mehta'."},
                "speciality": {"type": "string", "description": "e.g. 'Cardiologist'."},
                "date": {"type": "string", "description": "Date as YYYY-MM-DD."},
            },
            required=[],
        ),
        FunctionSchema(
            name="book_appointment",
            description="Book a slot (from check_doctor_availability) for the caller.",
            properties={
                "phone_number": _PHONE,
                "patient_name": {"type": "string", "description": "Patient's name."},
                "slot_id": {"type": "integer", "description": "slot_id from check_doctor_availability."},
                "confirmed": _CONFIRMED,
            },
            required=["phone_number", "patient_name", "slot_id", "confirmed"],
        ),
        FunctionSchema(
            name="cancel_appointment",
            description="Cancel the caller's upcoming appointment. If it is ambiguous or not yet "
            "confirmed, returns the caller's bookings instead.",
            properties={
                "phone_number": _PHONE,
                "appointment_id": {"type": "integer", "description": "Which appointment, if several."},
                "confirmed": _CONFIRMED,
            },
            required=["phone_number", "confirmed"],
        ),
    ]
)

HANDLERS = {
    "identify_caller": identify_caller,
    "check_doctor_availability": check_doctor_availability,
    "book_appointment": book_appointment,
    "cancel_appointment": cancel_appointment,
}
