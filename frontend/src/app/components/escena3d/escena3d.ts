import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { extend } from 'angular-three';
import * as THREE from 'three';
import { NgtArgs } from 'angular-three';

extend(THREE);

@Component({
  selector: 'app-supplier-graph-scene',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [NgtArgs],
  template: `
    <!-- Iluminación de la escena -->
    <ngt-ambient-light [intensity]="0.7" />
    <ngt-point-light [position]="[10, 10, 10]" [intensity]="1.5" />
    <ngt-point-light [position]="[-10, -10, -10]" [intensity]="0.5" color="#fca311" />

    <!-- GRUPO: Proveedor Validado (Verde) -->
    <ngt-group [position]="[-3, 0, 0]">
      <!-- Nodo Central: Empresa -->
      <ngt-mesh>
        <ngt-sphere-geometry *args="[0.8, 32, 32]" />
        <ngt-mesh-standard-material color="#10b981" [wireframe]="true" />
      </ngt-mesh>
      
      <!-- Satélite: Certificación 1 -->
      <ngt-mesh [position]="[1.5, 1, 0]">
        <ngt-sphere-geometry *args="[0.3, 16, 16]" />
        <ngt-mesh-standard-material color="#3b82f6" />
      </ngt-mesh>

      <!-- Satélite: Certificación 2 -->
      <ngt-mesh [position]="[-1, -1.2, 1]">
        <ngt-sphere-geometry *args="[0.25, 16, 16]" />
        <ngt-mesh-standard-material color="#8b5cf6" />
      </ngt-mesh>
    </ngt-group>

    <!-- GRUPO: Proveedor con Alerta (Rojo) -->
    <ngt-group [position]="[3, 1, -2]">
      <!-- Nodo Central: Empresa -->
      <ngt-mesh>
        <ngt-sphere-geometry *args="[0.8, 32, 32]" />
        <ngt-mesh-standard-material color="#f43f5e" [wireframe]="true" />
      </ngt-mesh>
      
      <!-- Satélite: Certificación Vencida (Rojo) -->
      <ngt-mesh [position]="[-1.2, 0.8, 0.5]">
        <ngt-sphere-geometry *args="[0.3, 16, 16]" />
        <ngt-mesh-standard-material color="#f43f5e" />
      </ngt-mesh>
    </ngt-group>
  `
})
export class SupplierGraphScene {}