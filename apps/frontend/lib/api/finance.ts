import { apiFetch } from "./client";

export interface PaymentListItem {
  id: string;
  tenantId: string;
  clientId: string;
  appointmentId: string;
  psychologistId: string;
  sessionDate: string;
  amount: string | number;
  currency: string;
  status: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED";
  paidAmount: string | number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  invoiceStatus: "NOT_ISSUED" | "ISSUED";
  client: { id: string; firstName: string; lastName: string; phone: string | null };
  psychologist: { id: string; fullName: string };
  appointment: { id: string; startTime: string };
}

export interface PaymentsResponse {
  items: PaymentListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface SummaryResponse {
  totalRevenue: number;
  collected: number;
  pending: number;
  unpaidCount?: number;
  period: string;
  from: string;
  to: string;
}

export interface MonthSummaryResponse {
  total: number;
  collected: number;
  pending: number;
  cancelled: number;
}

export interface ChartDataPoint {
  month: string;
  monthLabel: string;
  totalRevenue: number;
  collected: number;
  pending: number;
}

export interface FinanceSettings {
  id: string;
  defaultSessionFee: number | null;
  currency: string;
  reminderDays: number;
}

export function fetchPayments(params: {
  start?: string;
  end?: string;
  status?: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED";
  clientId?: string;
  appointmentId?: string;
  psychologistId?: string;
  page?: number;
  limit?: number;
}): Promise<PaymentsResponse> {
  const sp = new URLSearchParams();
  if (params.start) sp.set("start", params.start);
  if (params.end) sp.set("end", params.end);
  if (params.status) sp.set("status", params.status);
  if (params.clientId) sp.set("clientId", params.clientId);
  if (params.appointmentId) sp.set("appointmentId", params.appointmentId);
  if (params.psychologistId) sp.set("psychologistId", params.psychologistId);
  if (params.page) sp.set("page", String(params.page));
  if (params.limit) sp.set("limit", String(params.limit));
  return apiFetch<PaymentsResponse>(`/finance/payments?${sp.toString()}`);
}

export function fetchPayment(id: string): Promise<
  PaymentListItem & { invoiceWarning?: string }
> {
  return apiFetch(`/finance/payments/${id}`);
}

export function updatePaymentStatus(
  id: string,
  status: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED",
  paidAmount?: number,
  paymentMethod?: string,
): Promise<{ id: string; status: string; invoiceWarning?: string }> {
  return apiFetch(`/finance/payments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, paidAmount, paymentMethod }),
  });
}

export function fetchSummary(
  period: "weekly" | "monthly"
): Promise<SummaryResponse> {
  return apiFetch<SummaryResponse>(`/finance/summary?period=${period}`);
}

export function fetchMonthSummary(): Promise<MonthSummaryResponse> {
  return apiFetch<MonthSummaryResponse>("/finance/summary/month");
}

export function fetchChartData(months?: number): Promise<ChartDataPoint[]> {
  const sp = months ? `?months=${months}` : "";
  return apiFetch<ChartDataPoint[]>(`/finance/summary/chart${sp}`);
}

export function fetchFinanceSettings(): Promise<FinanceSettings> {
  return apiFetch<FinanceSettings>("/finance/settings");
}
