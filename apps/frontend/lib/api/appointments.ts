import { apiFetch } from "./client";

export interface AppointmentListItem {
  id: string;
  clientId: string;
  psychologistId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  sessionType: string | null;
  locationType: string;
  client: { firstName: string; lastName: string };
}

export interface AppointmentDetail extends AppointmentListItem {
  videoMeetingUrl: string | null;
  videoHostUrl: string | null;
  videoMeetingId: string | null;
  notes: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  };
  psychologist: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface AppointmentsResponse {
  data: AppointmentListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface AppointmentCalendarParams {
  start: string;
  end: string;
  psychologistId?: string;
}

export function fetchAppointmentsCalendar(
  params: AppointmentCalendarParams
): Promise<AppointmentsResponse> {
  const sp = new URLSearchParams();
  sp.set("start", params.start);
  sp.set("end", params.end);
  if (params.psychologistId) sp.set("psychologistId", params.psychologistId);
  return apiFetch<AppointmentsResponse>(
    `/appointments/calendar?${sp.toString()}`
  );
}

export function fetchAppointment(id: string): Promise<AppointmentDetail> {
  return apiFetch<AppointmentDetail>(`/appointments/${id}`);
}

export interface CreateAppointmentInput {
  clientId: string;
  psychologistId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sessionType?: string;
  locationType?: "IN_PERSON" | "ONLINE";
  notes?: string;
}

export function createAppointment(
  data: CreateAppointmentInput
): Promise<{ id: string; clientId: string; psychologistId: string; startTime: string; endTime: string; status: string }> {
  return apiFetch("/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface UpdateAppointmentInput {
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  sessionType?: string;
  locationType?: "IN_PERSON" | "ONLINE";
  notes?: string;
}

export function updateAppointment(id: string, data: UpdateAppointmentInput): Promise<AppointmentListItem> {
  return apiFetch(`/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function cancelAppointment(id: string, reason?: string): Promise<AppointmentListItem> {
  return apiFetch(`/appointments/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function completeAppointment(id: string): Promise<AppointmentListItem> {
  return apiFetch(`/appointments/${id}/complete`, { method: "POST" });
}

export function noShowAppointment(id: string): Promise<AppointmentListItem> {
  return apiFetch(`/appointments/${id}/no-show`, { method: "POST" });
}

export function fetchClientAppointments(clientId: string): Promise<AppointmentsResponse> {
  return apiFetch<AppointmentsResponse>(`/appointments?clientId=${clientId}&limit=100`);
}

