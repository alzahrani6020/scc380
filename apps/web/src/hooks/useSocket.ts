import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  notifications: any[];
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const socket = io('http://localhost:3001/notifications');
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) socket.emit('join-tenant', tenantId);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('notification', (data) => {
      setNotifications((prev) => [data, ...prev]);
    });

    return () => { socket.disconnect(); };
  }, []);

  return { socket: socketRef.current, connected, notifications };
}
