package com.iinnoa.miningsuppliers.service;

import com.iinnoa.miningsuppliers.dto.SupplierSearchRequest;
import com.iinnoa.miningsuppliers.dto.SupplierSummaryDto;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

/**
 * Translates natural-language queries into a {@link SupplierSearchRequest}.
 * The LLM never touches the database: it only builds the filters, then
 * {@link SupplierService#search} runs the real query.
 */
@Service
public class AiAssistantService {

    private static final String SYSTEM_PROMPT = """
            Eres un asistente que traduce consultas en lenguaje natural a filtros de búsqueda
            de proveedores mineros del NOA argentino.

            Devolvés JSON con exactamente estos campos:
            - text: texto libre para buscar por nombre o descripción, o null.
            - province: una de "Jujuy", "Salta", "Catamarca", o null.
            - categoryIds: siempre null (no inventes IDs).
            - requiredCertifications: lista de códigos EXACTOS entre ISO_9001, ISO_14001,
              ISO_45001, ESG, HIGH_ALTITUDE. Si no se piden certificaciones, lista vacía.

            No agregues explicaciones, solo el JSON.
            """;

    private final ChatClient chatClient;
    private final SupplierService supplierService;

    public AiAssistantService(ChatClient.Builder chatClientBuilder, SupplierService supplierService) {
        this.chatClient = chatClientBuilder.build();
        this.supplierService = supplierService;
    }

    public SupplierSearchRequest toSearchRequest(String query) {
        return chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(query)
                .call()
                .entity(SupplierSearchRequest.class);
    }

    public Page<SupplierSummaryDto> search(String query, Pageable pageable) {
        return supplierService.search(toSearchRequest(query), pageable);
    }
}
