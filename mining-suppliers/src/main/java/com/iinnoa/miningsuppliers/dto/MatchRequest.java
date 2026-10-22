package com.iinnoa.miningsuppliers.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record MatchRequest(
        @NotEmpty List<String> requiredCertifications,
        String province,
        List<Long> categoryIds) {
}
