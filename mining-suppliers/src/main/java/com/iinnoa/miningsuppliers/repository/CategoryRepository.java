package com.iinnoa.miningsuppliers.repository;

import com.iinnoa.miningsuppliers.model.Category;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
}
