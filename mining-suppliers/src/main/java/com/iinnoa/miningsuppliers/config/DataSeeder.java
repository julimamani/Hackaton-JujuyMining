package com.iinnoa.miningsuppliers.config;

import com.iinnoa.miningsuppliers.model.*;
import com.iinnoa.miningsuppliers.repository.CategoryRepository;
import com.iinnoa.miningsuppliers.repository.CertificationTypeRepository;
import com.iinnoa.miningsuppliers.repository.SupplierRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/** Loads the catalogs and ~24 fictional but realistic suppliers with mixed expiration dates. */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final String[] NAMES = {
            "Andes Cargo Logística", "Puna Transportes SRL", "Altiplano EPP Seguridad", "Quebrada Catering Minero",
            "Salar Voladuras S.A.", "Cóndor Mantenimiento Industrial", "Pachamama Servicios Ambientales",
            "Tilcara Perforaciones", "Yavi Geología Aplicada", "Abra Pampa Almacenes", "Cerro Azul Telecomunicaciones",
            "Hornocal Equipos Pesados", "Purmamarca Hotelería Técnica", "Lípez Combustibles", "Olaroz Ingeniería",
            "Cauchari Montajes", "Susques Transporte de Personal", "Tres Cruces Higiene y Seguridad",
            "Calilegua Consultores", "Libertador Maquinarias", "San Salvador Soldaduras", "Humahuaca Insumos Mineros",
            "Salinas Grandes Laboratorios", "Coranzulí Explosivos del Norte"
    };
    private static final String[] PROVINCES = {"Jujuy", "Salta", "Catamarca"};
    private static final Map<String, String[]> CITIES = Map.of(
            "Jujuy", new String[]{"San Salvador de Jujuy", "Palpalá", "Libertador General San Martín"},
            "Salta", new String[]{"Salta", "San Antonio de los Cobres", "General Güemes"},
            "Catamarca", new String[]{"San Fernando del Valle de Catamarca", "Fiambalá", "Belén"});
    private static final String[] CATEGORIES = {
            "Transporte de carga", "Transporte de personal", "Equipos de protección personal (EPP)",
            "Catering y hotelería", "Voladura y explosivos", "Mantenimiento de maquinaria",
            "Servicios ambientales", "Geología y perforación", "Logística y almacenes",
            "Seguridad e higiene", "Telecomunicaciones", "Laboratorio y análisis"
    };
    private static final String[] ISSUERS = {"IRAM", "Bureau Veritas", "TÜV Rheinland", "SGS Argentina", "DNV"};

    private final SupplierRepository supplierRepository;
    private final CategoryRepository categoryRepository;
    private final CertificationTypeRepository typeRepository;

    public DataSeeder(SupplierRepository supplierRepository, CategoryRepository categoryRepository,
                      CertificationTypeRepository typeRepository) {
        this.supplierRepository = supplierRepository;
        this.categoryRepository = categoryRepository;
        this.typeRepository = typeRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (supplierRepository.count() > 0) {
            return;
        }

        List<CertificationType> types = typeRepository.saveAll(List.of(
                new CertificationType("ISO_9001", "ISO 9001 - Gestión de la calidad",
                        "Sistema de gestión de la calidad", CertificationArea.QUALITY),
                new CertificationType("ISO_14001", "ISO 14001 - Gestión ambiental",
                        "Sistema de gestión ambiental", CertificationArea.ENVIRONMENT),
                new CertificationType("ISO_45001", "ISO 45001 - Seguridad y salud en el trabajo",
                        "Sistema de gestión de seguridad y salud ocupacional", CertificationArea.SAFETY),
                new CertificationType("ESG", "Norma de sostenibilidad ESG",
                        "Cumplimiento de criterios ambientales, sociales y de gobernanza", CertificationArea.SUSTAINABILITY),
                new CertificationType("HIGH_ALTITUDE", "Habilitación para trabajo en alta montaña",
                        "Aptitud operativa para trabajos sobre 3.000 msnm", CertificationArea.OPERATIONAL)));

        List<Category> categories = new ArrayList<>();
        for (String name : CATEGORIES) {
            categories.add(new Category(name));
        }
        categories = categoryRepository.saveAll(categories);

        Random random = new Random(42);          // fixed seed: same demo data on every run
        LocalDate today = LocalDate.now();
        List<Supplier> suppliers = new ArrayList<>();

        for (int i = 0; i < NAMES.length; i++) {
            Supplier s = new Supplier();
            s.setName(NAMES[i]);
            s.setTaxId(String.format("30-%08d-%d", 70_000_000 + i * 137, i % 10));
            s.setDescription("Proveedor del sector minero: " + NAMES[i] + ". Operaciones en el NOA argentino.");
            String province = PROVINCES[i % PROVINCES.length];
            s.setProvince(province);
            String[] cities = CITIES.get(province);
            s.setCity(cities[random.nextInt(cities.length)]);
            s.setContactEmail("contacto@" + NAMES[i].toLowerCase().replaceAll("[^a-z]", "") + ".example.com");
            s.setContactPhone("+54 388 4" + (100000 + random.nextInt(899999)));
            s.setWebsite("https://www." + NAMES[i].toLowerCase().replaceAll("[^a-z]", "") + ".example.com");

            s.getCategories().add(categories.get(i % categories.size()));
            if (random.nextBoolean()) {
                s.getCategories().add(categories.get(random.nextInt(categories.size())));
            }

            boolean fullyCompliant = i % 5 == 0;   // some suppliers are always 100% valid for the demo
            for (CertificationType type : types) {
                if (!fullyCompliant && random.nextDouble() > 0.65) {
                    continue;                      // supplier does not have this certification
                }
                int expirationOffsetDays = fullyCompliant
                        ? 200 + random.nextInt(500)
                        : -240 + random.nextInt(960);   // from ~8 months expired to ~2 years valid

                Certification c = new Certification();
                c.setType(type);
                c.setIssuer(ISSUERS[random.nextInt(ISSUERS.length)]);
                c.setCertificateNumber(type.getCode() + "-" + (10000 + random.nextInt(89999)));
                c.setExpirationDate(today.plusDays(expirationOffsetDays));
                c.setIssueDate(c.getExpirationDate().minusYears(3));
                c.setDocumentUrl("https://docs.example.com/certificates/" + c.getCertificateNumber() + ".pdf");
                s.addCertification(c);
            }
            suppliers.add(s);
        }
        supplierRepository.saveAll(suppliers);
    }
}
