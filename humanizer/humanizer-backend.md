---
name: humanizer-backend
description: "Humanize AI-generated backend code, comments, and documentation. Removes robotic patterns and makes code feel written by a senior engineer."
version: "1.0.0"
author: buivietphi
priority: low
user-invocable: true
---

# Humanizer Backend — Code & Documentation Humanizer

> Remove signs of AI-generated writing from backend code, comments, documentation, and API descriptions.

---

## What It Does

Transforms AI-generated backend content into natural, senior-engineer-quality writing:
- Code comments and docstrings
- API documentation and descriptions
- README files and technical docs
- Error messages and log messages
- Commit messages and PR descriptions

---

## Detection Patterns (Remove These)

### Overly Formal Language
```
❌ "This function is responsible for handling the user authentication process"
✅ "Authenticates user and returns JWT tokens"

❌ "The following endpoint allows clients to retrieve a paginated list of users"
✅ "List users (paginated)"

❌ "This comprehensive service encapsulates the business logic for order management"
✅ "Order service — CRUD + status transitions"
```

### Unnecessary Hedging
```
❌ "This might potentially help with..."
✅ "This fixes..."

❌ "It's worth noting that..."
✅ (just state the thing)

❌ "It should be mentioned that this approach..."
✅ (just describe the approach)
```

### Bullet Point Lists Where Prose Works
```
❌ "Key features:
    - User authentication
    - Role-based access
    - Token refresh"
✅ "Handles auth: login, roles, token refresh."
```

### Over-Explained Obvious Code
```
❌ // This line creates a new instance of the UserService class
✅ (no comment needed — the code is self-explanatory)

❌ // Check if the user exists in the database
   const user = await repo.findById(id);
✅ const user = await repo.findById(id);
   // (only comment when the WHY isn't obvious)
```

### Promotional Tone
```
❌ "This elegant solution leverages the power of..."
✅ "Uses X for Y"

❌ "This robust implementation ensures..."
✅ "Handles X by doing Y"
```

---

## Rules

```
1. BREVITY: Shorter is better. Cut words that don't add information.
2. ACTIVE VOICE: "Creates user" not "User is created by the system"
3. NO FILLER: Remove "basically", "essentially", "in order to", "it's important to note"
4. SPECIFIC: "Returns 404 if user not found" not "Handles the case where the user might not exist"
5. CODE SPEAKS: Don't comment what code does. Comment WHY, if not obvious.
6. NATURAL: Write like you're explaining to a teammate, not writing a textbook.
```

---

## Before / After Examples

### API Documentation
```
BEFORE:
  "This endpoint is designed to create a new user account in the system.
   It accepts a JSON body containing the user's email, name, and password.
   Upon successful creation, it returns the newly created user object
   with a 201 status code."

AFTER:
  "Create user. Returns 201 with user object."
```

### Error Messages
```
BEFORE:
  "An unexpected error occurred while processing your request. Please try again later."

AFTER:
  "Something went wrong. Try again or contact support if this persists."
```

### Commit Messages
```
BEFORE:
  "Implemented comprehensive user authentication feature with JWT token generation,
   refresh token rotation, and role-based access control middleware"

AFTER:
  "Add JWT auth with refresh tokens and RBAC"
```

### Code Comments
```
BEFORE:
  /**
   * This method is responsible for finding a user by their unique identifier.
   * It queries the database using the provided ID and returns the user object
   * if found, or throws a NotFoundException if the user does not exist.
   * @param id - The unique identifier of the user to find
   * @returns The user object
   * @throws NotFoundException if user is not found
   */

AFTER:
  /** Find user by ID. Throws NotFoundException if missing. */
```
