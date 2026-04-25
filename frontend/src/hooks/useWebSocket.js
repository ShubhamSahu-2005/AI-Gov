import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useWebSocket() {
  const [socket, setSocket] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Try to connect, but fail gracefully if no socket server exists yet
    const newSocket = io(API_URL, {
      path: '/ws',
      reconnectionAttempts: 3,
      timeout: 2000,
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
    });

    newSocket.on('proposal:new', (data) => {
      setEvents((prev) => [...prev, { type: 'proposal:new', data }]);
    });

    newSocket.on('vote:cast', (data) => {
      setEvents((prev) => [...prev, { type: 'vote:cast', data }]);
    });

    newSocket.on('connect_error', () => {
      // Mute errors if backend isn't supporting WS yet
      newSocket.disconnect();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, events };
}
