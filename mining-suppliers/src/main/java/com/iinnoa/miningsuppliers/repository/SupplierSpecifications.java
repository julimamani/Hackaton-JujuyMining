package com.iinnoa.miningsuppliers.repository;

import com.iinnoa.miningsuppliers.model.Certification;
import com.iinnoa.miningsuppliers.model.Supplier;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.Collection;

public final class SupplierSpecifications {

    private SupplierSpecifications() {
    }

    public static Specification<Supplier> nameOrDescriptionContains(String text) {
        return (root, query, cb) -> {
            String pattern = "%" + text.toLowerCase().trim() + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("description"), "")), pattern));
        };
    }

    public static Specification<Supplier> inProvince(String province) {
        return (root, query, cb) -> cb.equal(cb.lower(root.get("province")), province.toLowerCase().trim());
    }

    public static Specification<Supplier> inAnyCategory(Collection<Long> categoryIds) {
        return (root, query, cb) -> {
            query.distinct(true);
            return root.join("categories").get("id").in(categoryIds);
        };
    }

    /**
     * The supplier has, for the given certification code, at least one certification that has not expired.
     * Combine one of these per required code with .and(...) to get the "must have ALL" semantics.
     */
    public static Specification<Supplier> hasValidCertification(String code, LocalDate today) {
        return (root, query, cb) -> {
            Subquery<Long> sub = query.subquery(Long.class);
            Root<Certification> cert = sub.from(Certification.class);
            sub.select(cert.get("id")).where(
                    cb.equal(cert.get("supplier"), root),
                    cb.equal(cert.get("type").get("code"), code),
                    cb.greaterThanOrEqualTo(cert.get("expirationDate"), today));
            return cb.exists(sub);
        };
    }
}
