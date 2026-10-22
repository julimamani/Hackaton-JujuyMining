import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    // El dashboard consume la API Java en el navegador: no se prerenderiza.
    renderMode: RenderMode.Client,
  },
];
