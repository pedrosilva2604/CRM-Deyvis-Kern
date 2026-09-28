import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) socket = io({ autoConnect: false, withCredentials: true });
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
