package com.iinnoa.miningsuppliers.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Getter
@Setter
@NoArgsConstructor
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** CUIT */
    @Column(nullable = false, unique = true)
    private String taxId;

    @Column(length = 1000)
    private String description;

    private String province;
    private String city;
    private String contactEmail;
    private String contactPhone;
    private String website;

    @ManyToMany
    @JoinTable(name = "supplier_category",
            joinColumns = @JoinColumn(name = "supplier_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    private Set<Category> categories = new HashSet<>();

    @OneToMany(mappedBy = "supplier", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Certification> certifications = new ArrayList<>();

    public void addCertification(Certification certification) {
        certification.setSupplier(this);
        certifications.add(certification);
    }
}
