import { Component, DestroyRef, signal, inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Necesario para ngModel
import { Subscription, catchError, of, timeout } from 'rxjs';
import { SupplierService, Supplier, AiSearchResult } from '../../../servicios/supplier.service';
import { SupplierGraphScene } from '../escena3d/escena3d';

type SupplierStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';

interface ParsedQuery {
  tokens: string[];
  province?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SupplierGraphScene],
  template: `
    <div class="dashboard-container">
      <!-- Panel Lateral: Consultor Inteligente -->
      <aside class="sidebar">
        <div class="header">
          <h1>Jujuy Mining Smart-Check</h1>
          <p>Validación IA de Proveedores</p>
        </div>

        <div class="search-box">
          <div class="search-row">
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (keyup.enter)="performSearch()"
              placeholder="Ej: proveedores de transporte en Jujuy..."
            />
          </div>
          <div class="search-actions">
            <button
              type="button"
              class="btn-primary"
              (click)="performSearch()"
            >
              Buscar
            </button>
            <button
              type="button"
              class="btn-ai"
              (click)="performAiSearch()"
              [disabled]="isLoading()"
            >
              ✨ Buscar con IA
            </button>
          </div>
          <p class="hint">
            Buscá por rubro, provincia, CUIT o certificación (ej. ISO 45001). Las negaciones
            como "sin ISO 9001" se resuelven con ✨ Buscar con IA.
          </p>
          @if (aiNotice()) {
            <p class="notice">{{ aiNotice() }}</p>
          }
        </div>

        <div class="supplier-list">
          @if (isLoading()) {
            <div class="state">{{ loadingLabel() }}</div>
          } @else if (errorMessage()) {
            <div class="state error">{{ errorMessage() }}</div>
          } @else if (suppliers().length === 0) {
            <div class="state">No hay proveedores que coincidan con la búsqueda.</div>
          } @else {
            @for (supplier of suppliers(); track supplier.id) {
              <article class="supplier-card" [class.invalid]="statusOf(supplier) !== 'VALID'">
                <div class="supplier-info">
                  <h3>{{ supplier.name }}</h3>
                  <span
                    class="badge"
                    [class.success]="statusOf(supplier) === 'VALID'"
                    [class.warning]="statusOf(supplier) === 'EXPIRING_SOON'"
                    [class.danger]="statusOf(supplier) === 'EXPIRED'"
                  >
                    {{ statusLabel(supplier) }}
                  </span>
                </div>

                <p class="meta">
                  @if (supplier.taxId) { <span>{{ supplier.taxId }}</span> }
                  @if (supplier.city || supplier.province) {
                    <span>{{ supplier.city }}{{ supplier.city && supplier.province ? ', ' : '' }}{{ supplier.province }}</span>
                  }
                </p>

                @if (supplier.categories.length) {
                  <p class="meta">{{ supplier.categories.join(' · ') }}</p>
                }

                @if (supplier.validCertifications.length) {
                  <ul class="cert-list">
                    @for (cert of supplier.validCertifications; track cert) {
                      <li>{{ cert }}</li>
                    }
                  </ul>
                } @else {
                  <p class="meta">Sin certificaciones vigentes.</p>
                }
              </article>
            }
          }
        </div>
      </aside>

      <!-- Resumen de la búsqueda + grafo 3D de proveedores -->
      <main class="canvas-container">
        <div class="summary">
          <div class="stat">
            <strong>{{ suppliers().length }}</strong>
            <span>Proveedores encontrados</span>
          </div>
          <div class="stat">
            <strong>{{ countByStatus('VALID') }}</strong>
            <span>Certificados al día</span>
          </div>
          <div class="stat warning">
            <strong>{{ countByStatus('EXPIRED') }}</strong>
            <span>Con certificaciones vencidas</span>
          </div>
        </div>

        <div class="scene-wrapper">
          <div class="scene-hint">Arrastrá para rotar · Scroll para zoom · Hover sobre un nodo</div>
          <!-- @defer evita ejecutar WebGL durante el SSR/prerender -->
          @defer (on immediate) {
            <app-supplier-graph-scene [suppliers]="suppliers()" />
          } @placeholder {
            <div class="topography-placeholder">
              <span>Vista topográfica 3D</span>
            </div>
          }
        </div>

        <div class="legend">
          <span class="legend-item"><i class="dot valid"></i> Al día</span>
          <span class="legend-item"><i class="dot warning"></i> Sin certificaciones</span>
          <span class="legend-item"><i class="dot expired"></i> Vencido</span>
        </div>
      </main>
    </div>
  `,
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
  private supplierService = inject(SupplierService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  // Estados reactivos
  searchQuery = '';
  isLoading = signal(false);
  loadingLabel = signal('Analizando certificaciones...');
  suppliers = signal<Supplier[]>([]);
  errorMessage = signal('');
  /** Mensaje informativo sobre la última búsqueda (ej. si se usó IA o si no estaba disponible). */
  aiNotice = signal('');

  /** Tiempo máximo de espera para la búsqueda con IA (Ollama local puede demorar o estar apagado). */
  private static readonly AI_TIMEOUT_MS = 30000;

  /** Todos los proveedores cargados desde el backend, base para el filtrado local. */
  private allSuppliers: Supplier[] = [];

  /** Petición de IA en curso: se cancela si el usuario vuelve a buscar. */
  private aiSubscription?: Subscription;

  private static readonly PROVINCES = ['Jujuy', 'Salta', 'Catamarca'];

  /**
   * Palabras que no aportan al filtro. Incluye conectores y términos genéricos
   * del rubro ("proveedores mineros del NOA") que no aparecen en los datos.
   */
  private static readonly STOP_WORDS = new Set([
    'proveedor', 'proveedores', 'empresa', 'empresas', 'que', 'con', 'para',
    'por', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas', 'de', 'en',
    'el', 'la', 'y', 'o', 'a', 'al', 'se', 'su', 'sus', 'busco', 'buscar',
    'necesito', 'quiero', 'minero', 'minera', 'mineros', 'mineras', 'sector',
    'noa', 'argentina', 'servicio', 'servicios', 'trabajo', 'trabajos',
    'operacion', 'operaciones', 'certificacion', 'certificaciones', 'norma', 'normas'
  ]);

  /** Sinónimos de certificación/rubro que no aparecen literalmente en los datos del backend. */
  private static readonly CERT_LABELS: Record<string, string> = {
    ISO_9001: 'calidad',
    ISO_14001: 'ambiental ambiente medio ambiente',
    ISO_45001: 'seguridad higiene seguridad laboral',
    ESG: 'sostenibilidad sustentabilidad',
    HIGH_ALTITUDE: 'altura montana alta montana'
  };

  ngOnInit() {
    this.destroyRef.onDestroy(() => this.aiSubscription?.unsubscribe());

    // Evita llamar al backend durante el prerender/SSR: los datos se cargan en el navegador.
    if (isPlatformBrowser(this.platformId)) {
      this.loadSuppliers();
    }
  }

  /** Carga todos los proveedores una sola vez; las búsquedas se resuelven sobre esta lista. */
  loadSuppliers() {
    this.isLoading.set(true);
    this.loadingLabel.set('Analizando certificaciones...');
    this.errorMessage.set('');

    this.supplierService.getSuppliers(undefined, undefined, undefined, 0, 500).subscribe({
      next: (data) => {
        this.allSuppliers = this.normalize(data?.content ?? []);
        // Vista inicial: proveedores de Jujuy.
        this.suppliers.set(this.filterByProvince(this.allSuppliers, 'Jujuy'));
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar proveedores', err);
        this.allSuppliers = [];
        this.suppliers.set([]);
        this.errorMessage.set(
          'No se pudo obtener la lista de proveedores. Verificá que el backend esté corriendo en http://localhost:8080.'
        );
        this.isLoading.set(false);
      }
    });
  }

  performSearch() {
    // Una búsqueda manual siempre gana: cancelamos cualquier consulta de IA pendiente.
    this.aiSubscription?.unsubscribe();
    this.aiSubscription = undefined;
    this.isLoading.set(false);

    const query = this.searchQuery.trim();

    if (!query) {
      this.aiNotice.set('');
      this.errorMessage.set('');
      this.suppliers.set(this.filterByProvince(this.allSuppliers, 'Jujuy'));
      return;
    }

    // Filtrado local: es instantáneo y no depende de que Ollama/el endpoint de IA estén disponibles.
    const { tokens, province } = this.parseQuery(query);
    let results = this.allSuppliers;

    if (province) {
      results = this.filterByProvince(results, province);
    }

    if (tokens.length) {
      results = results.filter((supplier) => {
        const haystack = this.buildHaystack(supplier);
        return tokens.every((token) => haystack.includes(token));
      });
    }

    this.errorMessage.set('');
    this.aiNotice.set('');
    this.suppliers.set(results);
  }

  /**
   * Búsqueda con IA: manda la consulta en lenguaje natural al backend
   * (POST /api/suppliers/ai-search), que la traduce a filtros (incluidas negaciones
   * como "sin ISO 9001") y rankea los resultados. Si la IA no responde a tiempo,
   * cae a la búsqueda por texto; si responde vacío, se muestra el estado sin resultados.
   */
  performAiSearch() {
    const query = this.searchQuery.trim();

    if (!query) {
      this.performSearch();
      return;
    }

    // Evita respuestas viejas si el usuario consulta varias veces seguidas.
    this.aiSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.loadingLabel.set('Interpretando tu consulta con IA...');
    this.errorMessage.set('');
    this.aiNotice.set('');

    this.aiSubscription = this.supplierService
      .aiSearch(query)
      .pipe(
        timeout(Dashboard.AI_TIMEOUT_MS),
        catchError((error) => {
          console.warn('Búsqueda con IA no disponible:', error);
          return of<AiSearchResult | null>(null);
        })
      )
      .subscribe((data) => {
        this.aiSubscription = undefined;
        this.isLoading.set(false);

        if (!data) {
          this.performSearch();
          this.aiNotice.set(
            'La búsqueda con IA no respondió a tiempo. Se muestran resultados por texto; podés reintentar en unos segundos.'
          );
          return;
        }

        const results = this.normalize(data.page.content ?? []);
        if (!results.length) {
          this.suppliers.set([]);
          this.aiNotice.set(
            'No se encontraron proveedores que cumplan con tu consulta. Probá con otro rubro, provincia o certificación.'
          );
          return;
        }

        this.suppliers.set(results);
        switch (data.mode) {
          case 'llm':
            this.aiNotice.set('Consulta interpretada con IA (modelo local) y ordenada por relevancia.');
            break;
          case 'fallback':
            this.aiNotice.set(
              'La IA no respondió; se muestran coincidencias por palabras clave ordenadas por relevancia.'
            );
            break;
          default:
            this.aiNotice.set('Consulta interpretada al instante y ordenada por relevancia.');
        }
      });
  }

  private filterByProvince(suppliers: Supplier[], province: string): Supplier[] {
    const normalized = province.toLowerCase();
    return suppliers.filter((supplier) => supplier.province?.toLowerCase() === normalized);
  }

  private parseQuery(query: string): ParsedQuery {
    const lower = Dashboard.normalizeText(query.toLowerCase());
    const province = Dashboard.PROVINCES.find((p) => lower.includes(p.toLowerCase()));

    const tokens = lower
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1 && !Dashboard.STOP_WORDS.has(word))
      .filter((word) => word !== province?.toLowerCase());

    return { tokens, province };
  }

  /** Minúsculas sin acentos, para que "logística" y "logistica" matcheen igual. */
  private static normalizeText(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Texto plano del proveedor donde buscar: nombre, ubicación, rubros y certificaciones. */
  private buildHaystack(supplier: Supplier): string {
    const certLabels = supplier.validCertifications
      .map((code) => Dashboard.CERT_LABELS[code] ?? '')
      .join(' ');

    return Dashboard.normalizeText(
      [
        supplier.name,
        supplier.taxId ?? '',
        supplier.province ?? '',
        supplier.city ?? '',
        ...supplier.categories,
        ...supplier.validCertifications,
        certLabels
      ]
        .join(' ')
        .toLowerCase()
        .replace(/_/g, ' ')
    );
  }

  private normalize(results: any[]): Supplier[] {
    return results.map((supplier) => ({
      ...supplier,
      categories: supplier.categories ?? [],
      validCertifications: supplier.validCertifications ?? [],
      hasExpiredCertifications: Boolean(supplier.hasExpiredCertifications)
    }));
  }

  statusOf(supplier: Supplier): SupplierStatus {
    if (supplier.hasExpiredCertifications) {
      return 'EXPIRED';
    }
    return supplier.validCertifications.length ? 'VALID' : 'EXPIRING_SOON';
  }

  statusLabel(supplier: Supplier): string {
    switch (this.statusOf(supplier)) {
      case 'VALID':
        return 'Certificado al día';
      case 'EXPIRED':
        return 'Certificación vencida';
      default:
        return 'Sin certificaciones';
    }
  }

  countByStatus(status: SupplierStatus): number {
    return this.suppliers().filter((supplier) => this.statusOf(supplier) === status).length;
  }
}
