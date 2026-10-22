export type CertificationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

export type CertificationArea =
  | 'QUALITY'
  | 'ENVIRONMENT'
  | 'SAFETY'
  | 'SUSTAINABILITY'
  | 'OPERATIONAL';

export interface Category {
  id: number;
  name: string;
}

export interface CertificationType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  area: CertificationArea;
}

export interface CertificationDto {
  id: number;
  typeCode: string;
  typeName: string;
  issuer: string | null;
  certificateNumber: string | null;
  issueDate: string | null;
  expirationDate: string;
  documentUrl: string | null;
  status: CertificationStatus;
  daysToExpire: number;
}

export interface SupplierSummary {
  id: number;
  name: string;
  taxId: string;
  province: string | null;
  city: string | null;
  categories: string[];
  validCertifications: string[];
  hasExpiredCertifications: boolean;
}

export interface SupplierDetail {
  id: number;
  name: string;
  taxId: string;
  description: string | null;
  province: string | null;
  city: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  website: string | null;
  categories: string[];
  certifications: CertificationDto[];
}

export interface SupplierMatch {
  supplier: SupplierSummary;
  met: string[];
  expiringSoon: string[];
  expired: string[];
  missing: string[];
  fullyCompliant: boolean;
  score: number;
}

export interface SupplierSearchParams {
  text?: string;
  province?: string;
  categoryIds?: number[];
  requiredCertifications?: string[];
  page?: number;
  size?: number;
  sort?: string;
}

export interface MatchRequest {
  requiredCertifications: string[];
  province?: string | null;
  categoryIds?: number[] | null;
}

export interface AiSearchRequest {
  query: string;
}

/** Respuesta paginada de Spring Data (`Page<T>`). */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}
