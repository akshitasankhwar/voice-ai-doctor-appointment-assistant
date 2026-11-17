"""Voice pipeline: browser mic -> Silero VAD -> ElevenLabs STT -> Gemini (+tools) -> ElevenLabs TTS."""

import os

import aiohttp
from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.workers.runner import WorkerRunner

from app.prompts import system_prompt
from app.tools import HANDLERS, TOOLS

DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # ElevenLabs premade "Sarah" (works on the free plan)
DEFAULT_MODEL = "gemini-2.5-flash"


def _llm() -> GoogleLLMService:
    llm = GoogleLLMService(
        api_key=os.environ["GOOGLE_API_KEY"],
        settings=GoogleLLMService.Settings(
            model=os.getenv("GOOGLE_MODEL") or DEFAULT_MODEL, system_instruction=system_prompt()
        ),
    )
    for name, handler in HANDLERS.items():
        llm.register_function(name, handler)
    return llm


async def run_bot(webrtc_connection: SmallWebRTCConnection) -> None:
    """Run one call for one browser connection, until the caller hangs up."""
    transport = SmallWebRTCTransport(
        webrtc_connection=webrtc_connection,
        params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    )

    async with aiohttp.ClientSession() as session:
        stt = ElevenLabsSTTService(api_key=os.environ["ELEVENLABS_API_KEY"], aiohttp_session=session)
        tts = ElevenLabsTTSService(
            api_key=os.environ["ELEVENLABS_API_KEY"],
            settings=ElevenLabsTTSService.Settings(
                voice=os.getenv("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE_ID
            ),
        )
        llm = _llm()

        # Gemini needs at least one user turn before it will speak, so seed one.
        context = LLMContext(
            messages=[{"role": "user", "content": "(Caller connected. Greet them briefly.)"}],
            tools=TOOLS,
        )
        aggregators = LLMContextAggregatorPair(context)

        pipeline = Pipeline(
            [
                transport.input(),
                VADProcessor(vad_analyzer=SileroVADAnalyzer()),
                stt,
                aggregators.user(),
                llm,
                tts,
                transport.output(),
                aggregators.assistant(),
            ]
        )
        worker = PipelineWorker(
            pipeline,
            params=PipelineParams(enable_metrics=True),
            idle_timeout_secs=300,
        )

        @transport.event_handler("on_client_connected")
        async def on_connected(_transport, _client):
            logger.info("Caller connected")
            await worker.queue_frames([LLMRunFrame()])

        @transport.event_handler("on_client_disconnected")
        async def on_disconnected(_transport, _client):
            logger.info("Caller disconnected")
            await worker.cancel()

        await WorkerRunner(handle_sigint=False).run(worker)
