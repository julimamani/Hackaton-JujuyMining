package com.iinnoa.miningsuppliers.dto;

import jakarta.validation.constraints.NotBlank;

/** Natural-language query for the AI assistant, e.g. "proveedores de transporte en Jujuy con ISO 45001". */
public record AiSearchRequest(@NotBlank String query) {
}
