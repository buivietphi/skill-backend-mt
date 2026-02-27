# Spring Boot — Production Patterns

> Annotations, Spring Data JPA, Security, multi-module, testing.
> Reference: spring-projects/spring-boot (76k+ stars)

---

## Project Structure

```
src/main/java/com/example/app/
├── config/
│   ├── SecurityConfig.java          ← Spring Security config
│   ├── WebConfig.java               ← CORS, converters
│   ├── CacheConfig.java
│   └── SwaggerConfig.java           ← OpenAPI docs
├── modules/
│   ├── users/
│   │   ├── UserController.java      ← @RestController
│   │   ├── UserService.java         ← @Service
│   │   ├── UserRepository.java      ← @Repository (Spring Data JPA)
│   │   ├── User.java                ← @Entity
│   │   ├── dto/
│   │   │   ├── CreateUserRequest.java ← @Valid annotations
│   │   │   ├── UpdateUserRequest.java
│   │   │   └── UserResponse.java
│   │   └── exceptions/
│   │       └── UserNotFoundException.java
│   ├── auth/
│   │   ├── AuthController.java
│   │   ├── AuthService.java
│   │   ├── JwtTokenProvider.java
│   │   └── JwtAuthFilter.java
│   └── common/
│       ├── BaseEntity.java          ← id, createdAt, updatedAt
│       ├── GlobalExceptionHandler.java ← @ControllerAdvice
│       ├── ErrorResponse.java
│       └── PageResponse.java
├── Application.java                  ← @SpringBootApplication

src/main/resources/
├── application.yml
├── application-dev.yml
├── application-prod.yml
└── db/migration/                    ← Flyway migrations
    ├── V1__create_users_table.sql
    └── V2__add_orders_table.sql

src/test/java/com/example/app/
├── modules/users/
│   ├── UserServiceTest.java
│   └── UserControllerIntegrationTest.java
└── TestApplication.java
```

---

## Core Patterns

### Entity
```java
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User extends BaseEntity {

    @Column(unique = true, nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    @JsonIgnore
    private String passwordHash;

    @Column(nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role = Role.USER;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    private List<Order> orders;
}
```

### Repository
```java
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.active = true")
    Page<User> findAllActive(Pageable pageable);

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.orders WHERE u.id = :id")
    Optional<User> findByIdWithOrders(@Param("id") UUID id);

    boolean existsByEmail(String email);
}
```

### Service
```java
@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public Page<User> findAll(Pageable pageable) {
        return userRepository.findAllActive(pageable);
    }

    public User findById(UUID id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
    }

    @Transactional
    public User create(CreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("Email already in use");
        }
        User user = new User();
        user.setEmail(request.getEmail());
        user.setName(request.getName());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        return userRepository.save(user);
    }
}
```

### Controller
```java
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public PageResponse<UserResponse> findAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<User> users = userService.findAll(PageRequest.of(page, size));
        return PageResponse.from(users.map(UserResponse::from));
    }

    @GetMapping("/{id}")
    public UserResponse findById(@PathVariable UUID id) {
        return UserResponse.from(userService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return UserResponse.from(userService.create(request));
    }
}
```

### DTO with Validation
```java
public record CreateUserRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 2, max = 100) String name,
    @NotBlank @Size(min = 8) String password
) {}

public record UserResponse(UUID id, String email, String name, Instant createdAt) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getCreatedAt());
    }
}
```

### Global Exception Handler
```java
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(UserNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(UserNotFoundException ex) {
        return new ErrorResponse("NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {
        var details = ex.getBindingResult().getFieldErrors().stream()
            .map(e -> Map.of("field", e.getField(), "message", e.getDefaultMessage()))
            .toList();
        return new ErrorResponse("VALIDATION_ERROR", "Validation failed", details);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ErrorResponse handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return new ErrorResponse("INTERNAL_ERROR", "Internal server error");
    }
}
```

---

## Spring Security + JWT

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthFilter jwtFilter) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/health", "/docs/**").permitAll()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

---

## Flyway Migrations

```sql
-- db/migration/V1__create_users_table.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active);
```

---

## Common Libraries

```
CATEGORY            LIBRARY                     PURPOSE
──────────────────────────────────────────────────────────
Web                 spring-boot-starter-web     REST API
Data                spring-boot-starter-data-jpa JPA/Hibernate
Security            spring-boot-starter-security Auth
Validation          spring-boot-starter-validation Bean validation
Cache               spring-boot-starter-cache   Caching
Actuator            spring-boot-starter-actuator Health + metrics
Migration           flyway-core / liquibase     DB migrations
Docs                springdoc-openapi           OpenAPI/Swagger
Testing             spring-boot-starter-test    Test framework
Mapping             mapstruct                   DTO mapping
Logging             logback (default)           Structured logging
```
