"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

/** Convert http(s):// to ws(s):// */
const toWsUrl = (httpUrl: string) => httpUrl.replace(/^http/, "ws");

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

interface UseMessagingWebSocketOptions {
  token: string | null;
  onNewMessage?: (msg: WSMessage) => void;
  onTyping?: (msg: WSMessage) => void;
  onChannelUpdate?: (msg: WSMessage) => void;
  onMessageEdited?: (msg: WSMessage) => void;
  onMessageDeleted?: (msg: WSMessage) => void;
  onReactionAdded?: (msg: WSMessage) => void;
  onReactionRemoved?: (msg: WSMessage) => void;
  onThreadReply?: (msg: WSMessage) => void;
  onPresence?: (msg: WSMessage) => void;
  onMessagePinned?: (msg: WSMessage) => void;
  // Call signaling
  onCallIncoming?: (msg: WSMessage) => void;
  onCallAccepted?: (msg: WSMessage) => void;
  onCallRejected?: (msg: WSMessage) => void;
  onCallEnded?: (msg: WSMessage) => void;
  onWebRTCOffer?: (msg: WSMessage) => void;
  onWebRTCAnswer?: (msg: WSMessage) => void;
  onWebRTCIceCandidate?: (msg: WSMessage) => void;
  onGroupCallParticipantJoined?: (msg: WSMessage) => void;
  onGroupCallParticipantLeft?: (msg: WSMessage) => void;
  onStatusUpdate?: (msg: WSMessage) => void;
  enabled?: boolean;
}

/**
 * React hook for real-time messaging via WebSocket.
 *
 * Connects to /api/ws/messaging?token=...
 * Auto-reconnects with exponential back-off.
 * Heartbeat keep-alive every 25s.
 *
 * IMPORTANT: All handler callbacks are stored in a single ref so that
 * the `connect` function identity is stable and the WebSocket is NOT
 * torn down / re-opened when callbacks change between renders.
 */
export function useMessagingWebSocket(opts: UseMessagingWebSocketOptions) {
  const {
    token,
    enabled = true,
  } = opts;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

  // ── Store ALL handlers in a single ref so `connect` never depends on them ──
  const handlersRef = useRef(opts);
  handlersRef.current = opts; // always latest

  const [connected, setConnected] = useState(false);

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (!token || !enabled) return;

    cleanup();

    const wsUrl = `${toWsUrl(API_URL)}/api/messaging/ws/messaging?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;

      // Start heartbeat every 25s
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      }, 25_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        const h = handlersRef.current; // always latest handlers

        switch (msg.type) {
          case "new_message":
            h.onNewMessage?.(msg);
            break;
          case "typing":
            h.onTyping?.(msg);
            break;
          case "channel_update":
            h.onChannelUpdate?.(msg);
            break;
          case "message_edited":
            h.onMessageEdited?.(msg);
            break;
          case "message_deleted":
            h.onMessageDeleted?.(msg);
            break;
          case "reaction_added":
            h.onReactionAdded?.(msg);
            break;
          case "reaction_removed":
            h.onReactionRemoved?.(msg);
            break;
          case "thread_reply":
            h.onThreadReply?.(msg);
            break;
          case "presence":
            h.onPresence?.(msg);
            break;
          case "message_pinned":
            h.onMessagePinned?.(msg);
            break;
          // Call signaling
          case "call_incoming":
            h.onCallIncoming?.(msg);
            break;
          case "call_accepted":
            h.onCallAccepted?.(msg);
            break;
          case "call_rejected":
            h.onCallRejected?.(msg);
            break;
          case "call_ended":
            h.onCallEnded?.(msg);
            break;
          case "webrtc_offer":
            h.onWebRTCOffer?.(msg);
            break;
          case "webrtc_answer":
            h.onWebRTCAnswer?.(msg);
            break;
          case "webrtc_ice_candidate":
            h.onWebRTCIceCandidate?.(msg);
            break;
          case "group_call_participant_joined":
            h.onGroupCallParticipantJoined?.(msg);
            break;
          case "group_call_participant_left":
            h.onGroupCallParticipantLeft?.(msg);
            break;
          case "status_update":
            h.onStatusUpdate?.(msg);
            break;
        }
      } catch {
        // ignore malformed JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);

      // Exponential back-off reconnect: 1s, 2s, 4s, 8s, ... max 30s
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current += 1;
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [token, enabled, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const sendTyping = useCallback(
    (channelId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "typing", channel_id: channelId }));
      }
    },
    [],
  );

  const sendPresenceUpdate = useCallback(
    (status: "online" | "away" | "dnd") => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "presence_update", status }));
      }
    },
    [],
  );

  /** Send raw WS message (used by call signaling) */
  const sendWsMessage = useCallback(
    (data: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    },
    [],
  );

  return { connected, sendTyping, sendPresenceUpdate, sendWsMessage };
}
