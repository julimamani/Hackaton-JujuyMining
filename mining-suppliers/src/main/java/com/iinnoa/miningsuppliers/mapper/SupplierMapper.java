package com.iinnoa.miningsuppliers.mapper;

import com.iinnoa.miningsuppliers.dto.CertificationDto;
import com.iinnoa.miningsuppliers.dto.SupplierDetailDto;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import com.iinnoa.miningsuppliers.model.Category;
import com.iinnoa.miningsuppliers.model.Certification;
import com.iinnoa.miningsuppliers.model.CertificationStatus;
import com.iinnoa.miningsuppliers.model.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/** Must be called inside a transaction (lazy associations are read here). */
@Component
public class SupplierMapper {

    private final int expiringSoonDays;

    public SupplierMapper(@Value("${app.certification.expiring-soon-days}") int expiringSoonDays) {
        this.expiringSoonDays = expiringSoonDays;
    }

    public int expiringSoonDays() {
        return expiringSoonDays;
    }

    public CertificationStatus statusOf(Certification c) {
        return c.statusAt(LocalDate.now(), expiringSoonDays);
    }

    public CertificationDto toDto(Certification c) {
        LocalDate today = LocalDate.now();
        return new CertificationDto(
                c.getId(),
                c.getType().getCode(),
                c.getType().getName(),
                c.getIssuer(),
                c.getCertificateNumber(),
                c.getIssueDate(),
                c.getExpirationDate(),
                c.getDocumentUrl(),
                c.statusAt(today, expiringSoonDays),
                c.daysToExpire(today));
    }

    public SupplierSummaryDto toSummary(Supplier s) {
        List<String> valid = s.getCertifications().stream()
                .filter(c -> statusOf(c) != CertificationStatus.EXPIRED)
                .map(c -> c.getType().getCode())
                .distinct()
                .sorted()
                .toList();
        boolean hasExpired = s.getCertifications().stream()
                .anyMatch(c -> statusOf(c) == CertificationStatus.EXPIRED);
        return new SupplierSummaryDto(
                s.getId(), s.getName(), s.getTaxId(), s.getProvince(), s.getCity(),
                categoryNames(s), valid, hasExpired);
    }

    public SupplierDetailDto toDetail(Supplier s) {
        List<CertificationDto> certs = s.getCertifications().stream()
                .map(this::toDto)
                .sorted(Comparator.comparing(CertificationDto::typeCode)
                        .thenComparing(CertificationDto::expirationDate, Comparator.reverseOrder()))
                .toList();
        return new SupplierDetailDto(
                s.getId(), s.getName(), s.getTaxId(), s.getDescription(), s.getProvince(), s.getCity(),
                s.getContactEmail(), s.getContactPhone(), s.getWebsite(), categoryNames(s), certs);
    }

    private List<String> categoryNames(Supplier s) {
        return s.getCategories().stream().map(Category::getName).sorted().toList();
    }
}
