export interface Certification {
  id: string;
  name: string;       // ej: "ISO 14001", "ESG", "Habilitación Alta Montaña"
  expiryDate: string;
  isValid: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  cuit: string;
  overallStatus: 'VERIFIED' | 'WARNING' | 'EXPIRED'; // Verde, Amarillo, Rojo
  certifications: Certification[];
  aiSummary?: string; // Lo que devolvería tu Node.js leyendo el PDF
}