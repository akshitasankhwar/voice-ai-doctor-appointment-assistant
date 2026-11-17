import { RTVIEvent } from "@pipecat-ai/client-js";
import { usePipecatClientTransportState, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { useCallback, useEffect, useState } from "react";

export type Activity = "idle" | "listening" | "user" | "thinking" | "bot";

/** Who is talking right now, derived from Pipecat's VAD speaking events. */
export function useActivity(): Activity {
  const state = usePipecatClientTransportState();
  const [activity, setActivity] = useState<Activity>("idle");

  useEffect(() => {
    setActivity(state === "ready" ? "listening" : "idle");
  }, [state]);

  useRTVIClientEvent(RTVIEvent.UserStartedSpeaking, useCallback(() => setActivity("user"), []));
  // After the caller stops, Maya is transcribing / thinking / calling a tool until she speaks.
  useRTVIClientEvent(RTVIEvent.UserStoppedSpeaking, useCallback(() => setActivity("thinking"), []));
  useRTVIClientEvent(RTVIEvent.BotStartedSpeaking, useCallback(() => setActivity("bot"), []));
  useRTVIClientEvent(RTVIEvent.BotStoppedSpeaking, useCallback(() => setActivity("listening"), []));

  return activity;
}
