package com.iinnoa.miningsuppliers.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Catalog of possible certifications (ISO 9001, ISO 14001, ISO 45001, ESG, high altitude...). */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class CertificationType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CertificationArea area;

    public CertificationType(String code, String name, String description, CertificationArea area) {
        this.code = code;
        this.name = name;
        this.description = description;
        this.area = area;
    }
}
