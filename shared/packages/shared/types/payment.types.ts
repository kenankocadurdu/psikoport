/**
 * Finans & Ödeme types — MASTER_README Section 6
 */

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  TRANSFER = 'transfer',
  OTHER = 'other',
}

export interface CreatePaymentDto {
  appointmentId: string;
  amount: number;
  method: PaymentMethod;
  notes?: string;
}

export interface PaymentResponse extends CreatePaymentDto {
  id: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}
