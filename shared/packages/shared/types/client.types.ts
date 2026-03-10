/**
 * Danışan CRM types — MASTER_README Section 5.1
 */

export interface CreateClientDto {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string;
  gender?: string;
}

export type UpdateClientDto = Partial<CreateClientDto>;

export interface ClientResponse extends CreateClientDto {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  complaintAreas?: string[];
}
