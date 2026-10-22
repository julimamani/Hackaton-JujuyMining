package com.iinnoa.miningsuppliers.repository;

import com.iinnoa.miningsuppliers.model.CertificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CertificationTypeRepository extends JpaRepository<CertificationType, Long> {

    Optional<CertificationType> findByCode(String code);
}
