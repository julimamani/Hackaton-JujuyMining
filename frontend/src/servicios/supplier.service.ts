import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../environments/environment';
import {
  AiSearchRequest,
  Category,
  CertificationType,
  MatchRequest,
  PageResponse,
  SupplierDetail,
  SupplierMatch,
  SupplierSearchParams,
  SupplierSummary,
} from '../models/supplier.model';

@Injectable({
  providedIn: 'root',
})
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiBaseUrl;
  private readonly suppliersUrl = `${this.apiUrl}/suppliers`;
  private readonly catalogUrl = `${this.apiUrl}/catalog`;

  /** GET /api/suppliers?text=&province=&categoryIds=&requiredCertifications=&page=&size=&sort= */
  getSuppliers(params: SupplierSearchParams = {}): Observable<PageResponse<SupplierSummary>> {
    return this.http.get<PageResponse<SupplierSummary>>(this.suppliersUrl, {
      params: this.buildSearchParams(params),
    });
  }

  /** GET /api/suppliers/{id} */
  getSupplier(id: number): Observable<SupplierDetail> {
    return this.http.get<SupplierDetail>(`${this.suppliersUrl}/${id}`);
  }

  /** POST /api/suppliers/match */
  match(request: MatchRequest): Observable<SupplierMatch[]> {
    return this.http.post<SupplierMatch[]>(`${this.suppliersUrl}/match`, request);
  }

  /** POST /api/suppliers/ai-search */
  aiSearch(query: string, page = 0, size = 20): Observable<PageResponse<SupplierSummary>> {
    const body: AiSearchRequest = { query };
    const params = new HttpParams().set('page', page).set('size', size).set('sort', 'name');

    return this.http.post<PageResponse<SupplierSummary>>(
      `${this.suppliersUrl}/ai-search`,
      body,
      { params },
    );
  }

  /** GET /api/catalog/categories */
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.catalogUrl}/categories`);
  }

  /** GET /api/catalog/certification-types */
  getCertificationTypes(): Observable<CertificationType[]> {
    return this.http.get<CertificationType[]>(`${this.catalogUrl}/certification-types`);
  }

  private buildSearchParams(params: SupplierSearchParams): HttpParams {
    let httpParams = new HttpParams();

    if (params.text) {
      httpParams = httpParams.set('text', params.text);
    }
    if (params.province) {
      httpParams = httpParams.set('province', params.province);
    }
    for (const categoryId of params.categoryIds ?? []) {
      httpParams = httpParams.append('categoryIds', categoryId);
    }
    for (const code of params.requiredCertifications ?? []) {
      httpParams = httpParams.append('requiredCertifications', code);
    }
    if (params.page !== undefined) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params.size !== undefined) {
      httpParams = httpParams.set('size', params.size);
    }
    if (params.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }

    return httpParams;
  }
}
