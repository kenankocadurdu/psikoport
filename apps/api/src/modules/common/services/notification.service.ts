import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SmsJobType } from '../../../queue/processors/sms.processor';
import type { EmailJobType } from '../../../queue/processors/email.processor';

const TEMPLATES_DIR = join(__dirname, '../../../templates');

function renderTemplate(templateName: string, data: Record<string, string>): string {
  try {
    const content = readFileSync(join(TEMPLATES_DIR, `${templateName}.html`), 'utf-8');
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
  } catch {
    return '';
  }
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectQueue('sms') private readonly smsQueue: Queue,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  /** Queue'ya SMS job ekler. "Randevunuz var" kullanılır; yasaklı terimler kullanılmaz. */
  async sendSms(
    phone: string,
    message: string,
    type: SmsJobType,
  ): Promise<void> {
    await this.smsQueue.add(type, { phone, message, type }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  /** Queue'ya email job ekler. templateId + data ile HTML oluşturulur. */
  async sendEmail(
    email: string,
    templateId: string,
    data: Record<string, string>,
    type: EmailJobType,
    subject: string,
  ): Promise<void> {
    const html = renderTemplate(templateId, data);
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    await this.emailQueue.add(type, {
      to: email,
      subject,
      html,
      text,
      type,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  /** Doğrudan HTML/text ile email gönderir (template kullanmadan) */
  async sendEmailRaw(
    email: string,
    subject: string,
    html: string,
    text: string,
    type: EmailJobType,
  ): Promise<void> {
    await this.emailQueue.add(type, {
      to: email,
      subject,
      html,
      text,
      type,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
