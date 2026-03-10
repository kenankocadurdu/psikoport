import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';

export type SmsJobType =
  | 'appointment-reminder'
  | 'appointment-confirmation'
  | 'form-link'
  | 'crisis-alert'
  | 'payment-reminder';

export interface SmsJobData {
  phone: string;
  message: string;
  type: SmsJobType;
}

@Processor('sms', {
  concurrency: 5,
  limiter: { max: 30, duration: 60 * 1000 },
})
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsProcessor.name);

  constructor(private readonly config: ConfigService) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    const { phone, message } = job.data;

    const username = this.config.get<string>('NETGSM_USERNAME');
    const password = this.config.get<string>('NETGSM_PASSWORD');
    const header = this.config.get<string>('NETGSM_HEADER', 'PSIKOPORT');

    if (!username || !password) {
      this.logger.warn('Netgsm not configured, skipping SMS');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '90');

    const url = 'https://api.netgsm.com.tr/sms/send/get';
    const params = new URLSearchParams({
      usercode: username,
      password,
      gsmno: cleanPhone,
      message,
      msgheader: header,
    });

    const res = await fetch(`${url}?${params}`);
    const text = await res.text();

    if (!res.ok) {
      this.logger.error(`Netgsm SMS failed: ${res.status} ${text}`);
      throw new Error(`Netgsm API error: ${res.status}`);
    }

    this.logger.log(`SMS sent to ${phone} (${job.data.type})`);
  }
}
