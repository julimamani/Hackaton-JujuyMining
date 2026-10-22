package com.iinnoa.miningsuppliers.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Certification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "type_id")
    private CertificationType type;

    private String issuer;
    private String certificateNumber;
    private LocalDate issueDate;

    @Column(nullable = false)
    private LocalDate expirationDate;

    private String documentUrl;

    /** The status is never stored: it is derived from the expiration date. */
    public CertificationStatus statusAt(LocalDate today, int expiringSoonDays) {
        if (expirationDate.isBefore(today)) {
            return CertificationStatus.EXPIRED;
        }
        if (expirationDate.isBefore(today.plusDays(expiringSoonDays))) {
            return CertificationStatus.EXPIRING_SOON;
        }
        return CertificationStatus.VALID;
    }

    public long daysToExpire(LocalDate today) {
        return ChronoUnit.DAYS.between(today, expirationDate);
    }
}
