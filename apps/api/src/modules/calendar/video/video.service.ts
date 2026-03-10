import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ZoomService } from './zoom.service';
import { GoogleMeetService } from './google-meet.service';
import { VideoProvider } from 'prisma-client';

export interface CreateVideoMeetingInput {
  appointmentId: string;
  psychologistId: string;
  tenantId: string;
  topic: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface CreateVideoMeetingResult {
  meetingUrl: string;
  hostUrl: string;
  meetingId: string;
  provider: VideoProvider;
}

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    private readonly googleMeetService: GoogleMeetService,
  ) {}

  /** tenant.videoProvider'a göre doğru servisi çağırıp meeting oluşturur */
  async createVideoMeeting(
    input: CreateVideoMeetingInput,
  ): Promise<CreateVideoMeetingResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { videoProvider: true },
    });
    if (!tenant) throw new BadRequestException('Tenant bulunamadı');

    const provider = tenant.videoProvider;
    if (provider === VideoProvider.NONE) {
      throw new BadRequestException(
        "Lütfen Ayarlar > Entegrasyonlar'dan video bağlantısını kurun.",
      );
    }

    if (provider === VideoProvider.ZOOM) {
      const integration = await this.prisma.videoIntegration.findFirst({
        where: {
          tenantId: input.tenantId,
          psychologistId: input.psychologistId,
          provider: VideoProvider.ZOOM,
        },
      });
      if (!integration) {
        throw new BadRequestException(
          "Lütfen Ayarlar > Entegrasyonlar'dan Zoom video bağlantısını kurun.",
        );
      }
      const result = await this.zoomService.createMeeting(
        integration.id,
        input.topic,
        input.startTime,
        input.durationMinutes,
      );
      return {
        ...result,
        provider: VideoProvider.ZOOM,
      };
    }

    if (provider === VideoProvider.GOOGLE_MEET) {
      const integration = await this.prisma.calendarIntegration.findFirst({
        where: {
          tenantId: input.tenantId,
          psychologistId: input.psychologistId,
          provider: 'GOOGLE',
        },
      });
      if (!integration) {
        throw new BadRequestException(
          "Lütfen Ayarlar > Entegrasyonlar'dan Google Calendar bağlantısını kurun. Meet linki için Calendar entegrasyonu gerekir.",
        );
      }
      const result = await this.googleMeetService.createMeetEvent(
        integration.id,
        input.topic,
        input.startTime,
        input.endTime,
        input.appointmentId,
      );
      return {
        meetingUrl: result.meetingUrl,
        hostUrl: result.hostUrl,
        meetingId: result.eventId,
        provider: VideoProvider.GOOGLE_MEET,
      };
    }

    throw new BadRequestException(
      "Lütfen Ayarlar > Entegrasyonlar'dan video bağlantısını kurun.",
    );
  }
}
