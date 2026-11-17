"""Pure-Python fallbacks for native extensions Pipecat imports.

Windows Smart App Control can block unsigned extension DLLs (`loudness`, `pipecat_resampler`,
`sentencex`). For each one that fails to load we register a small NumPy/regex stand-in with the
same interface. Elsewhere (Linux, macOS, Docker) the real extensions load and nothing is replaced.
Import this module before anything from pipecat.
"""

import importlib
import re
import sys
import types

import numpy as np


def _missing(name: str) -> bool:
    try:
        importlib.import_module(name)
        return False
    except ImportError:
        return True


# ---- loudness: RMS level in dBFS, close enough to LUFS for VAD volume gating ----
if _missing("loudness"):

    def integrated_loudness(samples, sample_rate):  # noqa: ARG001
        rms = float(np.sqrt(np.mean(np.square(samples)))) if len(samples) else 0.0
        return 20 * np.log10(rms) - 0.691 if rms > 1e-6 else float("-inf")

    sys.modules["loudness"] = types.SimpleNamespace(integrated_loudness=integrated_loudness)


# ---- pipecat_resampler: linear-interpolation resampler for mono 16-bit PCM ----
if _missing("pipecat_resampler"):

    def _to_pcm(x: np.ndarray) -> bytes:
        return np.clip(np.round(x), -32768, 32767).astype(np.int16).tobytes()

    class Resampler:
        def __init__(self, in_rate: int, out_rate: int, channels: int = 1):
            self.in_rate, self.out_rate, self.channels = in_rate, out_rate, channels

        def resample(self, audio) -> bytes:
            x = np.frombuffer(bytes(audio), dtype=np.int16).astype(np.float64)
            n_out = round(len(x) * self.out_rate / self.in_rate)
            if not len(x) or not n_out:
                return b""
            t = np.arange(n_out) * (self.in_rate / self.out_rate)
            return _to_pcm(np.interp(t, np.arange(len(x)), x))

    class StreamResampler(Resampler):
        """Keeps the last input sample and the fractional read position between chunks."""

        delay = 1

        def __init__(self, in_rate: int, out_rate: int, channels: int = 1):
            super().__init__(in_rate, out_rate, channels)
            self.reset()

        def reset(self) -> None:
            self._prev: float | None = None
            self._pos = 0.0  # next output position, in input samples relative to _prev

        def process(self, audio) -> bytes:
            x = np.frombuffer(bytes(audio), dtype=np.int16).astype(np.float64)
            if not len(x):
                return b""
            if self._prev is None:
                self._prev, x = x[0], x[1:]
            buf = np.concatenate(([self._prev], x))
            step = self.in_rate / self.out_rate
            t = np.arange(self._pos, len(buf) - 1, step)
            self._pos = (t[-1] + step if len(t) else self._pos) - (len(buf) - 1)
            self._prev = buf[-1]
            return _to_pcm(np.interp(t, np.arange(len(buf)), buf))

        def flush(self) -> bytes:
            out = _to_pcm(np.array([self._prev])) if self._prev is not None else b""
            self.reset()
            return out

    sys.modules["pipecat_resampler"] = types.SimpleNamespace(
        Resampler=Resampler, StreamResampler=StreamResampler
    )


# ---- sentencex: regex sentence splitter (spans keep their trailing whitespace) ----
if _missing("sentencex"):
    _SENTENCE = re.compile(r".+?(?:[.!?…;]+(?=\s|$)|$)\s*", re.S)
    _ABBREV = re.compile(r"(?i)\b(dr|mr|mrs|ms|st|prof|vs|etc|e\.g|i\.e)\.\s*$")

    def segment(language, text):  # noqa: ARG001
        spans, pending = [], ""
        for m in _SENTENCE.finditer(text):
            pending += m.group(0)
            if _ABBREV.search(pending):  # "Dr. Mehta" is not a sentence break
                continue
            spans.append(pending)
            pending = ""
        if pending:
            spans.append(pending)
        return spans

    sys.modules["sentencex"] = types.SimpleNamespace(segment=segment)
