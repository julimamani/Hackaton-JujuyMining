package com.iinnoa.miningsuppliers.controller;

import com.iinnoa.miningsuppliers.dto.AiSearchRequest;
import com.iinnoa.miningsuppliers.dto.MatchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierDetailDto;
import com.iinnoa.miningsuppliers.dto.SupplierMatchDto;
import com.iinnoa.miningsuppliers.dto.SupplierSearchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import com.iinnoa.miningsuppliers.service.AiAssistantService;
import com.iinnoa.miningsuppliers.service.MatchingService;
import com.iinnoa.miningsuppliers.service.SupplierService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;
    private final MatchingService matchingService;
    private final AiAssistantService aiAssistantService;

    public SupplierController(SupplierService supplierService, MatchingService matchingService,
                              AiAssistantService aiAssistantService) {
        this.supplierService = supplierService;
        this.matchingService = matchingService;
        this.aiAssistantService = aiAssistantService;
    }

    /** GET /api/suppliers?province=Jujuy&categoryIds=1&requiredCertifications=ISO_45001&requiredCertifications=HIGH_ALTITUDE */
    @GetMapping
    public Page<SupplierSummaryDto> search(SupplierSearchRequest request,
                                           @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return supplierService.search(request, pageable);
    }

    @GetMapping("/{id}")
    public SupplierDetailDto detail(@PathVariable Long id) {
        return supplierService.getDetail(id);
    }

    @PostMapping("/match")
    public List<SupplierMatchDto> match(@Valid @RequestBody MatchRequest request) {
        return matchingService.match(request);
    }

    /** POST /api/suppliers/ai-search with {"query":"proveedores de transporte en Jujuy con ISO 45001"} */
    @PostMapping("/ai-search")
    public Page<SupplierSummaryDto> aiSearch(@Valid @RequestBody AiSearchRequest request,
                                             @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return aiAssistantService.search(request.query(), pageable);
    }
}
