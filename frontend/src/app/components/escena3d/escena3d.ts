import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { extend } from 'angular-three';
import * as THREE from 'three';

// Extendemos los elementos de Three.js para usarlos en el template de Angular
extend(THREE);

@Component({
  selector: 'app-topography-scene',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <!-- Iluminación para simular luz solar en el campamento -->
    <ngt-ambient-light [intensity]="0.5" />
    <ngt-directional-light [position]="[10, 10, 5]" [intensity]="1" [castShadow]="true" />

    <!-- Representación de la superficie / Terreno minero -->
    <ngt-mesh [rotation]="[-Math.PI / 2, 0, 0]" [position]="[0, -2, 0]">
      <ngt-plane-geometry *args="[20, 20, 32, 32]" />
      <ngt-mesh-standard-material color="#4a5d23" [wireframe]="true" />
    </ngt-mesh>

    <!-- Marcador de una zona de perforación/operación -->
    <ngt-mesh [position]="[0, 0, 0]">
      <ngt-cylinder-geometry *args="[0.5, 0.5, 4, 32]" />
      <ngt-mesh-standard-material color="#ff9900" />
    </ngt-mesh>
  `
})
export class TopographyScene {
  Math = Math;
}