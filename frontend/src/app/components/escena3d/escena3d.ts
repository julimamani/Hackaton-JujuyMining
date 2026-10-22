import { Component, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { extend, NgtArgs } from 'angular-three';
import { NgtCanvas } from 'angular-three/dom';
import * as THREE from 'three';
import { Supplier } from '../../../servicios/supplier.service';

extend(THREE);

type Vec3 = [number, number, number];

const SPACING_X = 4.2;
const SPACING_Y = 4.2;
const COLUMNS = 5;
const MAX_NODES = 15;

@Component({
  selector: 'app-supplier-graph-scene',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [NgtArgs, NgtCanvas],
  template: `
    <ngt-canvas [camera]="{ position: [0, 0, 18], fov: 45 }" [dpr]="[1, 2]">
      <ng-template canvasContent>
        <!-- Iluminación de la escena -->
        <ngt-ambient-light [intensity]="0.9" />
        <ngt-point-light [position]="[14, 14, 14]" [intensity]="1.6" />
        <ngt-point-light [position]="[-14, -10, -12]" [intensity]="0.7" color="#fca311" />

        <!-- Un nodo por proveedor, con un satélite por certificación vigente -->
        @for (supplier of visibleSuppliers(); track supplier.id; let i = $index) {
          <ngt-group [position]="groupPosition(i)">
            <!-- Nodo central: empresa (color según su semáforo) -->
            <ngt-mesh>
              <ngt-sphere-geometry *args="[0.75, 32, 32]" />
              <ngt-mesh-standard-material [color]="statusColor(supplier)" [wireframe]="true" />
            </ngt-mesh>

            <!-- Satélites: certificaciones -->
            @for (cert of supplier.validCertifications; track cert; let j = $index) {
              <ngt-mesh [position]="satellitePosition(j, supplier.validCertifications.length)">
                <ngt-sphere-geometry *args="[0.2, 16, 16]" />
                <ngt-mesh-standard-material [color]="certColor(cert)" />
              </ngt-mesh>
            }
          </ngt-group>
        }
      </ng-template>
    </ngt-canvas>
  `,
  styles: [':host { display: block; width: 100%; height: 100%; }']
})
export class SupplierGraphScene {
  /** Proveedores a graficar (normalmente el resultado de la búsqueda actual). */
  suppliers = input<Supplier[]>([]);

  visibleSuppliers = () => this.suppliers().slice(0, MAX_NODES);

  groupPosition(index: number): Vec3 {
    const total = this.visibleSuppliers().length;
    const rows = Math.ceil(total / COLUMNS);
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    // Centra cada fila según cuántos nodos tenga (la última puede estar incompleta)
    const columnsInRow = Math.min(COLUMNS, total - row * COLUMNS);

    const x = (column - (columnsInRow - 1) / 2) * SPACING_X;
    const y = ((rows - 1) / 2 - row) * SPACING_Y;
    return [x, y, 0];
  }

  satellitePosition(index: number, total: number): Vec3 {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    return [Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, Math.sin(angle) * 0.4];
  }

  statusColor(supplier: Supplier): string {
    if (supplier.hasExpiredCertifications) {
      return '#f43f5e'; // vencido
    }
    return supplier.validCertifications.length ? '#10b981' : '#fca311'; // al día / sin certificaciones
  }

  certColor(code: string): string {
    switch (code) {
      case 'ISO_9001':
        return '#3b82f6';
      case 'ISO_14001':
        return '#22c55e';
      case 'ISO_45001':
        return '#a855f7';
      case 'ESG':
        return '#14b8a6';
      case 'HIGH_ALTITUDE':
        return '#f59e0b';
      default:
        return '#94a3b8';
    }
  }
}
