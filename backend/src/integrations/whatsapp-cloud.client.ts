import axios from 'axios';
import { env } from '@/config/env';

const http = axios.create({
  baseURL: env.WHATSAPP_CLOUD_API_URL,
  headers: { Authorization: `Bearer ${env.WHATSAPP_CLOUD_ACCESS_TOKEN ?? ''}` },
  timeout: 30_000,
});

export const whatsappCloud = {
  listPhoneNumbers() {
    return http.get(`/${env.WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID}/phone_numbers`).then((r) => r.data);
  },

  listTemplates() {
    return http.get(`/${env.WHATSAPP_CLOUD_BUSINESS_ACCOUNT_ID}/message_templates`).then((r) => r.data);
  },

  sendTemplate(phoneNumberId: string, to: string, template: { name: string; language: string; components?: unknown[] }) {
    return http
      .post(`/${phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template.name, language: { code: template.language }, components: template.components },
      })
      .then((r) => r.data);
  },
};
