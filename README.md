# Voice AI Doctor Appointment Assistant

"Maya" is a voice receptionist for the fictional **City Care Clinic**. You talk to her through your browser. She can check which doctors are free, book an appointment and cancel one, all in the same call. You are identified only by the phone number you say, and she reads it back to confirm before she books or cancels anything.

A dashboard shows the live transcript, each doctor's free slots and the appointments table. The table updates as soon as Maya books or cancels.

## Stack

| Part | Choice |
|---|---|
| Voice pipeline | [Pipecat](https://github.com/pipecat-ai/pipecat) 1.16 (Python) |
| Speech-to-text | ElevenLabs STT |
| **LLM** | **Google Gemini (free tier)** via Pipecat's `GoogleLLMService` with function calling. Set `GOOGLE_MODEL` to pick a different model. |
| Text-to-speech | ElevenLabs TTS |
| Turn detection | Silero VAD (bonus) |
| Audio transport | WebRTC (Pipecat `SmallWebRTCTransport`, browser ↔ server, no third-party room) |
| Backend | FastAPI + SQLite (mock data, seeded automatically) |
| Dashboard | React 19 + Vite + Tailwind, Pipecat client SDK |

## Architecture

```
Browser (React dashboard)                     Python server (FastAPI, :7860)
┌──────────────────────────┐   WebRTC audio    ┌─────────────────────────────────────────────┐
│ Start / End call         │ ◄──────────────►  │ Pipecat pipeline                            │
│ Live transcript  ◄── RTVI events ──────────  │  mic → Silero VAD → ElevenLabs STT          │
│ Appointments table       │                   │      → Gemini LLM ──tools──► SQLite         │
│ Doctors & free slots     │ ◄── REST /api/* ─ │      → ElevenLabs TTS → speaker             │
└──────────────────────────┘                   └─────────────────────────────────────────────┘
```

The LLM can call four tools ([server/app/tools.py](server/app/tools.py)):

- `identify_caller(phone_number)` looks the caller up by their confirmed number. It returns a returning patient's name and upcoming appointments, or says the caller is new.
- `check_doctor_availability(doctor_name?, speciality?, date?)` returns the free slots.
- `book_appointment(phone_number, patient_name, slot_id, confirmed)` books a slot and rejects it if the slot is already taken.
- `cancel_appointment(phone_number, appointment_id?, confirmed)` finds a caller's bookings by phone and cancels the one they choose.

Booking and cancelling both require `confirmed=true`. The model can only set it after the caller has heard their number read back and agreed, so this is enforced in code as well as in the prompt.

After every booking or cancellation the server sends a `data_changed` message to the browser, and the dashboard reloads its tables.

### Project layout

```
server/
  main.py            FastAPI app: REST API + WebRTC signaling (/api/offer)
  app/bot.py         Pipecat pipeline (VAD → STT → LLM → TTS)
  app/tools.py       Function-calling tools + schemas
  app/prompts.py     System prompt (persona, phone confirmation rules)
  app/db.py          SQLite schema, seed data, queries
  app/compat.py      Windows-only fallbacks (see Troubleshooting)
  requirements.txt
client/
  src/App.tsx        Dashboard layout + RTVI event wiring
  src/components/    CallControls, Transcript, AppointmentsPanel, DoctorsPanel, Card, icons
  src/useActivity.ts Who is speaking (user / bot), from RTVI events, drives the animations
  src/api.ts         REST calls to the server
```

## Run it locally

You need **Python 3.12**, **Node 20+**, a **Google AI Studio API key** (free) and an **ElevenLabs API key** (free tier works).

### 1. Server

```bash
cd server
conda create -p .venv python=3.12 -y
conda activate ./.venv
pip install -r requirements.txt
cp .env.example .env
python main.py
```

Open `server/.env` and fill in `GOOGLE_API_KEY` and `ELEVENLABS_API_KEY`. You can use plain `python -m venv .venv` instead of conda if you prefer.

The server runs on http://localhost:7860. It creates `clinic.db` with 5 doctors and 30-minute slots for the next 7 days. Delete the file to reset the data.

### 2. Dashboard

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**, click **Start call** and allow microphone access. Use Chrome or Edge.

### Caller identification

A browser call has no network caller ID (unlike a phone line), so the caller's number is the identity. Maya asks for it, reads it back in groups, and calls `identify_caller` once the caller confirms. A returning caller is greeted by name and reminded of upcoming visits. A new caller is welcomed and asked for their name. Booking and cancelling then reuse the confirmed number. With a telephony transport such as Twilio, the caller's number could be passed in automatically instead.

## Try it: book, then cancel, in one call

1. "Hi, which cardiologists are free tomorrow?" Maya lists the free slots.
2. "Book me with Dr. Rohan Mehta at 10:30." She asks for your name and phone number.
3. "98765 43210." She reads the number back. Say "yes", and she checks whether you are a returning patient. Give your name if asked and confirm the booking. It shows up in the table and the slot disappears.
4. "Actually, cancel that appointment." She confirms your number and the appointment, then cancels it. The table shows it as cancelled.

## Troubleshooting

- **No audio or the call won't connect.** Check that the server is running, that both API keys are set, and that the browser has microphone permission. Errors appear in the server terminal.
- **You can see your own words but the agent is silent.** Check the server log. An ElevenLabs `402 paid_plan_required` means the voice is a Voice Library voice, which free plans can't use through the API. Use a premade voice (the default, Sarah, works). A Gemini `503` means the model is overloaded. The default is `gemini-2.5-flash`.
- **Gemini 429 or quota errors.** The free tier is rate limited. Wait a minute, or set `GOOGLE_MODEL` to another free model.
- **Windows "Application Control policy has blocked this file".** Smart App Control can block a few unsigned native wheels. `app/compat.py` swaps in pure-Python fallbacks for the optional modules involved (`loudness`, `pipecat_resampler` and `sentencex`), so the bot still runs. You don't need to change any security settings.
