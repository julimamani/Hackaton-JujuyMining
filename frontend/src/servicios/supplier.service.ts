import { Injectable, signal } from '@angular/core';
import { Supplier } from '../models/supplier.model';

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  
  // Datos simulados para el prototipo
  private mockSuppliers: Supplier[] = [
    {
      id: '1',
      name: 'Transportes Mineros del Norte S.A.',
      cuit: '30-12345678-9',
      overallStatus: 'VERIFIED',
      aiSummary: 'Documentación al día. PDF analizado exitosamente.',
      certifications: [
        { id: 'c1', name: 'ISO 45001 (Seguridad)', expiryDate: '2027-10-15', isValid: true },
        { id: 'c2', name: 'Habilitación Alta Montaña', expiryDate: '2026-12-01', isValid: true }
      ]
    },
    {
      id: '2',
      name: 'Logística y Perforaciones Andinas',
      cuit: '30-98765432-1',
      overallStatus: 'WARNING',
      aiSummary: 'Atención: La certificación ambiental vence en 30 días.',
      certifications: [
        { id: 'c3', name: 'Normas de Sostenibilidad ESG', expiryDate: '2026-11-20', isValid: true },
        { id: 'c4', name: 'ISO 9001 (Calidad)', expiryDate: '2024-05-10', isValid: false }
      ]
    }
  ];

  constructor() {}

  getSuppliers(): Supplier[] {
    return this.mockSuppliers;
  }
}