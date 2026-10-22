package com.iinnoa.miningsuppliers.dto;

import com.iinnoa.miningsuppliers.model.CertificationStatus;

import java.time.LocalDate;

public record CertificationDto(
        Long id,
        String typeCode,
        String typeName,
        String issuer,
        String certificateNumber,
        LocalDate issueDate,
        LocalDate expirationDate,
        String documentUrl,
        CertificationStatus status,
        long daysToExpire) {
}
