import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/** Coincide con SupplierSummaryDto del backend (GET /api/suppliers y POST /api/suppliers/ai-search). */
export interface Supplier {
  id: number;
  name: string;
  taxId?: string;
  province?: string;
  city?: string;
  categories: string[];
  validCertifications: string[];
  hasExpiredCertifications: boolean;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/** Resultado de /ai-search + cómo se resolvió la consulta (rules, cache, llm o fallback). */
export interface AiSearchResult {
  page: PageResponse<Supplier>;
  mode: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8080/api';

  // GET /api/suppliers
  getSuppliers(
    text?: string,
    province?: string,
    certs?: string[],
    page = 0,
    size = 10
  ): Observable<PageResponse<Supplier>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (text) params = params.set('text', text);
    if (province) params = params.set('province', province);
    certs?.forEach(cert => params = params.append('requiredCertifications', cert));

    return this.http.get<PageResponse<Supplier>>(`${this.baseUrl}/suppliers`, { params });
  }

  // GET /api/suppliers/{id}
  getSupplierById(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.baseUrl}/suppliers/${id}`);
  }

  // POST /api/suppliers/match
  matchSuppliers(requiredCertifications: string[], province?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/suppliers/match`, { requiredCertifications, province });
  }

  // POST /api/suppliers/ai-search
  aiSearch(query: string): Observable<AiSearchResult> {
    return this.http
      .post<PageResponse<Supplier>>(
        `${this.baseUrl}/suppliers/ai-search`,
        { query },
        { observe: 'response' }
      )
      .pipe(
        map((response) => ({
          page: response.body ?? { content: [], totalElements: 0, totalPages: 0, number: 0, size: 0 },
          mode: response.headers.get('X-AI-Mode') ?? 'llm'
        }))
      );
  }
}
