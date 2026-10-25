package com.iinnoa.miningsuppliers.service;

import com.iinnoa.miningsuppliers.dto.SupplierDetailDto;
import com.iinnoa.miningsuppliers.dto.SupplierSearchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import com.iinnoa.miningsuppliers.exception.NotFoundException;
import com.iinnoa.miningsuppliers.mapper.SupplierMapper;
import com.iinnoa.miningsuppliers.model.Supplier;
import com.iinnoa.miningsuppliers.repository.SupplierRepository;
import com.iinnoa.miningsuppliers.repository.SupplierSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final SupplierMapper mapper;

    public SupplierService(SupplierRepository supplierRepository, SupplierMapper mapper) {
        this.supplierRepository = supplierRepository;
        this.mapper = mapper;
    }

    /**
     * Single entry point for supplier search. The AI assistant should reuse this method
     * (natural language -> SupplierSearchRequest -> search) instead of querying the database itself.
     */
    public Page<SupplierSummaryDto> search(SupplierSearchRequest request, Pageable pageable) {
        return supplierRepository.findAll(buildSpec(request), pageable).map(mapper::toSummary);
    }

    /**
     * Misma búsqueda estructurada que {@link #search}, pero sin paginar.
     * La usa el asistente de IA para rankear por relevancia en memoria.
     */
    public List<SupplierSummaryDto> searchAll(SupplierSearchRequest request) {
        return supplierRepository.findAll(buildSpec(request), Sort.by("name")).stream()
                .map(mapper::toSummary)
                .toList();
    }

    private Specification<Supplier> buildSpec(SupplierSearchRequest request) {
        Specification<Supplier> spec = baseSpec(request.text(), request.province(), request.categoryIds());

        LocalDate today = LocalDate.now();
        for (String code : normalize(request.requiredCertifications())) {
            spec = spec.and(SupplierSpecifications.hasValidCertification(code, today));
        }
        return spec;
    }

    public SupplierDetailDto getDetail(Long id) {
        Supplier supplier = supplierRepository.findWithDetailsById(id)
                .orElseThrow(() -> new NotFoundException("Supplier not found: " + id));
        return mapper.toDetail(supplier);
    }

    /** Suppliers matching the non-certification filters; certification logic lives in MatchingService. */
    public List<Supplier> findCandidates(String province, List<Long> categoryIds) {
        return supplierRepository.findAll(baseSpec(null, province, categoryIds));
    }

    public static List<String> normalize(List<String> codes) {
        if (codes == null) {
            return List.of();
        }
        return codes.stream()
                .filter(c -> c != null && !c.isBlank())
                .map(c -> c.trim().toUpperCase())
                .distinct()
                .toList();
    }

    private Specification<Supplier> baseSpec(String text, String province, List<Long> categoryIds) {
        Specification<Supplier> spec = (root, query, cb) -> cb.conjunction();
        if (text != null && !text.isBlank()) {
            spec = spec.and(SupplierSpecifications.nameOrDescriptionContains(text));
        }
        if (province != null && !province.isBlank()) {
            spec = spec.and(SupplierSpecifications.inProvince(province));
        }
        if (categoryIds != null && !categoryIds.isEmpty()) {
            spec = spec.and(SupplierSpecifications.inAnyCategory(categoryIds));
        }
        return spec;
    }
}
