# Mining Suppliers (Hackathon IINNOA - Jujuy Mining)

Backend en Java 17 + Spring Boot 3.4 + Maven para buscar y validar proveedores mineros certificados.

## Correr

```bash
mvn spring-boot:run                              # H2 en memoria (por defecto)
mvn spring-boot:run -Dspring-boot.run.profiles=postgres   # PostgreSQL (ver application.yml)
mvn test
```

H2 console: http://localhost:8080/h2-console  (jdbc:h2:mem:miningdb, user `sa`, sin password)

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/suppliers` | Búsqueda paginada. Params: `text`, `province`, `categoryIds`, `requiredCertifications` (repetible), `page`, `size`, `sort` |
| GET | `/api/suppliers/{id}` | Perfil con certificaciones y semáforo (`VALID`, `EXPIRING_SOON`, `EXPIRED`) |
| POST | `/api/suppliers/match` | Ranking contra requisitos: `{"requiredCertifications":["ISO_45001","HIGH_ALTITUDE"],"province":"Jujuy"}` |
| GET | `/api/catalog/categories` | Rubros |
| GET | `/api/catalog/certification-types` | Tipos de certificación |

Ejemplos:

```bash
curl "http://localhost:8080/api/suppliers?requiredCertifications=ISO_45001&requiredCertifications=HIGH_ALTITUDE&province=Jujuy"
curl -X POST localhost:8080/api/suppliers/match -H "Content-Type: application/json" \
     -d '{"requiredCertifications":["ISO_9001","ISO_14001","ISO_45001"]}'
```

## Estructura

```
model/       entidades JPA (Supplier, Category, CertificationType, Certification)
repository/  Spring Data + SupplierSpecifications (filtros dinámicos)
service/     SupplierService (búsqueda), MatchingService (ranking), CatalogService
controller/  REST
dto/ mapper/ exception/ config/ (CORS, DataSeeder)
```

## Siguiente paso: IA

Crear `AiAssistantService` que convierta lenguaje natural en un `SupplierSearchRequest` (LLM con salida JSON)
y llame a `SupplierService.search(...)`. La IA no toca la base: solo arma los filtros.
