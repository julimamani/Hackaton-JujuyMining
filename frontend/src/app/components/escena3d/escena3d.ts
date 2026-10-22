import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { extend, injectBeforeRender, NgtArgs, type NgtRenderState } from 'angular-three';
import { NgtCanvas } from 'angular-three/dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Supplier } from '../../../servicios/supplier.service';

extend(THREE);

type Vec3 = [number, number, number];
type Point2 = [number, number];

const MAX_NODES = 15;

/** Columnas con las que se reparten los proveedores dentro de su provincia. */
const PROVINCE_COLUMNS = 3;
const PROVIDER_SPACING = 1.65;
const NODE_HEIGHT = 1.2;

const CORE_RADIUS = 0.42;
const SHELL_RADIUS = 0.6;
const ORBIT_RADIUS = 0.9;
const SPOKE_LENGTH = ORBIT_RADIUS - SHELL_RADIUS;
const SPOKE_MID_RADIUS = (SHELL_RADIUS + ORBIT_RADIUS) / 2;

interface NodeMotionData {
  node: true;
  baseY: number;
  phase: number;
  pulse: boolean;
}

interface OrbitMotionData {
  orbit: true;
  speed: number;
  phase: number;
}

interface ProvinceSpec {
  /** Polígono simplificado en coordenadas de mapa (x = este, y = norte). */
  points: Point2[];
  color: string;
  edge: string;
  /** Centro aproximado para ubicar los proveedores. */
  center: Point2;
  /** Posición del cartel de la provincia en el mundo (x, y, z). */
  label: Vec3;
}

interface MapProvince {
  id: string;
  color: string;
  edge: string;
  geometry: THREE.ExtrudeGeometry;
  edges: THREE.EdgesGeometry;
}

/** Noroeste argentino estilizado: Jujuy, Salta y Catamarca. */
const PROVINCES: Record<string, ProvinceSpec> = {
  jujuy: {
    points: [
      [-6.2, 8.6],
      [-4.6, 9.3],
      [-2.6, 7.8],
      [-1.6, 6.0],
      [-2.4, 4.4],
      [-4.0, 4.0],
      [-5.6, 5.0],
      [-6.4, 6.8],
    ],
    color: '#14352a',
    edge: '#34d399',
    center: [-4.0, 6.5],
    label: [-4.2, 0.55, -10.4],
  },
  salta: {
    points: [
      [-4.0, 4.0],
      [-2.4, 4.4],
      [-1.6, 6.0],
      [0.6, 6.4],
      [3.4, 4.6],
      [5.0, 2.0],
      [4.6, -0.6],
      [3.2, -2.8],
      [0.8, -3.6],
      [-1.8, -3.2],
      [-4.4, -1.4],
      [-4.8, 1.0],
    ],
    color: '#12304a',
    edge: '#38bdf8',
    center: [0.4, 1.2],
    label: [4.9, 0.55, -2.6],
  },
  catamarca: {
    points: [
      [-4.4, -1.4],
      [-1.8, -3.2],
      [0.8, -3.6],
      [0.2, -6.0],
      [-1.2, -8.0],
      [-3.6, -8.6],
      [-5.8, -7.0],
      [-6.2, -4.2],
    ],
    color: '#3a2a12',
    edge: '#fca311',
    center: [-3.0, -5.0],
    label: [-3.0, 0.55, 9.6],
  },
};

/** Anima el grafo, los nodos, y habilita los controles de cámara. */
@Directive({ selector: '[appGraphMotion]', standalone: true })
export class GraphMotionDirective {
  private readonly host: ElementRef<THREE.Group> = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private controls?: OrbitControls;

  constructor() {
    injectBeforeRender((state) => this.tick(state));

    this.destroyRef.onDestroy(() => {
      this.controls?.dispose();
      this.controls = undefined;
    });
  }

  private tick(state: NgtRenderState): void {
    if (!this.controls) {
      const controls = new OrbitControls(state.camera, state.gl.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.rotateSpeed = 0.65;
      controls.zoomSpeed = 0.8;
      controls.enablePan = false;
      controls.minDistance = 8;
      controls.maxDistance = 46;
      controls.minPolarAngle = Math.PI * 0.08;
      controls.maxPolarAngle = Math.PI * 0.42;
      controls.target.set(0, 0.8, -0.2);
      state.controls = controls as unknown as THREE.EventDispatcher;
      this.controls = controls;
    }

    this.controls.update();

    const t = state.clock.getElapsedTime();
    const root = this.host.nativeElement;
    if (!root) return;

    // Balanceo muy leve del mapa completo
    root.rotation.y = Math.sin(t * 0.2) * 0.035;
    root.rotation.x = Math.cos(t * 0.15) * 0.015;

    root.traverse((object) => {
      const data = object.userData as Partial<NodeMotionData & OrbitMotionData>;

      if (data.node) {
        // Flotación vertical de cada empresa
        object.position.y = (data.baseY ?? 0) + Math.sin(t * 0.9 + (data.phase ?? 0)) * 0.08;
        // Latido suave en los proveedores con certificaciones vencidas
        const pulse = data.pulse ? 1 + Math.sin(t * 2.6 + (data.phase ?? 0)) * 0.05 : 1;
        object.scale.setScalar(pulse);
      } else if (data.orbit) {
        // Las certificaciones giran alrededor de su empresa
        object.rotation.z = t * (data.speed ?? 0) + (data.phase ?? 0);
      }
    });
  }
}

@Component({
  selector: 'app-supplier-graph-scene',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [NgtArgs, NgtCanvas, GraphMotionDirective],
  template: `
    <div class="scene-root" (pointermove)="onPointerMove($event)" (pointerleave)="hideTooltip()">
      <ngt-canvas
        [camera]="{ position: [0, 15, 20], fov: 45 }"
        [dpr]="[1, 2]"
        [gl]="{ antialias: true, alpha: true }"
      >
        <ng-template canvasContent>
          <!-- Fondo y atmósfera -->
          <ngt-color attach="background" *args="['#0d0d15']" />

          <!-- Iluminación -->
          <ngt-ambient-light [intensity]="0.5" />
          <ngt-hemisphere-light [intensity]="1" color="#9bb8ff" groundColor="#2a1a00" />
          <ngt-directional-light [position]="[8, 14, 12]" [intensity]="2.4" />
          <ngt-point-light [position]="[-14, 8, 6]" [intensity]="220" color="#fca311" [distance]="70" />
          <ngt-point-light [position]="[12, 10, -6]" [intensity]="180" color="#7c3aed" [distance]="70" />

          <!-- Polvo estelar de fondo -->
          <ngt-points [geometry]="starsGeometry">
            <ngt-points-material
              [size]="0.11"
              color="#6b6b8f"
              [transparent]="true"
              [opacity]="0.6"
              [depthWrite]="false"
            />
          </ngt-points>

          <ngt-group appGraphMotion>
            <!-- ===== Mapa 3D de fondo ===== -->
            <!-- Base del mapa -->
            <ngt-mesh [position]="[0, -0.2, 0]" [rotation]="flatRotation">
              <ngt-circle-geometry *args="[17, 64]" />
              <ngt-mesh-standard-material color="#0a0b12" [roughness]="1" [metalness]="0" />
            </ngt-mesh>

            <!-- Grilla holográfica -->
            <ngt-grid-helper
              *args="[32, 32, '#1c2536', '#141a28']"
              [position]="[0, 0.005, 0]"
            />

            <!-- Provincias -->
            @for (province of provinces; track province.id) {
              <ngt-mesh [geometry]="province.geometry">
                <ngt-mesh-standard-material
                  [color]="province.color"
                  [emissive]="province.color"
                  [emissiveIntensity]="0.4"
                  [roughness]="0.85"
                  [metalness]="0.15"
                />
              </ngt-mesh>
              <ngt-line-segments [geometry]="province.edges">
                <ngt-line-basic-material
                  [color]="province.edge"
                  [transparent]="true"
                  [opacity]="0.8"
                />
              </ngt-line-segments>
            }

            <!-- Carteles de las provincias -->
            @for (label of provinceLabels; track label.id) {
              <ngt-primitive *args="[label.sprite]" />
            }

            <!-- ===== Proveedores sobre el mapa ===== -->
            @for (supplier of visibleSuppliers(); track supplier.id; let i = $index) {
              <ngt-group [position]="groupPosition(i)" [userData]="nodeMotion(i, supplier)">
                <!-- Halo del semáforo -->
                <ngt-mesh>
                  <ngt-torus-geometry *args="[0.8, 0.012, 8, 80]" />
                  <ngt-mesh-basic-material
                    [color]="statusColor(supplier)"
                    [transparent]="true"
                    [opacity]="0.55"
                  />
                </ngt-mesh>

                <!-- Núcleo: empresa -->
                <ngt-mesh>
                  <ngt-sphere-geometry *args="[0.45, 32, 32]" />
                  <ngt-mesh-standard-material
                    [color]="statusColor(supplier)"
                    [emissive]="statusColor(supplier)"
                    [emissiveIntensity]="0.5"
                    [roughness]="0.35"
                    [metalness]="0.35"
                  />
                </ngt-mesh>

                <!-- Cáscara wireframe -->
                <ngt-mesh>
                  <ngt-sphere-geometry *args="[0.62, 16, 16]" />
                  <ngt-mesh-basic-material
                    [color]="statusColor(supplier)"
                    [wireframe]="true"
                    [transparent]="true"
                    [opacity]="0.16"
                  />
                </ngt-mesh>

                <!-- Órbita inclinada con las certificaciones girando alrededor -->
                <ngt-group [rotation]="orbitTilt(i)">
                  <ngt-group [userData]="orbitMotion(i)">
                    @for (cert of supplier.validCertifications; track cert; let j = $index) {
                      <ngt-mesh
                        [position]="spokePosition(j, supplier.validCertifications.length)"
                        [rotation]="spokeRotation(j, supplier.validCertifications.length)"
                      >
                        <ngt-cylinder-geometry *args="[0.01, 0.01, SPOKE_LENGTH, 6]" />
                        <ngt-mesh-basic-material
                          [color]="certColor(cert)"
                          [transparent]="true"
                          [opacity]="0.4"
                        />
                      </ngt-mesh>

                      <ngt-mesh [position]="satellitePosition(j, supplier.validCertifications.length)">
                        <ngt-sphere-geometry *args="[0.12, 16, 16]" />
                        <ngt-mesh-standard-material
                          [color]="certColor(cert)"
                          [emissive]="certColor(cert)"
                          [emissiveIntensity]="0.9"
                          [roughness]="0.3"
                        />
                      </ngt-mesh>
                    }
                  </ngt-group>
                </ngt-group>

                <!-- Zona de hover: esfera invisible que cubre el nodo -->
                <ngt-mesh (pointerover)="onHover(supplier)" (pointerout)="onLeave(supplier)">
                  <ngt-sphere-geometry *args="[1.05, 16, 16]" />
                  <ngt-mesh-basic-material [transparent]="true" [opacity]="0" [depthWrite]="false" />
                </ngt-mesh>
              </ngt-group>
            }
          </ngt-group>
        </ng-template>
      </ngt-canvas>

      @if (hovered(); as supplier) {
        <div #tooltip class="node-tooltip" [style.transform]="tooltipTransform">
          {{ supplier.name }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }

      .scene-root {
        position: relative;
        width: 100%;
        height: 100%;
        cursor: grab;
      }

      .scene-root:active {
        cursor: grabbing;
      }

      .node-tooltip {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 10;
        pointer-events: none;
        padding: 0.3rem 0.6rem;
        border-radius: 6px;
        border: 1px solid rgba(252, 163, 17, 0.7);
        background: rgba(13, 13, 21, 0.94);
        color: #f5f5f5;
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class SupplierGraphScene {
  /** Proveedores a graficar (normalmente el resultado de la búsqueda actual). */
  suppliers = input<Supplier[]>([]);

  readonly SPOKE_LENGTH = SPOKE_LENGTH;

  readonly flatRotation: Vec3 = [-Math.PI / 2, 0, 0];

  /** Campo de estrellas: puntos distribuidos detrás del grafo. */
  readonly starsGeometry = createStarfield();

  /** Mapa 3D: una losa extruida por provincia. */
  readonly provinces: MapProvince[] = Object.entries(PROVINCES).map(([id, spec]) => {
    const geometry = createProvinceGeometry(spec.points);
    return {
      id,
      color: spec.color,
      edge: spec.edge,
      geometry,
      edges: new THREE.EdgesGeometry(geometry, 25),
    };
  });

  /** Carteles flotantes con el nombre de cada provincia. */
  readonly provinceLabels = Object.entries(PROVINCES).map(([id, spec]) => ({
    id,
    sprite: createProvinceLabel(id.toUpperCase(), spec.edge, spec.label),
  }));

  /** Proveedor bajo el cursor; su nombre se muestra en un tooltip. */
  readonly hovered = signal<Supplier | null>(null);

  tooltipTransform = 'translate(0px, 0px)';

  private readonly tooltip = viewChild<ElementRef<HTMLDivElement>>('tooltip');
  private pointerX = 0;
  private pointerY = 0;
  private boundsWidth = 0;
  private boundsHeight = 0;

  constructor() {
    // Si una búsqueda deja fuera al proveedor apuntado, ocultamos el tooltip.
    effect(() => {
      const ids = new Set(this.visibleSuppliers().map((supplier) => supplier.id));
      const current = this.hovered();
      if (current && !ids.has(current.id)) {
        this.hovered.set(null);
      }
    });
  }

  onHover(supplier: Supplier): void {
    this.hovered.set(supplier);
    this.tooltipTransform = this.clampTooltip();
    // El tooltip todavía no existe hasta el próximo render: lo ubicamos al final del frame.
    requestAnimationFrame(() => this.positionTooltip());
  }

  onLeave(supplier: Supplier): void {
    if (this.hovered()?.id === supplier.id) {
      this.hovered.set(null);
    }
  }

  onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.pointerX = event.clientX - rect.left;
    this.pointerY = event.clientY - rect.top;
    this.boundsWidth = rect.width;
    this.boundsHeight = rect.height;

    if (!this.hovered()) return;
    this.positionTooltip();
  }

  hideTooltip(): void {
    this.hovered.set(null);
  }

  private positionTooltip(): void {
    const element = this.tooltip()?.nativeElement;
    if (!element) return;
    element.style.transform = this.clampTooltip(element.offsetWidth, element.offsetHeight);
  }

  /** Mantiene el tooltip dentro del visor, junto al cursor. */
  private clampTooltip(width = 170, height = 26): string {
    const offset = 14;
    const margin = 8;
    const maxX = Math.max(margin, this.boundsWidth - width - margin);
    const maxY = Math.max(margin, this.boundsHeight - height - margin);
    const x = Math.min(Math.max(this.pointerX + offset, margin), maxX);
    const y = Math.min(Math.max(this.pointerY + offset, margin), maxY);
    return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  visibleSuppliers = () => this.suppliers().slice(0, MAX_NODES);

  /**
   * Ubica cada proveedor sobre su provincia en el mapa.
   * Los de una misma provincia se reparten en una grilla centrada.
   */
  groupPosition(index: number): Vec3 {
    const suppliers = this.visibleSuppliers();
    const key = normalizeProvince(suppliers[index]?.province);
    const center = placementCenter(key);

    let localIndex = 0;
    let count = 0;
    for (let i = 0; i < suppliers.length; i++) {
      if (normalizeProvince(suppliers[i].province) === key) {
        if (i < index) localIndex++;
        count++;
      }
    }

    const row = Math.floor(localIndex / PROVINCE_COLUMNS);
    const column = localIndex % PROVINCE_COLUMNS;
    const rows = Math.ceil(count / PROVINCE_COLUMNS);
    const columnsInRow = Math.min(PROVINCE_COLUMNS, count - row * PROVINCE_COLUMNS);

    const x = center[0] + (column - (columnsInRow - 1) / 2) * PROVIDER_SPACING;
    const z = center[1] + (row - (rows - 1) / 2) * PROVIDER_SPACING;
    const y = NODE_HEIGHT + (index % 3) * 0.16;
    return [x, y, z];
  }

  /** Datos que usa GraphMotionDirective para animar cada nodo. */
  nodeMotion(index: number, supplier: Supplier): NodeMotionData {
    return {
      node: true,
      baseY: this.groupPosition(index)[1],
      phase: index * 1.7,
      pulse: supplier.hasExpiredCertifications,
    };
  }

  orbitTilt(index: number): Vec3 {
    return [0.42 + (index % 3) * 0.07, index % 2 === 0 ? 0.24 : -0.24, 0];
  }

  orbitMotion(index: number): OrbitMotionData {
    return {
      orbit: true,
      speed: (index % 2 === 0 ? 1 : -1) * (0.28 + (index % 3) * 0.09),
      phase: index * 0.8,
    };
  }

  satellitePosition(index: number, total: number): Vec3 {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    return [Math.cos(angle) * ORBIT_RADIUS, Math.sin(angle) * ORBIT_RADIUS, 0];
  }

  spokePosition(index: number, total: number): Vec3 {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    return [Math.cos(angle) * SPOKE_MID_RADIUS, Math.sin(angle) * SPOKE_MID_RADIUS, 0];
  }

  spokeRotation(index: number, total: number): Vec3 {
    const angle = (index / Math.max(total, 1)) * Math.PI * 2;
    return [0, 0, angle - Math.PI / 2];
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

function normalizeProvince(province: string | undefined): string {
  return (province ?? '').trim().toLowerCase();
}

/** Centro del mapa (x, z) donde se reparten los proveedores de una provincia. */
function placementCenter(province: string): [number, number] {
  const spec = PROVINCES[province];
  return spec ? [spec.center[0], -spec.center[1]] : [0, 4.5];
}

function createProvinceGeometry(points: Point2[]): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i][0], points[i][1]);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelSize: 0.045,
    bevelThickness: 0.045,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // Del plano XY al plano del suelo (XZ): el norte del mapa queda hacia -Z.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Cartel flotante con el nombre de la provincia (siempre mira a la cámara). */
function createProvinceLabel(text: string, color: string, position: Vec3): THREE.Sprite {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0.92 }),
  );
  sprite.position.set(position[0], position[1], position[2]);
  sprite.scale.set(3.8, 0.95, 1);

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = '700 64px "Segoe UI", system-ui, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = color;
      context.shadowBlur = 22;
      context.fillStyle = color;
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      context.shadowBlur = 0;
      context.fillText(text, canvas.width / 2, canvas.height / 2);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = sprite.material as THREE.SpriteMaterial;
      material.map = texture;
      material.needsUpdate = true;
    }
  }

  return sprite;
}

/** Genera un campo de estrellas detrás del grafo (sin dependencias externas). */
function createStarfield(): THREE.BufferGeometry {
  const count = 700;
  const positions = new Float32Array(count * 3);
  let seed = 1337;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < count; i++) {
    const radius = 26 + random() * 30;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    // Solo detrás del grafo
    positions[i * 3 + 2] = -Math.abs(radius * Math.cos(phi)) - 6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}
