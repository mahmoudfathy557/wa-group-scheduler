import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let cachedSocket: Socket | null = null;

export function getSocket(): Socket | null {
  const token = localStorage.getItem("token");
  if (!token) return null;
  if (cachedSocket && cachedSocket.connected) return cachedSocket;

  const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
  cachedSocket = io(`${url}/whatsapp`, {
    auth: { token },
    transports: ["websocket", "polling"]
  });
  return cachedSocket;
}

export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    const fn = (d: T) => handlerRef.current(d);
    sock.on(event, fn);
    return () => {
      sock.off(event, fn);
    };
  }, [event]);
}
