import axios from 'axios';
import { env } from '@/config/env';

const http = axios.create({
  baseURL: env.EVOLUTION_API_URL,
  headers: { apikey: env.EVOLUTION_API_KEY },
  timeout: 30_000,
});

export const evolution = {
  createInstance(instanceName: string) {
    return http
      .post('/instance/create', { instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true })
      .then((r) => r.data);
  },

  connect(instanceName: string) {
    return http.get(`/instance/connect/${instanceName}`).then((r) => r.data);
  },

  connectionState(instanceName: string) {
    return http.get(`/instance/connectionState/${instanceName}`).then((r) => r.data);
  },

  logout(instanceName: string) {
    return http.delete(`/instance/logout/${instanceName}`).then((r) => r.data);
  },

  sendText(instanceName: string, number: string, text: string) {
    return http.post(`/message/sendText/${instanceName}`, { number, text }).then((r) => r.data);
  },

  sendMedia(
    instanceName: string,
    number: string,
    media: { mediatype: 'image' | 'video' | 'document' | 'audio'; media: string; caption?: string; fileName?: string },
  ) {
    return http.post(`/message/sendMedia/${instanceName}`, { number, ...media }).then((r) => r.data);
  },
};
