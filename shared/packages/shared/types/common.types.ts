/**
 * Shared API response types - MASTER_README Section 5.2
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Sıralama yönü — tüm listeleme API'leri için */
export type SortOrder = 'asc' | 'desc';
