"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AvaVoiceVisualMode } from "@/lib/ava/nebula-visual-state";

type RealtimeEvent = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  item?: { call_id?: string; name?: string; arguments?: string };
};

export function useAvaRealtimeVoice() {
  const [mode, setMode] = useState<AvaVoiceVisualMode>("idle");
  const [energy, setEnergy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const animation = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const stop = useCallback(() => {
    if (animation.current) cancelAnimationFrame(animation.current);
    animation.current = null;
    channel.current?.close();
    peer.current?.close();
    stream.current?.getTracks().forEach((track) => track.stop());
    void audioContext.current?.close();
    channel.current = null;
    peer.current = null;
    stream.current = null;
    audioContext.current = null;
    if (audio.current) audio.current.srcObject = null;
    setEnergy(0);
    setActive(false);
    setMode("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    if (channel.current?.readyState === "open") channel.current.send(JSON.stringify(event));
  }, []);

  const routeToolCall = useCallback(async (event: RealtimeEvent) => {
    const call = event.item || event;
    if (call.name !== "request_jarvis_action" || !call.call_id) return;
    setMode("approval_required");
    let requestedAction = "";
    try {
      requestedAction = String(JSON.parse(call.arguments || "{}").request || "");
    } catch {
      requestedAction = "";
    }
    const response = await fetch("/api/jarvis/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: requestedAction }),
    });
    const result = await response.json().catch(() => ({ message: "I could not route that request." }));
    const output = JSON.stringify({
      status: result.status || (result.approval ? "approval_required" : "complete"),
      message: result.message || "The request was routed through Jarvis.",
      approval: result.approval || null,
    });
    sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output } });
    sendEvent({ type: "response.create" });
  }, [sendEvent]);

  const handleRealtimeEvent = useCallback((raw: MessageEvent<string>) => {
    let event: RealtimeEvent;
    try { event = JSON.parse(raw.data) as RealtimeEvent; } catch { return; }
    if (event.type === "input_audio_buffer.speech_started") setMode("listening");
    if (event.type === "input_audio_buffer.speech_stopped" || event.type === "response.created") setMode("thinking");
    if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") setMode("speaking");
    if (event.type === "response.done") setMode("listening");
    if (event.type === "response.function_call_arguments.done" || event.type === "response.output_item.done") void routeToolCall(event);
    if (event.type === "error") {
      setError("The realtime session reported an error.");
      setMode("error");
    }
  }, [routeToolCall]);

  const startEnergyMeter = useCallback((media: MediaStream) => {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(media).connect(analyser);
    const values = new Uint8Array(analyser.frequencyBinCount);
    audioContext.current = context;
    const tick = () => {
      analyser.getByteFrequencyData(values);
      const average = values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
      setEnergy(Math.min(1, average / 82));
      animation.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    if (peer.current) return stop();
    setError(null);
    setMode("connecting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      const connection = new RTCPeerConnection();
      const dataChannel = connection.createDataChannel("oai-events");
      const output = document.createElement("audio");
      output.autoplay = true;
      connection.ontrack = (event) => { output.srcObject = event.streams[0]; };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === "connected") setMode("listening");
        if (["failed", "disconnected", "closed"].includes(connection.connectionState)) setMode(connection.connectionState === "closed" ? "idle" : "error");
      };
      dataChannel.onmessage = handleRealtimeEvent;
      media.getTracks().forEach((track) => connection.addTrack(track, media));
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      const response = await fetch("/api/ava/realtime", { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp || "" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Voice session failed.");
      await connection.setRemoteDescription({ type: "answer", sdp: await response.text() });
      peer.current = connection;
      channel.current = dataChannel;
      stream.current = media;
      audio.current = output;
      setActive(true);
      startEnergyMeter(media);
    } catch (caught) {
      stop();
      setError(caught instanceof DOMException && caught.name === "NotAllowedError" ? "Microphone access was denied." : caught instanceof Error ? caught.message : "Voice session failed.");
      setMode("error");
    }
  }, [handleRealtimeEvent, startEnergyMeter, stop]);

  return { mode, energy, error, active, start, stop };
}
