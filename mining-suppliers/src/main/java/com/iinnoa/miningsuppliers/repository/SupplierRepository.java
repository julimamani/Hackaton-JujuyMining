package com.iinnoa.miningsuppliers.repository;

import com.iinnoa.miningsuppliers.model.Supplier;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<Supplier, Long>, JpaSpecificationExecutor<Supplier> {

    @EntityGraph(attributePaths = {"categories", "certifications", "certifications.type"})
    Optional<Supplier> findWithDetailsById(Long id);
}
