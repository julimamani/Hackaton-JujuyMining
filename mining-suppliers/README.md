# Mining Suppliers (Hackathon IINNOA - Jujuy Mining)

Backend en Java 17 + Spring Boot 3.5 + Spring AI 1.1 + Maven para buscar y validar proveedores mineros certificados.

## Correr

La integración usa **Ollama local** (sin API key). Requisitos:

```bash
# 1. Instalar Ollama (https://ollama.com) y levantar el servicio
ollama serve

# 2. Descargar el modelo configurado en application.yml
ollama pull llama3.1:8b

# 3. Arrancar la app
mvn spring-boot:run                              # H2 en memoria (por defecto)
mvn spring-boot:run -Dspring-boot.run.profiles=postgres   # PostgreSQL (ver application.yml)
mvn test
```

Si usás otro modelo, cambialo en `spring.ai.ollama.chat.options.model` (`llama3.1:8b`, `qwen2.5:7b`, `mistral`, etc.).

H2 console: http://localhost:8080/h2-console  (jdbc:h2:mem:miningdb, user `sa`, sin password)

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/suppliers` | Búsqueda paginada. Params: `text`, `province`, `categoryIds`, `requiredCertifications` (repetible), `page`, `size`, `sort` |
| GET | `/api/suppliers/{id}` | Perfil con certificaciones y semáforo (`VALID`, `EXPIRING_SOON`, `EXPIRED`) |
| POST | `/api/suppliers/match` | Ranking contra requisitos: `{"requiredCertifications":["ISO_45001","HIGH_ALTITUDE"],"province":"Jujuy"}` |
| POST | `/api/suppliers/ai-search` | Búsqueda en lenguaje natural: `{"query":"proveedores de transporte en Jujuy con ISO 45001"}` |
| GET | `/api/catalog/categories` | Rubros |
| GET | `/api/catalog/certification-types` | Tipos de certificación |

Ejemplos:

```bash
curl "http://localhost:8080/api/suppliers?requiredCertifications=ISO_45001&requiredCertifications=HIGH_ALTITUDE&province=Jujuy"
curl -X POST localhost:8080/api/suppliers/match -H "Content-Type: application/json" \
     -d '{"requiredCertifications":["ISO_9001","ISO_14001","ISO_45001"]}'
curl -X POST localhost:8080/api/suppliers/ai-search -H "Content-Type: application/json" \
     -d '{"query":"proveedores de transporte en Jujuy con ISO 45001"}'
```

## Estructura

```
model/       entidades JPA (Supplier, Category, CertificationType, Certification)
repository/  Spring Data + SupplierSpecifications (filtros dinámicos)
service/     SupplierService (búsqueda), MatchingService (ranking), CatalogService, AiAssistantService (Spring AI)
controller/  REST
dto/ mapper/ exception/ config/ (CORS, DataSeeder)
```

## IA

`AiAssistantService` usa `ChatClient` (Spring AI + Ollama local) para convertir lenguaje natural en un
`SupplierSearchRequest`; luego llama a `SupplierService.search(...)`. La IA no toca la base: solo arma los filtros.
