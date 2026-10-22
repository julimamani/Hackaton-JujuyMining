package com.iinnoa.miningsuppliers.controller;

import com.iinnoa.miningsuppliers.dto.CategoryDto;
import com.iinnoa.miningsuppliers.dto.CertificationTypeDto;
import com.iinnoa.miningsuppliers.service.CatalogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final CatalogService catalogService;

    public CatalogController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/categories")
    public List<CategoryDto> categories() {
        return catalogService.categories();
    }

    @GetMapping("/certification-types")
    public List<CertificationTypeDto> certificationTypes() {
        return catalogService.certificationTypes();
    }
}
