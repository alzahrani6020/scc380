export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginatedQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, any>;
}

export interface DashboardStats {
  counts: {
    contacts: number;
    deals: number;
    employees: number;
    vehicles: number;
    invoices: number;
  };
  revenue: {
    deals: number;
    invoices: number;
  };
}
