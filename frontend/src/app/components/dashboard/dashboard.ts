import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, finalize } from 'rxjs';

import {
  CertificationStatus,
  PageResponse,
  SupplierDetail,
  SupplierSummary,
} from '../../../models/supplier.model';
import { SupplierService } from '../../../servicios/supplier.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard {
  private readonly supplierService = inject(SupplierService);

  readonly suppliers = signal<SupplierSummary[]>([]);
  readonly totalElements = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly selected = signal<SupplierDetail | null>(null);
  readonly detailLoading = signal(false);

  readonly expiredCount = computed(
    () => this.suppliers().filter((supplier) => supplier.hasExpiredCertifications).length,
  );

  constructor() {
    afterNextRender(() => this.search());
  }

  onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  search(): void {
    const text = this.query().trim();
    this.selected.set(null);
    this.run(this.supplierService.getSuppliers(text ? { text } : {}));
  }

  aiSearch(): void {
    const text = this.query().trim();
    if (!text) {
      this.error.set('Escribí una consulta para buscar con IA.');
      return;
    }
    this.selected.set(null);
    this.run(this.supplierService.aiSearch(text));
  }

  selectSupplier(id: number): void {
    this.detailLoading.set(true);
    this.supplierService
      .getSupplier(id)
      .pipe(finalize(() => this.detailLoading.set(false)))
      .subscribe({
        next: (detail) => this.selected.set(detail),
        error: () => this.error.set('No se pudo cargar el detalle del proveedor.'),
      });
  }

  closeDetail(): void {
    this.selected.set(null);
  }

  statusClass(status: CertificationStatus): string {
    return status.toLowerCase().replace('_', '-');
  }

  private run(request: Observable<PageResponse<SupplierSummary>>): void {
    this.loading.set(true);
    this.error.set(null);

    request.pipe(finalize(() => this.loading.set(false))).subscribe({
      next: (page) => {
        this.suppliers.set(page.content);
        this.totalElements.set(page.totalElements);
      },
      error: () => {
        this.suppliers.set([]);
        this.totalElements.set(0);
        this.error.set(
          'No se pudo conectar con el backend Java. Verificá que esté corriendo en http://localhost:8080.',
        );
      },
    });
  }
}
