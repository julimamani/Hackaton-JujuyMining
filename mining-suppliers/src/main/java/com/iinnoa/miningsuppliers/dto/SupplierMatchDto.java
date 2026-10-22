package com.iinnoa.miningsuppliers.dto;

import java.util.List;

public record SupplierMatchDto(
        SupplierSummaryDto supplier,
        List<String> met,
        List<String> expiringSoon,
        List<String> expired,
        List<String> missing,
        boolean fullyCompliant,
        int score) {
}
