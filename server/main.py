"""FastAPI server: WebRTC signaling for the voice bot + REST data for the dashboard.

Run:  python main.py   (or: uvicorn main:app --port 7860)
"""

import app.compat  # noqa: F401  (must load before pipecat)

import os
from contextlib import asynccontextmanager

import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

load_dotenv(override=True)

from app.bot import run_bot  # noqa: E402
from app.db import init_db, list_appointments, list_doctors_with_slots  # noqa: E402

webrtc = SmallWebRTCRequestHandler()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield
    await webrtc.close()


app = FastAPI(title="City Care Clinic – Voice Receptionist", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/doctors")
def doctors():
    return list_doctors_with_slots()


@app.get("/api/appointments")
def appointments():
    return list_appointments()


@app.post("/api/offer")
async def offer(request: dict, background_tasks: BackgroundTasks):
    """SDP offer from the browser; the bot starts in the background once connected."""

    async def start_bot(connection):
        background_tasks.add_task(run_bot, connection)

    return await webrtc.handle_web_request(
        request=SmallWebRTCRequest.from_dict(request), webrtc_connection_callback=start_bot
    )


@app.patch("/api/offer")
async def ice_candidate(request: SmallWebRTCPatchRequest):
    await webrtc.handle_patch_request(request)
    return {"status": "success"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=os.getenv("HOST", "localhost"), port=int(os.getenv("PORT", 7860)))
