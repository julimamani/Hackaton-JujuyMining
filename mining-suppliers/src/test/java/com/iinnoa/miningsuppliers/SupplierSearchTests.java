package com.iinnoa.miningsuppliers;

import com.iinnoa.miningsuppliers.dto.MatchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierMatchDto;
import com.iinnoa.miningsuppliers.dto.SupplierSearchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import com.iinnoa.miningsuppliers.service.MatchingService;
import com.iinnoa.miningsuppliers.service.SupplierService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class SupplierSearchTests {

    @Autowired
    SupplierService supplierService;

    @Autowired
    MatchingService matchingService;

    @Test
    void searchWithRequiredCertificationsReturnsOnlySuppliersWithAllOfThemValid() {
        Page<SupplierSummaryDto> page = supplierService.search(
                new SupplierSearchRequest(null, null, null, List.of("ISO_45001", "HIGH_ALTITUDE")),
                PageRequest.of(0, 100));

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent()).allSatisfy(s ->
                assertThat(s.validCertifications()).contains("ISO_45001", "HIGH_ALTITUDE"));
    }

    @Test
    void matchRanksFullyCompliantSuppliersFirst() {
        List<SupplierMatchDto> result = matchingService.match(
                new MatchRequest(List.of("ISO_9001", "ISO_45001"), null, null));

        assertThat(result).isNotEmpty();
        assertThat(result.get(0).fullyCompliant()).isTrue();
    }
}
