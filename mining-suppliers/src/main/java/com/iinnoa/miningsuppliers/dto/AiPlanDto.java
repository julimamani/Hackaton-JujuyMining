package com.iinnoa.miningsuppliers.dto;

import java.util.List;

/**
 * Filtros que devuelve el LLM para una consulta en lenguaje natural.
 * Incluye certificaciones pedidas y certificaciones explícitamente excluidas
 * ("sin ISO 9001").
 */
public record AiPlanDto(
        String text,
        String province,
        List<Long> categoryIds,
        List<String> requiredCertifications,
        List<String> excludedCertifications,
        boolean excludeAllCertifications) {
}
