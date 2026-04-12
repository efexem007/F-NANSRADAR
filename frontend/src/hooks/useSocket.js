/**
 * FinansRadar — WebSocket / Socket.IO Client Hook
 * Real-time fiyat güncellemeleri ve tarama bildirimleri
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// ─── Global socket instance (singleton) ───────────────────────────────────
let socketInstance = null;
let socketListeners = new Map();

async function getSocket() {
  if (socketInstance?.connected) return socketInstance;

  try {
    const { io } = await import('socket.io-client');
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 5000,
      });

      socketInstance.on('connect', () => {
        console.log('🔌 WebSocket bağlandı:', socketInstance.id);
      });
      socketInstance.on('disconnect', (reason) => {
        console.log('🔌 WebSocket ayrıldı:', reason);
      });
      socketInstance.on('connect_error', (err) => {
        console.warn('🔌 WebSocket bağlanamadı (polling\'e geçildi):', err.message);
      });
    }
    return socketInstance;
  } catch {
    return null;
  }
}

// ─── useSocket Hook ────────────────────────────────────────────────────────
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    getSocket().then(s => {
      if (!mounted || !s) return;
      socketRef.current = s;
      setConnected(s.connected);

      const onConnect    = () => mounted && setConnected(true);
      const onDisconnect = () => mounted && setConnected(false);
      s.on('connect',    onConnect);
      s.on('disconnect', onDisconnect);

      return () => {
        s.off('connect',    onConnect);
        s.off('disconnect', onDisconnect);
      };
    });

    return () => { mounted = false; };
  }, []);

  const subscribe = useCallback((event, handler) => {
    getSocket().then(s => s?.on(event, handler));
    return () => getSocket().then(s => s?.off(event, handler));
  }, []);

  const emit = useCallback((event, data) => {
    getSocket().then(s => s?.emit(event, data));
  }, []);

  return { connected, subscribe, emit, socket: socketRef.current };
}

// ─── useScanNotifications Hook ────────────────────────────────────────────
export function useScanNotifications(onScanComplete) {
  const { subscribe } = useSocket();

  useEffect(() => {
    const unsub = subscribe('scan:complete', (data) => {
      console.log('📡 Tarama tamamlandı:', data);
      onScanComplete?.(data);
    });
    return unsub;
  }, [subscribe, onScanComplete]);
}

// ─── useLivePrices Hook ───────────────────────────────────────────────────
export function useLivePrices(symbols = []) {
  const { subscribe, emit } = useSocket();
  const [prices, setPrices] = useState({});

  useEffect(() => {
    if (symbols.length === 0) return;
    emit('subscribe:prices', symbols);

    const unsub = subscribe('price:update', (update) => {
      setPrices(prev => ({ ...prev, [update.symbol]: update }));
    });
    return unsub;
  }, [symbols.join(','), subscribe, emit]);

  return prices;
}
