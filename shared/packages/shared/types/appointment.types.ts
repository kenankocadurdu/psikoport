/**
 * Takvim & Randevu types — MASTER_README Section 6
 */

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

export interface CreateAppointmentDto {
  clientId: string;
  startAt: string;
  endAt: string;
  title?: string;
  notes?: string;
  videoLink?: string;
}

export interface AppointmentResponse extends CreateAppointmentDto {
  id: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}
