export interface AppointmentNotificationJobData {
  appointmentId: string;
  type: 'created' | 'cancelled' | 'reminder';
  tenantId: string;
  clientId: string;
  psychologistId: string;
  reason?: string;
  videoMeetingUrl?: string;
}
