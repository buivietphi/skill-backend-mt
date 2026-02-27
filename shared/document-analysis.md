# Document Analysis for Backend

> Parse API specs, ERD diagrams, requirements docs, and Postman collections.

---

## Supported Document Types

### OpenAPI / Swagger Spec
```
INPUT: openapi.yaml or swagger.json
EXTRACT:
  1. All endpoints (method + path + description)
  2. Request/response schemas
  3. Authentication requirements
  4. Query parameters and path parameters
  5. Error response formats
OUTPUT: Scaffold controllers, DTOs, and services matching the spec
```

### ERD / Database Diagram
```
INPUT: Image of ERD or SQL schema file
EXTRACT:
  1. Tables and columns with types
  2. Primary keys and foreign keys
  3. Relationships (1:1, 1:N, M:N)
  4. Indexes and constraints
  5. Nullable vs required fields
OUTPUT: Entity/Model definitions + migration files
```

### Postman Collection
```
INPUT: postman_collection.json
EXTRACT:
  1. All API endpoints with examples
  2. Request headers and auth tokens
  3. Request body examples
  4. Expected response format
  5. Environment variables used
OUTPUT: API endpoint scaffold matching the collection
```

### Requirements Document
```
INPUT: PRD, user stories, feature spec (PDF, DOCX, text)
EXTRACT:
  1. Feature list (what needs to be built)
  2. User roles and permissions
  3. Data models (entities and relationships)
  4. API endpoints needed
  5. Business rules and validation
  6. Integration points (external APIs)
OUTPUT: Feature breakdown → AI-DLC Units → Implementation plan
```

---

## Analysis Protocol

```
STEP 1: Identify document type
STEP 2: Extract structured data (tables, endpoints, schemas)
STEP 3: Map to backend concepts:
  - Entities → database tables
  - Endpoints → controllers/routes
  - Business rules → service layer
  - Permissions → auth/guard layer
  - External APIs → integration layer
STEP 4: Present extracted structure to user for confirmation
STEP 5: Scaffold code based on confirmed structure
```

---

## Image Analysis (Screenshots, Wireframes)

```
FOR API MOCKUPS / UI WIREFRAMES:
  1. Identify data requirements (what data does the UI need?)
  2. Identify CRUD operations (create, read, update, delete)
  3. Identify relationships between entities
  4. Map to API endpoints
  5. Scaffold backend to serve the UI
```
