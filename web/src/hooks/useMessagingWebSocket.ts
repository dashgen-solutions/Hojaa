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
  enabled?: boolean;
}

/**
 * React hook for real-time messaging via WebSocket.
 *
 * Connects to /api/ws/messaging?token=...
 * Auto-reconnects with exponential back-off.
 * Heartbeat keep-alive every 25s.
 */
export function useMessagingWebSocket({
  token,
  onNewMessage,
  onTyping,
  onChannelUpdate,
  onMessageEdited,
  onMessageDeleted,
  enabled = true,
}: UseMessagingWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

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

        switch (msg.type) {
          case "new_message":
            onNewMessage?.(msg);
            break;
          case "typing":
            onTyping?.(msg);
            break;
          case "channel_update":
            onChannelUpdate?.(msg);
            break;
          case "message_edited":
            onMessageEdited?.(msg);
            break;
          case "message_deleted":
            onMessageDeleted?.(msg);
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
  }, [token, enabled, onNewMessage, onTyping, onChannelUpdate, onMessageEdited, onMessageDeleted, cleanup]);

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

  return { connected, sendTyping };
}
