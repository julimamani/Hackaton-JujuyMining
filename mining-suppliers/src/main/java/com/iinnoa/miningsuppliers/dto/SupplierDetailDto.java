package com.iinnoa.miningsuppliers.dto;

import java.util.List;

public record SupplierDetailDto(
        Long id,
        String name,
        String taxId,
        String description,
        String province,
        String city,
        String contactEmail,
        String contactPhone,
        String website,
        List<String> categories,
        List<CertificationDto> certifications) {
}
