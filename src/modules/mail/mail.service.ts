import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import environment from 'src/config/environment';
import { Notice } from 'src/schemas/notice';

@Injectable()
export class MailService {
  private resend: Resend;
  private domain = environment().domain;
  private webHost = environment().webHost;
  private appName = environment().appName;

  constructor() {
    this.resend = new Resend(environment().resend.apiKey);
  }

  async sendMail(to: string, notice: Notice) {
    await this.resend.emails.send({
      from: `${this.appName} <noreply@${this.domain}>`,
      to,
      subject: `[${this.appName}] ${notice.type}`,
      html: this.getHTML(notice.message),
    });
  }

  async sendMailNormal(params: { to: string; subject: string; text: string }) {
    const { to, subject, text } = params;
    await this.resend.emails.send({
      from: `${this.appName} <noreply@${this.domain}>`,
      to,
      subject: `[${this.appName}] ${subject}`,
      html: this.getHTML(text),
    });
  }

  private getHTML(message: string) {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <table width="100%" cellspacing="0" cellpadding="0" style="min-width: 600px; max-width: 840px; margin: auto; background: #fff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #eee; display: flex; align-items: center;">
              <img src="${this.webHost}/logo.png" alt="${this.appName}" 
                   style="width: 40px; height: 40px; border-radius: 50%; margin-right: 12px;" />
              <span style="font-size: 18px; font-weight: bold; color: #333;">${this.appName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; font-size: 14px; color: #444;">
              ${message}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
              © ${new Date().getFullYear()} ${this.appName}. All rights reserved.
            </td>
          </tr>
        </table>
      </div>
    `;
  }
}
