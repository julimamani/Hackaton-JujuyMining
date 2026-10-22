import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupplierService, Supplier, PageResponse } from '../../../servicios/supplier.service';

@Component({
  selector: 'app-buscador-proveedores',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './buscador.html'
})
export class Buscador {
  // Inyección del servicio (forma recomendada en Angular 14+)
  private proveedoresService = inject(SupplierService);

  // Señales de estado para el HTML
  searchQuery = '';
  isLoading = signal(false);
  suppliers = signal<Supplier[]>([]);

  performSearch() {
    // Evitar búsquedas vacías
    if (!this.searchQuery.trim()) return;

    // Mostrar el mensaje "Analizando certificaciones..." en el HTML
    this.isLoading.set(true);

    // Llamamos al endpoint de IA
    this.proveedoresService.aiSearch(this.searchQuery).subscribe({
      next: (response: PageResponse<Supplier>) => {
        // El backend devuelve una Page: los proveedores están en "content".
        this.suppliers.set(response.content ?? []);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Error al buscar proveedores:', error);
        this.isLoading.set(false);
      }
    });
  }
}
