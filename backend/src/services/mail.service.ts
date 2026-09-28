import type { Mailer } from '@/lib/mailer';

export interface Recipient {
  name: string;
  email: string;
}

export interface IMailService {
  sendPasswordResetEmail(to: Recipient, link: string, validForMinutes: number): Promise<void>;
}

export class MailService implements IMailService {
  constructor(
    private readonly mailer: Mailer,
    private readonly appName: string,
  ) {}

  async sendPasswordResetEmail(to: Recipient, link: string, validForMinutes: number): Promise<void> {
    const name = this.escapeHtml(to.name);
    const appName = this.escapeHtml(this.appName);
    await this.mailer.sendMail({
      to: to.email,
      subject: `Redefinição de senha - ${this.appName}`,
      text: `Olá, ${to.name}.\n\nPara redefinir sua senha, acesse: ${link}\n\nO link expira em ${validForMinutes} minutos. Se você não solicitou, ignore este e-mail.`,
      html: `
        <p>Olá, ${name}.</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no ${appName}.</p>
        <p><a href="${link}">Clique aqui para criar uma nova senha</a></p>
        <p>O link expira em ${validForMinutes} minutos. Se você não solicitou, ignore este e-mail.</p>
      `,
    });
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  }
}
