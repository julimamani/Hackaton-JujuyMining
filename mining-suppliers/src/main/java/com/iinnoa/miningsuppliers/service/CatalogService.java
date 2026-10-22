package com.iinnoa.miningsuppliers.service;

import com.iinnoa.miningsuppliers.dto.CategoryDto;
import com.iinnoa.miningsuppliers.dto.CertificationTypeDto;
import com.iinnoa.miningsuppliers.repository.CategoryRepository;
import com.iinnoa.miningsuppliers.repository.CertificationTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class CatalogService {

    private final CategoryRepository categoryRepository;
    private final CertificationTypeRepository typeRepository;

    public CatalogService(CategoryRepository categoryRepository, CertificationTypeRepository typeRepository) {
        this.categoryRepository = categoryRepository;
        this.typeRepository = typeRepository;
    }

    public List<CategoryDto> categories() {
        return categoryRepository.findAll().stream()
                .map(c -> new CategoryDto(c.getId(), c.getName()))
                .sorted(Comparator.comparing(CategoryDto::name))
                .toList();
    }

    public List<CertificationTypeDto> certificationTypes() {
        return typeRepository.findAll().stream()
                .map(t -> new CertificationTypeDto(t.getId(), t.getCode(), t.getName(), t.getDescription(), t.getArea()))
                .sorted(Comparator.comparing(CertificationTypeDto::code))
                .toList();
    }
}
