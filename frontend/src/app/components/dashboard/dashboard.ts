import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <!-- Panel Lateral: Consultor Inteligente -->
      <aside class="sidebar">
        <div class="header">
          <h1>Jujuy Mining Smart-Check</h1>
          <p>Validación IA de Proveedores</p>
        </div>

        <div class="search-box">
          <input type="text" placeholder="Buscar proveedor, CUIT o norma (ej. ISO 14001)..." />
        </div>

        <div class="supplier-list">
          @for (supplier of suppliers(); track supplier.id) {
            <div class="supplier-card" [class.invalid]="!supplier.isValid">
              <div class="supplier-info">
                <h3>{{ supplier.name }}</h3>
                <span class="badge" [class.success]="supplier.isValid" [class.danger]="!supplier.isValid">
                  {{ supplier.isValid ? 'Certificado al día' : 'Vencido/Faltante' }}
                </span>
              </div>
              <ul class="cert-list">
                @for (cert of supplier.certs; track cert.name) {
                  <li><strong>{{ cert.name }}:</strong> Vence {{ cert.expiry }}</li>
                }
              </ul>
            </div>
          }
        </div>
      </aside>

      <!-- Visor topográfico -->
      <main class="canvas-container">
        <div class="topography-placeholder">
          <span>Vista topográfica 3D</span>
        </div>

        <div class="overlay-stats">
          <div class="stat">Proveedores Activos: 24</div>
          <div class="stat warning">Alertas de Vencimiento: 3</div>
        </div>
      </main>
    </div>
  `,
  styleUrls: ['./app.component.css']
})
export class Dashboard {
  suppliers = signal([
    { id: 1, name: 'Perforaciones Andinas SRL', isValid: true, certs: [{ name: 'ISO 9001', expiry: '2027-11-01' }, { name: 'Alta Montaña', expiry: '2026-12-15' }] },
    { id: 2, name: 'Logística Puna SA', isValid: false, certs: [{ name: 'ESG Sostenibilidad', expiry: '2026-09-10' }] }
  ]);
}