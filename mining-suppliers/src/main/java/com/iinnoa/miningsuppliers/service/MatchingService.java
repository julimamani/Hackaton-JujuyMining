package com.iinnoa.miningsuppliers.service;

import com.iinnoa.miningsuppliers.dto.MatchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierMatchDto;
import com.iinnoa.miningsuppliers.mapper.SupplierMapper;
import com.iinnoa.miningsuppliers.model.Certification;
import com.iinnoa.miningsuppliers.model.CertificationStatus;
import com.iinnoa.miningsuppliers.model.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Ranks suppliers against a list of required certifications (a tender's requirements)
 * and explains, per supplier, what is met, expiring, expired or missing.
 */
@Service
@Transactional(readOnly = true)
public class MatchingService {

    private static final int POINTS_PER_MET = 10;
    private static final int POINTS_PER_EXPIRING = 7;
    private static final int POINTS_FULL_COMPLIANCE_BONUS = 100;

    private final SupplierService supplierService;
    private final SupplierMapper mapper;

    public MatchingService(SupplierService supplierService, SupplierMapper mapper) {
        this.supplierService = supplierService;
        this.mapper = mapper;
    }

    public List<SupplierMatchDto> match(MatchRequest request) {
        List<String> required = SupplierService.normalize(request.requiredCertifications());
        List<Supplier> candidates = supplierService.findCandidates(request.province(), request.categoryIds());

        return candidates.stream()
                .map(s -> evaluate(s, required))
                .sorted(Comparator.comparingInt(SupplierMatchDto::score).reversed()
                        .thenComparing(m -> m.supplier().name()))
                .toList();
    }

    private SupplierMatchDto evaluate(Supplier supplier, List<String> required) {
        List<String> met = new ArrayList<>();
        List<String> expiringSoon = new ArrayList<>();
        List<String> expired = new ArrayList<>();
        List<String> missing = new ArrayList<>();

        for (String code : required) {
            List<Certification> ofType = supplier.getCertifications().stream()
                    .filter(c -> c.getType().getCode().equalsIgnoreCase(code))
                    .toList();

            boolean hasValid = ofType.stream().anyMatch(c -> mapper.statusOf(c) == CertificationStatus.VALID);
            boolean hasExpiring = ofType.stream().anyMatch(c -> mapper.statusOf(c) == CertificationStatus.EXPIRING_SOON);

            if (hasValid) {
                met.add(code);
            } else if (hasExpiring) {
                expiringSoon.add(code);      // still valid today, but renewal is close
            } else if (!ofType.isEmpty()) {
                expired.add(code);
            } else {
                missing.add(code);
            }
        }

        boolean fullyCompliant = expired.isEmpty() && missing.isEmpty();
        int score = met.size() * POINTS_PER_MET
                + expiringSoon.size() * POINTS_PER_EXPIRING
                + (fullyCompliant ? POINTS_FULL_COMPLIANCE_BONUS : 0);

        return new SupplierMatchDto(mapper.toSummary(supplier), met, expiringSoon, expired, missing,
                fullyCompliant, score);
    }
}
