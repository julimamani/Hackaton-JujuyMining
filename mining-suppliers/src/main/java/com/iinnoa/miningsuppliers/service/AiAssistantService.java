package com.iinnoa.miningsuppliers.service;

import com.iinnoa.miningsuppliers.dto.AiPlanDto;
import com.iinnoa.miningsuppliers.dto.SupplierSearchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Búsqueda inteligente de proveedores.
 *
 * <p>La IA se usa solo cuando la consulta no se puede interpretar con reglas locales.
 * Para el resto de los casos se resuelve al instante (provincia, certificaciones y
 * palabras clave del rubro), y luego se rankean los candidatos en memoria. El LLM
 * nunca consulta la base: únicamente traduce la consulta a filtros.</p>
 */
@Service
public class AiAssistantService {

    private static final Logger log = LoggerFactory.getLogger(AiAssistantService.class);

    private static final String SYSTEM_PROMPT = """
            Eres un extractor de filtros para un buscador de proveedores mineros del NOA argentino.
            Respondé SOLO un objeto JSON con esta forma:
            {"text": string|null, "province": "Jujuy"|"Salta"|"Catamarca"|null, "categoryIds": null,
             "requiredCertifications": [], "excludedCertifications": [], "excludeAllCertifications": false}

            Reglas:
            - text: 1 a 3 palabras clave del rubro o servicio pedido, en singular y sin conectores
              (ej. "transporte", "catering", "voladura", "geologia", "seguridad"). Si no hay un rubro
              claro, usá null.
            - province: solo si el usuario nombra explícitamente Jujuy, Salta o Catamarca; si no, null.
            - requiredCertifications: certificaciones que el usuario SÍ pide, con estos códigos exactos:
              ISO_9001, ISO_14001, ISO_45001, ESG, HIGH_ALTITUDE. Si no se piden, lista vacía.
            - excludedCertifications: certificaciones que el usuario NO quiere ("sin ISO 9001",
              "que no tengan ISO 45001", "sin certificación ambiental"). Mismos códigos.
            - excludeAllCertifications: true solo si pide proveedores sin ninguna certificación
              ("sin certificaciones", "no certificados"). En ese caso las otras listas van vacías.
            - Una certificación nunca va en required y excluded al mismo tiempo.
            - No inventes datos, no agregues explicaciones ni texto fuera del JSON.
            """;

    private static final Map<String, String> PROVINCES = Map.of(
            "jujuy", "Jujuy",
            "salta", "Salta",
            "catamarca", "Catamarca"
    );

    /** Palabras sin valor de búsqueda: conectores, genéricos del rubro y nombres de certificaciones. */
    private static final Set<String> STOP_WORDS = Set.of(
            "proveedor", "proveedores", "empresa", "empresas", "que", "con", "para", "por",
            "del", "las", "los", "una", "uno", "unos", "unas", "de", "en", "el", "la", "y",
            "o", "a", "al", "se", "su", "sus", "busco", "buscar", "necesito", "quiero",
            "minero", "minera", "mineros", "mineras", "sector", "noa", "argentina", "servicio",
            "servicios", "trabajo", "trabajos", "operacion", "operaciones", "cuit", "rut",
            "certificacion", "certificaciones", "certificado", "certificados", "certificada",
            "certificadas", "norma", "normas", "iso", "9001", "14001", "45001", "esg",
            "high", "altitude", "altura", "montana", "3000", "msnm",
            "trabajar", "trabaja", "trabajan", "puedan", "puede", "tengan",
            "tiene", "tener", "sean", "ser", "como", "donde", "cual", "cuales",
            "sin", "no", "ni", "excepto", "salvo", "ninguna", "ninguno", "ningun",
            "alguna", "alguno", "algun", "vigente", "vigentes", "vencida", "vencidas",
            "vencido", "vencidos", "tipo", "hay", "embargo",
            "hagan", "hacer", "hacen", "hace", "realicen", "realizar", "realiza",
            "presten", "prestar", "presta", "ofrezcan", "ofrecer", "ofrece"
    );

    /** Señales de rubro que permiten resolver la consulta sin llamar al LLM. */
    private static final List<String> CATEGORY_HINTS = List.of(
            "transporte", "carga", "personal", "epp", "proteccion", "catering", "hotel",
            "voladura", "explosivo", "mantenimiento", "maquinaria", "ambiental", "geologia",
            "perforacion", "logistica", "almacen", "higiene", "telecomunicacion", "laboratorio",
            "analisis", "combustible", "insumo", "equipo", "montaje", "soldadura", "consultor",
            "ingenieria", "topografia", "seguridad"
    );

    /** Inicio de una cláusula negativa: "sin ISO 9001", "no tengan ISO 45001", etc. */
    private static final Pattern NEGATION_START = Pattern.compile(
            "\\b(?:sin|excepto|salvo|no\\s+(?:tiene|tienen|tenga|tengan|cuenta|cuentan|cuente|cuenten"
                    + "|posee|poseen|posea|posean|esta|estan|esten| |certificad[oa]s?))\\b");

    /** Marcas que cortan una negación y vuelven a un contexto positivo. */
    private static final List<String> POSITIVE_MARKERS = List.of(
            " con ", " que tengan ", " que tenga ", " que cuenten ", " que cuente ",
            " pero ", " aunque ", " y con ", " e con ", " quiero ", " necesito ", " busco "
    );

    private static final List<String> ISO_CODES = List.of("ISO_9001", "ISO_14001", "ISO_45001");

    /** Sinónimos de rubro para no depender de la palabra exacta. */
    private static final Map<String, List<String>> SYNONYMS = Map.ofEntries(
            Map.entry("transporte", List.of("carga", "personal")),
            Map.entry("carga", List.of("transporte")),
            Map.entry("personal", List.of("transporte")),
            Map.entry("catering", List.of("hoteleria", "comedor")),
            Map.entry("hoteleria", List.of("catering", "hotel")),
            Map.entry("voladura", List.of("explosivo")),
            Map.entry("explosivo", List.of("voladura")),
            Map.entry("epp", List.of("proteccion")),
            Map.entry("proteccion", List.of("epp")),
            Map.entry("logistica", List.of("almacen", "transporte")),
            Map.entry("almacen", List.of("logistica")),
            Map.entry("ambiental", List.of("ambiente")),
            Map.entry("geologia", List.of("perforacion")),
            Map.entry("perforacion", List.of("geologia")),
            Map.entry("mantenimiento", List.of("maquinaria")),
            Map.entry("maquinaria", List.of("mantenimiento", "equipo")),
            Map.entry("seguridad", List.of("higiene")),
            Map.entry("higiene", List.of("seguridad")),
            Map.entry("telecomunicacion", List.of("comunicacion")),
            Map.entry("laboratorio", List.of("analisis")),
            Map.entry("analisis", List.of("laboratorio")),
            Map.entry("equipo", List.of("maquinaria")),
            Map.entry("montaje", List.of("mantenimiento", "soldadura")),
            Map.entry("soldadura", List.of("montaje")),
            Map.entry("topografia", List.of("geologia"))
    );

    private static final Duration CACHE_TTL = Duration.ofMinutes(10);
    private static final int CACHE_LIMIT = 256;
    private static final long AI_TIMEOUT_SECONDS = 12;
    /** Tras un fallo de Ollama no reintentamos en cada consulta: evitamos esperas repetidas. */
    private static final long AI_COOLDOWN_MS = Duration.ofMinutes(2).toMillis();

    private final ChatClient chatClient;
    private final SupplierService supplierService;

    /** Si Ollama está caído o colgado, saltamos la llamada al modelo por un rato. */
    private volatile long aiUnavailableUntil = 0;

    private final Map<String, CachedPlan> planCache = Collections.synchronizedMap(
            new LinkedHashMap<>(32, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CachedPlan> eldest) {
                    return size() > CACHE_LIMIT;
                }
            });

    public AiAssistantService(ChatClient.Builder chatClientBuilder, SupplierService supplierService) {
        this.chatClient = chatClientBuilder.build();
        this.supplierService = supplierService;
    }

    public AiSearchResult search(String query, Pageable pageable) {
        PlanResult planned = resolvePlan(query);
        AiPlan plan = planned.plan();

        List<SupplierSummaryDto> candidates = supplierService.searchAll(
                        new SupplierSearchRequest(null, plan.province(), null, plan.certifications()))
                .stream()
                .filter(supplier -> matchesCertificationFilters(supplier, plan))
                .toList();

        List<String> keywords = mergeKeywords(query, plan.text());
        List<SupplierSummaryDto> ranked = rank(candidates, keywords, true);
        if (ranked.isEmpty() && keywords.size() > 1) {
            // Consulta demasiado específica: mejor mostrar coincidencias parciales que nada.
            ranked = rank(candidates, keywords, false);
        }

        // Sin palabras clave (o con la IA caída) mostramos los candidatos estructurales
        // en lugar de una pantalla vacía.
        if (ranked.isEmpty() && (keywords.isEmpty() || "fallback".equals(planned.mode()))) {
            ranked = candidates;
        }

        log.info("AI search query='{}' mode={} province={} certs={} excluded={} excludeAll={} keywords={} candidates={} results={}",
                query, planned.mode(), plan.province(), plan.certifications(), plan.excludedCertifications(),
                plan.excludeAllCertifications(), keywords, candidates.size(), ranked.size());

        return new AiSearchResult(paginate(ranked, pageable), planned.mode());
    }

    /** Resultado + modo de resolución (rules, cache, llm o fallback). */
    public record AiSearchResult(Page<SupplierSummaryDto> page, String mode) {
    }

    private Page<SupplierSummaryDto> paginate(List<SupplierSummaryDto> results, Pageable pageable) {
        int from = (int) Math.min(pageable.getOffset(), results.size());
        int to = Math.min(from + pageable.getPageSize(), results.size());
        return new PageImpl<>(results.subList(from, to), pageable, results.size());
    }

    private static boolean matchesCertificationFilters(SupplierSummaryDto supplier, AiPlan plan) {
        List<String> valid = supplier.validCertifications() == null ? List.of() : supplier.validCertifications();
        if (plan.excludeAllCertifications()) {
            return valid.isEmpty();
        }
        return plan.excludedCertifications().stream().noneMatch(valid::contains);
    }

    // ------------------------------------------------------------------
    // Interpretación de la consulta
    // ------------------------------------------------------------------

    private PlanResult resolvePlan(String query) {
        String cacheKey = normalize(query);
        CachedPlan cached = planCache.get(cacheKey);
        long now = System.currentTimeMillis();
        if (cached != null && now - cached.createdAt() < CACHE_TTL.toMillis()) {
            return new PlanResult(cached.plan(), "cache");
        }

        AiPlan rulePlan = ruleBasedPlan(query);
        boolean confident = rulePlan.province() != null
                || !rulePlan.certifications().isEmpty()
                || !rulePlan.excludedCertifications().isEmpty()
                || rulePlan.excludeAllCertifications()
                || hasCategoryHint(query)
                || hasLongNumber(query)
                || extractKeywords(query).isEmpty();

        String mode = "rules";
        AiPlan plan = rulePlan;
        if (!confident) {
            if (System.currentTimeMillis() < aiUnavailableUntil) {
                // Ollama falló hace poco: respondemos al instante con la interpretación local.
                mode = "fallback";
            } else {
                AiPlan aiPlan = askAi(query);
                if (aiPlan != null) {
                    plan = merge(rulePlan, aiPlan);
                    mode = "llm";
                } else {
                    mode = "fallback";
                }
            }
        }

        planCache.put(cacheKey, new CachedPlan(plan, mode, now));
        return new PlanResult(plan, mode);
    }

    private AiPlan ruleBasedPlan(String query) {
        String text = normalize(query);

        String province = PROVINCES.entrySet().stream()
                .filter(entry -> containsWord(text, entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);

        CertFilters filters = parseCertFilters(text);
        List<String> certifications = new ArrayList<>();

        if (!filters.excludeAll()) {
            if (mentions(text, "9001") && !filters.excluded().contains("ISO_9001")) {
                certifications.add("ISO_9001");
            }
            if (mentions(text, "14001") && !filters.excluded().contains("ISO_14001")) {
                certifications.add("ISO_14001");
            }
            if (mentions(text, "45001") && !filters.excluded().contains("ISO_45001")) {
                certifications.add("ISO_45001");
            }
            if ((mentions(text, "esg") || mentions(text, "sostenibilidad") || mentions(text, "sustentabilidad"))
                    && !filters.excluded().contains("ESG")) {
                certifications.add("ESG");
            }
            if ((mentions(text, "alta montana") || mentions(text, "montana") || mentions(text, "altura")
                    || mentions(text, "high altitude") || mentions(text, "3000"))
                    && !filters.excluded().contains("HIGH_ALTITUDE")) {
                certifications.add("HIGH_ALTITUDE");
            }
        }

        return new AiPlan(null, province, List.copyOf(certifications),
                filters.excluded(), filters.excludeAll());
    }

    /**
     * Detecta certificaciones negadas ("sin ISO 9001", "no tengan ISO 45001",
     * "sin certificaciones") sin confundirlas con pedidos positivos.
     */
    private CertFilters parseCertFilters(String text) {
        Set<String> excluded = new LinkedHashSet<>();
        boolean excludeAll = false;

        Matcher matcher = NEGATION_START.matcher(text);
        while (matcher.find()) {
            String rest = stripLeadingNegationFillers(text.substring(matcher.end()));
            String segment = rest.substring(0, positiveBoundaryIndex(rest));
            if (segment.isBlank()) {
                // "no certificados" / "no certificado": no queda texto después del verbo.
                if (matcher.group().startsWith("no certificad")) {
                    excludeAll = true;
                }
                continue;
            }
            if (segment.startsWith("embargo")) {
                continue;
            }

            boolean specificIso = addIsoNumbers(segment, excluded);
            boolean genericIso = !specificIso && segment.contains("iso");
            if (genericIso) {
                excluded.addAll(ISO_CODES);
            }

            boolean esg = segment.contains("esg") || segment.contains("sostenibilidad")
                    || segment.contains("sustentabilidad");
            if (esg) {
                excluded.add("ESG");
            }

            boolean altitude = segment.contains("alta montana") || segment.contains("montana")
                    || segment.contains("altura") || segment.contains("high altitude")
                    || segment.contains("3000");
            if (altitude) {
                excluded.add("HIGH_ALTITUDE");
            }

            boolean matchedCertification = specificIso || genericIso || esg || altitude;
            if (matchedCertification) {
                continue;
            }

            boolean alias = false;
            if (segment.contains("calidad")) {
                excluded.add("ISO_9001");
                alias = true;
            }
            if (segment.contains("ambiental") || segment.contains("ambiente")) {
                excluded.add("ISO_14001");
                alias = true;
            }
            if (segment.contains("seguridad laboral") || segment.contains("seguridad y salud")
                    || segment.contains("seguridad ocupacional")) {
                excluded.add("ISO_45001");
                alias = true;
            }
            if (segment.contains("sostenibilidad") || segment.contains("sustentabilidad")) {
                excluded.add("ESG");
                alias = true;
            }
            if (!alias && (segment.contains("certificacion") || segment.contains("certificado"))
                    && !segment.contains("vencid")) {
                excludeAll = true;
            }
        }

        return new CertFilters(List.copyOf(excluded), excludeAll);
    }

    private static boolean addIsoNumbers(String segment, Set<String> excluded) {
        boolean found = false;
        if (segment.contains("9001")) {
            excluded.add("ISO_9001");
            found = true;
        }
        if (segment.contains("14001")) {
            excluded.add("ISO_14001");
            found = true;
        }
        if (segment.contains("45001")) {
            excluded.add("ISO_45001");
            found = true;
        }
        return found;
    }

    /** Quita "con", "la", "certificación", etc. que siguen al verbo negado. */
    private static String stripLeadingNegationFillers(String value) {
        String result = value.stripLeading();
        String previous;
        do {
            previous = result;
            result = result.replaceFirst(
                    "^(?:con|de|en|la|el|las|los|una|un)\\s+", "");
        } while (!result.equals(previous));
        return result;
    }

    private static int positiveBoundaryIndex(String text) {
        int cut = text.length();
        for (String marker : POSITIVE_MARKERS) {
            int index = text.indexOf(marker);
            if (index >= 0 && index < cut) {
                cut = index;
            }
        }
        for (char delimiter : new char[]{';', ',', '.'}) {
            int index = text.indexOf(delimiter);
            if (index >= 0 && index < cut) {
                cut = index;
            }
        }
        return cut;
    }

    private boolean hasCategoryHint(String query) {
        String text = normalize(query);
        return CATEGORY_HINTS.stream().anyMatch(hint -> mentions(text, hint));
    }

    /** CUIT u otro identificador numérico: se resuelve localmente. */
    private boolean hasLongNumber(String query) {
        return Arrays.stream(normalize(query).split("[^\\p{L}\\p{N}]+"))
                .anyMatch(word -> isNumeric(word) && word.length() >= 6);
    }

    private AiPlan askAi(String query) {
        try {
            AiPlanDto request = CompletableFuture
                    .supplyAsync(() -> chatClient.prompt()
                            .system(SYSTEM_PROMPT)
                            .user(query)
                            .call()
                            .entity(AiPlanDto.class))
                    .orTimeout(AI_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                    .get();

            if (request == null) {
                aiUnavailableUntil = System.currentTimeMillis() + AI_COOLDOWN_MS;
                return null;
            }
            aiUnavailableUntil = 0;
            return new AiPlan(
                    request.text(),
                    canonicalProvince(request.province()),
                    canonicalCertifications(request.requiredCertifications()),
                    canonicalCertifications(request.excludedCertifications()),
                    request.excludeAllCertifications());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            aiUnavailableUntil = System.currentTimeMillis() + AI_COOLDOWN_MS;
            log.warn("Búsqueda con IA interrumpida; se usa la interpretación local");
            return null;
        } catch (Exception error) {
            aiUnavailableUntil = System.currentTimeMillis() + AI_COOLDOWN_MS;
            log.warn("Búsqueda con IA no disponible ({}); se usa la interpretación local", error.toString());
            return null;
        }
    }

    private AiPlan merge(AiPlan local, AiPlan ai) {
        String province = ai.province() != null ? ai.province() : local.province();
        Set<String> excluded = new LinkedHashSet<>(local.excludedCertifications());
        excluded.addAll(ai.excludedCertifications());

        boolean excludeAll = local.excludeAllCertifications() || ai.excludeAllCertifications();
        List<String> certifications = new ArrayList<>();
        if (!excludeAll) {
            for (String code : local.certifications()) {
                if (!excluded.contains(code) && !certifications.contains(code)) {
                    certifications.add(code);
                }
            }
            for (String code : ai.certifications()) {
                if (!excluded.contains(code) && !certifications.contains(code)) {
                    certifications.add(code);
                }
            }
        }

        String text = ai.text() != null && !ai.text().isBlank() ? ai.text() : local.text();
        return new AiPlan(text, province, List.copyOf(certifications),
                List.copyOf(excluded), excludeAll);
    }

    private static String canonicalProvince(String province) {
        if (province == null) {
            return null;
        }
        String normalized = normalize(province);
        return PROVINCES.entrySet().stream()
                .filter(entry -> normalized.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private static List<String> canonicalCertifications(List<String> certifications) {
        if (certifications == null) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (String raw : certifications) {
            String code = canonicalCertification(raw);
            if (code != null && !result.contains(code)) {
                result.add(code);
            }
        }
        return List.copyOf(result);
    }

    private static String canonicalCertification(String raw) {
        String value = normalize(raw).replace('_', ' ').replace('-', ' ');
        if (value.contains("9001")) {
            return "ISO_9001";
        }
        if (value.contains("14001")) {
            return "ISO_14001";
        }
        if (value.contains("45001")) {
            return "ISO_45001";
        }
        if (value.contains("esg")) {
            return "ESG";
        }
        if (value.contains("altitude") || value.contains("altura") || value.contains("montana")) {
            return "HIGH_ALTITUDE";
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Palabras clave y ranking
    // ------------------------------------------------------------------

    private static List<String> mergeKeywords(String query, String aiText) {
        List<String> keywords = new ArrayList<>(extractKeywords(query));
        if (aiText != null && !aiText.isBlank()) {
            for (String keyword : extractKeywords(aiText)) {
                if (!keywords.contains(keyword)) {
                    keywords.add(keyword);
                }
            }
        }
        return keywords;
    }

    private static List<String> extractKeywords(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        String normalized = normalize(text);
        return Arrays.stream(normalized.split("[^\\p{L}\\p{N}]+"))
                .filter(word -> word.length() > 2)
                .filter(word -> !STOP_WORDS.contains(word))
                .filter(word -> !PROVINCES.containsKey(word))
                .filter(word -> !isNumericCert(word))
                .filter(word -> !isNumeric(word) || word.length() >= 6)
                .distinct()
                .toList();
    }

    private static boolean isNumericCert(String word) {
        return word.equals("9001") || word.equals("14001") || word.equals("45001");
    }

    private static boolean isNumeric(String word) {
        return word.chars().allMatch(Character::isDigit);
    }

    private List<SupplierSummaryDto> rank(List<SupplierSummaryDto> candidates, List<String> keywords,
                                          boolean requireAllKeywords) {
        if (keywords.isEmpty()) {
            return candidates;
        }

        List<ScoredSupplier> scored = new ArrayList<>();
        for (SupplierSummaryDto supplier : candidates) {
            int score = 0;
            int hits = 0;
            for (String keyword : keywords) {
                int keywordScore = score(supplier, keyword);
                if (keywordScore > 0) {
                    hits++;
                    score += keywordScore;
                }
            }
            if (!requireAllKeywords || hits == keywords.size()) {
                scored.add(new ScoredSupplier(supplier, score));
            }
        }

        return scored.stream()
                .sorted(Comparator.comparingInt(ScoredSupplier::score).reversed()
                        .thenComparing(scoredSupplier -> scoredSupplier.supplier().name()))
                .map(ScoredSupplier::supplier)
                .toList();
    }

    private static int score(SupplierSummaryDto supplier, String keyword) {
        List<String> variants = variants(keyword);
        String categories = normalize(String.join(" ", supplier.categories()));
        String name = normalize(supplier.name());
        String certifications = normalize(String.join(" ", supplier.validCertifications())
                + " " + certificationAliases(supplier.validCertifications()));
        String location = normalize(supplier.city() + " " + supplier.province());
        String taxId = normalize(supplier.taxId());

        int score = 0;
        if (variants.stream().anyMatch(variant -> containsTerm(categories, variant))) {
            score += 4;
        }
        if (variants.stream().anyMatch(variant -> containsTerm(name, variant))) {
            score += 3;
        }
        if (variants.stream().anyMatch(variant -> containsTerm(certifications, variant))) {
            score += 2;
        }
        if (variants.stream().anyMatch(variant -> containsTerm(location, variant))) {
            score += 1;
        }
        if (variants.stream().anyMatch(variant -> taxId.contains(variant))) {
            score += 5;
        }
        return score;
    }

    private static List<String> variants(String keyword) {
        List<String> variants = new ArrayList<>();
        variants.add(keyword);
        variants.add(stem(keyword));
        variants.addAll(SYNONYMS.getOrDefault(keyword, List.of()));
        variants.addAll(SYNONYMS.getOrDefault(stem(keyword), List.of()));
        return variants.stream().distinct().toList();
    }

    private static String certificationAliases(List<String> certifications) {
        List<String> aliases = new ArrayList<>();
        for (String code : certifications) {
            switch (code) {
                case "ISO_9001" -> aliases.add("calidad");
                case "ISO_14001" -> aliases.add("ambiental medio ambiente");
                case "ISO_45001" -> aliases.add("seguridad higiene seguridad laboral");
                case "ESG" -> aliases.add("sostenibilidad sustentabilidad");
                case "HIGH_ALTITUDE" -> aliases.add("altura montana alta montana");
                default -> {
                    // sin alias
                }
            }
        }
        return String.join(" ", aliases);
    }

    /** Compara tolerando plurales simples (transporte/transportes, equipo/equipos). */
    private static boolean containsTerm(String haystack, String term) {
        if (haystack.contains(term)) {
            return true;
        }
        String stem = stem(term);
        return stem.length() >= 4 && haystack.contains(stem);
    }

    private static String stem(String term) {
        if (term.length() > 5 && term.endsWith("es")) {
            return term.substring(0, term.length() - 2);
        }
        if (term.length() > 4 && term.endsWith("s")) {
            return term.substring(0, term.length() - 1);
        }
        return term;
    }

    private static boolean containsWord(String haystack, String word) {
        return Arrays.asList(haystack.split("[^\\p{L}\\p{N}]+")).contains(word);
    }

    private static boolean mentions(String haystack, String needle) {
        return haystack.contains(needle);
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private record AiPlan(String text, String province, List<String> certifications,
                          List<String> excludedCertifications, boolean excludeAllCertifications) {
    }

    private record CertFilters(List<String> excluded, boolean excludeAll) {
    }

    private record CachedPlan(AiPlan plan, String mode, long createdAt) {
    }

    private record PlanResult(AiPlan plan, String mode) {
    }

    private record ScoredSupplier(SupplierSummaryDto supplier, int score) {
    }
}
