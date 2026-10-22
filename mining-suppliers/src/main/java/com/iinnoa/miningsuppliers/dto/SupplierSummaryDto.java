package com.iinnoa.miningsuppliers.dto;

import java.util.List;

public record SupplierSummaryDto(
        Long id,
        String name,
        String taxId,
        String province,
        String city,
        List<String> categories,
        List<String> validCertifications,
        boolean hasExpiredCertifications) {
}
