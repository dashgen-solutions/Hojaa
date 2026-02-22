"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

/** Convert http(s):// to ws(s):// */
const toWsUrl = (httpUrl: string) =>
  httpUrl.replace(/^http/, "ws");

export interface OnlineUser {
  user_id: string;
  username: string;
  connected_at: string;
}

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

interface UseWebSocketOptions {
  sessionId: string | null;
  token: string | null;
  onMessage?: (msg: WSMessage) => void;
  enabled?: boolean;
}

/**
 * React hook for real-time collaboration via WebSocket.
 *
 * Provides:
 * - Auto-connect / reconnect with exponential back-off
 * - Heartbeat keep-alive
 * - Presence tracking (online_users)
 * - Generic sendMessage for cursor / typing / lock
 */
export function useWebSocket({
  sessionId,
  token,
  onMessage,
  enabled = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

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
    if (!sessionId || !token || !enabled) return;

    cleanup();

    const wsUrl = `${toWsUrl(API_URL)}/api/ws/${sessionId}?token=${encodeURIComponent(token)}`;
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

        // Track presence
        if (msg.type === "presence" && Array.isArray(msg.online_users)) {
          setOnlineUsers(msg.online_users as OnlineUser[]);
        }

        onMessage?.(msg);
      } catch {
        // ignore malformed JSON
      }
    };

    ws.onclose = () => {
      setConnected(false);

      // Exponential back-off reconnect: 1s, 2s, 4s, 8s, … max 30s
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
      retriesRef.current += 1;
      reconnectRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, token, enabled, onMessage, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const sendMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { connected, onlineUsers, sendMessage };
}
