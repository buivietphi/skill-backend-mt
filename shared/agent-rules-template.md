# Agent Rules Template

> Template for generating project-level rules files for all supported agents.

---

## Template Content

```markdown
# Backend Development Rules

## Project Stack
- Framework: {FRAMEWORK}
- Language: {LANGUAGE}
- ORM: {ORM}
- API Style: {API_STYLE}
- Package Manager: {PKG_MANAGER}

## Architecture
- Follow Clean Architecture: Controller → Service → Repository
- Keep business logic in services, NOT in controllers
- Keep database queries in repositories, NOT in services
- Use DTOs for request/response validation

## Code Style
- Use {LANGUAGE} strict mode
- Follow existing naming conventions in the project
- Keep functions under 50 lines
- Use meaningful variable names (no single letters except loops)

## Security Rules
- NEVER hardcode secrets — use environment variables
- ALWAYS validate input at entry points (DTOs/schemas)
- ALWAYS use parameterized queries (no string concatenation in SQL)
- ALWAYS add auth middleware to protected routes
- NEVER log sensitive data (passwords, tokens, PII)

## Database Rules
- ALWAYS use transactions for multi-step operations
- ALWAYS add indexes for frequently queried columns
- NEVER write unbounded queries (always use LIMIT)
- ALWAYS write reversible migrations (up AND down)

## Testing Rules
- Write unit tests for all business logic
- Write integration tests for API endpoints
- Cover: happy path + validation error + not found + unauthorized

## Error Handling
- Use consistent error response format
- Never expose stack traces to users
- Log errors with context (requestId, userId, operation)
- Use proper HTTP status codes

## Before "Done"
- [ ] Types check (no errors)
- [ ] Lint clean
- [ ] Tests pass
- [ ] No console.log in production code
- [ ] No hardcoded secrets
- [ ] Input validation on all endpoints
```

---

## Agent-Specific File Locations

```
AGENT              FILE PATH                              FORMAT
────────────────────────────────────────────────────────────────
Claude Code        ~/.claude/skills/skill-backend-mt/     Markdown
Cursor             .cursorrules                           Markdown
Windsurf           .windsurfrules                         Markdown
Cline              .clinerules/backend-rules.md           Markdown
Roo Code           .roo/rules/backend-rules.md            Markdown
Copilot            .github/copilot-instructions.md        Markdown
Kilo Code          .kilocode/rules/backend-rules.md       Markdown
Kiro               .kiro/steering/backend-rules.md        Markdown
Codex              ~/.codex/skills/skill-backend-mt/      Markdown
Gemini CLI         ~/.gemini/skills/skill-backend-mt/     Markdown
Kimi               ~/.kimi/skills/skill-backend-mt/       Markdown
Antigravity        ~/.agents/skills/skill-backend-mt/     Markdown
```
