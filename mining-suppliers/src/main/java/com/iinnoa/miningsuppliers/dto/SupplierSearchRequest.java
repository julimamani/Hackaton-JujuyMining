package com.iinnoa.miningsuppliers.dto;

import java.util.List;

/** Query params for GET /api/suppliers. All fields are optional. */
public record SupplierSearchRequest(
        String text,
        String province,
        List<Long> categoryIds,
        List<String> requiredCertifications) {
}
