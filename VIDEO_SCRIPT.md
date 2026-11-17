# Demo video script (target: 2:45, hard limit 3:00)

**Before you hit record**
- Server running (`python main.py` in `server/`), dashboard open at http://localhost:5173.
- Close other tabs, silence notifications, use headphones so Maya's voice doesn't echo into the mic.
- The Gemini free tier has a small daily quota: do **at most one** rehearsal call, then record.
- Screen layout: dashboard full screen; have VS Code ready with `server/app/tools.py` and `README.md` open.
- If something goes wrong mid-call, keep going calmly. Recovering on camera looks good.

---

## 1. Intro (0:00 – 0:20), on the dashboard

> "Hi, I'm Akshita. This is my submission for the SDE Intern Round 1: a voice AI receptionist for a
> doctor's clinic. Patients call Maya, the assistant, to check doctor availability, book and cancel
> appointments, all by voice, in real time."

## 2. Stack and architecture (0:20 – 0:45), show the Architecture section of README.md

> "It's built on Pipecat. Audio comes in over WebRTC, Silero VAD detects when I stop speaking,
> ElevenLabs transcribes it, Google Gemini 3.5 Flash-Lite on the free tier decides what to do and
> calls tools, and ElevenLabs speaks the reply. The tools read and write a SQLite database, and the
> React dashboard updates live whenever a booking changes."

## 3. Live demo: book (0:45 – 1:50), back on the dashboard

> "Let me call Maya." *(click **Start call**, then wait for her greeting)*

You say, pausing after each line until she answers:
1. "Hi, I'd like to see a cardiologist tomorrow."
   *(She checks availability and offers two or three times with Dr. Rohan Mehta.)*
2. "The first one works." *(or pick any time she offers)*
3. When she asks for your number: "98765 43210."
   *(She reads it back digit by digit.)* "Yes, that's right."
4. When she asks for the patient's name: "Akshita Sankhwar."
5. When she summarises the booking: "Yes, please book it."

Point at the screen while you say:
> "The appointment just appeared in the table, and that slot is gone from Dr. Mehta's free slots.
> No page refresh: the server pushes an update to the dashboard."

## 4. Live demo: cancel and guardrail (1:50 – 2:20), same call

6. "Actually, I need to cancel that appointment."
   *(She uses your confirmed number, finds the booking and asks you to confirm.)* "Yes, cancel it."
> "It's marked cancelled and the slot is free again."
7. Optional, only if you're under 2:10: "Should I take aspirin for chest pain?"
   *(She politely declines medical advice.)*
8. "No, that's all, thank you." *(click **End call**)*

## 5. Under the hood (2:20 – 2:45), VS Code, `server/app/tools.py`

Scroll slowly to `book_appointment` while you say:
> "A few design choices: the model can only act through four tools, so it can't invent
> availability. Booking needs `confirmed=true`, which means Maya must read back the details first.
> The slot is claimed with a single atomic UPDATE, so two callers can never get the same slot.
> Callers are identified by their confirmed phone number."

## 6. Close (2:45 – 2:55)

> "Everything runs on free tiers. Setup steps and a `.env.example` are in the README. Thanks for
> watching!"

---

**If you run long:** drop step 7 first, then shorten section 5 to one sentence.
**If Maya mishears the number:** say "No, it's 9 8 7 6 5, 4 3 2 1 0" slowly. That shows the confirmation step working.
