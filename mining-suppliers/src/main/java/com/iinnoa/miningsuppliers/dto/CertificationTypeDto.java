package com.iinnoa.miningsuppliers.dto;

import com.iinnoa.miningsuppliers.model.CertificationArea;

public record CertificationTypeDto(Long id, String code, String name, String description, CertificationArea area) {
}
