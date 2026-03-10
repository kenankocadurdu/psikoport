import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';

export type EmailJobType =
  | 'appointment-reminder'
  | 'appointment-confirmation'
  | 'form-link'
  | 'crisis-alert'
  | 'payment-reminder'
  | 'invite-email'
  | 'export-ready';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: EmailJobType;
}

@Processor('email', {
  concurrency: 5,
  limiter: { max: 50, duration: 60 * 1000 },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly config: ConfigService) {
    super();
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, html, text } = job.data;

    const from = this.config.get<string>('SENDGRID_FROM', 'bildirim@psikoport.com');

    const msg = {
      to,
      from,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    };

    await sgMail.send(msg);
    this.logger.log(`Email sent to ${to} (${job.data.type})`);
  }
}
