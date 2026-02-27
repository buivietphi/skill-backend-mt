#!/usr/bin/env node

/**
 * @buivietphi/skill-backend installer
 *
 * Installs skill-backend-mt/ folder with subfolders for each platform.
 *
 * Usage:
 *   npx @buivietphi/skill-backend              # Interactive checkbox UI
 *   npx @buivietphi/skill-backend --all        # All detected agents
 *   npx @buivietphi/skill-backend --claude     # Claude Code only
 *   npx @buivietphi/skill-backend --gemini     # Gemini CLI
 *   npx @buivietphi/skill-backend --kimi       # Kimi
 *   npx @buivietphi/skill-backend --antigravity # Antigravity
 *   npx @buivietphi/skill-backend --auto       # Auto-detect (postinstall)
 *   npx @buivietphi/skill-backend --path DIR   # Custom path
 *   npx @buivietphi/skill-backend --init       # Generate project-level rules (interactive)
 *   npx @buivietphi/skill-backend --init cursor    # Generate .cursorrules
 *   npx @buivietphi/skill-backend --init copilot   # Generate .github/copilot-instructions.md
 *   npx @buivietphi/skill-backend --init windsurf  # Generate .windsurfrules
 *   npx @buivietphi/skill-backend --init cline      # Generate .clinerules/backend-rules.md
 *   npx @buivietphi/skill-backend --init roocode    # Generate .roo/rules/backend-rules.md
 *   npx @buivietphi/skill-backend --init kilocode   # Generate .kilocode/rules/backend-rules.md
 *   npx @buivietphi/skill-backend --init kiro       # Generate .kiro/steering/backend-rules.md
 *   npx @buivietphi/skill-backend --init all        # Generate all project-level files
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');
const SKILL_NAME = 'skill-backend-mt';
const HOME = homedir();

// Structure: root files + subfolders
const ROOT_FILES = ['SKILL.md', 'AGENTS.md'];

const SUBFOLDERS = ['nodejs', 'python', 'java', 'php', 'others', 'shared'];

// Read all .md files from a folder dynamically
function getMdFiles(folder) {
  const dir = join(PKG_ROOT, folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md'));
}

const AGENTS = {
  claude:       { name: 'Claude Code',  dir: join(HOME, '.claude', 'skills'),   detect: () => existsSync(join(HOME, '.claude')) },
  cline:        { name: 'Cline',        dir: join(HOME, '.cline', 'skills'),    detect: () => existsSync(join(HOME, '.cline')) },
  roocode:      { name: 'Roo Code',     dir: join(HOME, '.roo', 'skills'),      detect: () => existsSync(join(HOME, '.roo')) },
  cursor:       { name: 'Cursor',       dir: join(HOME, '.cursor', 'skills'),   detect: () => existsSync(join(HOME, '.cursor')) },
  windsurf:     { name: 'Windsurf',     dir: join(HOME, '.windsurf', 'skills'), detect: () => existsSync(join(HOME, '.windsurf')) },
  copilot:      { name: 'Copilot',      dir: join(HOME, '.copilot', 'skills'),  detect: () => existsSync(join(HOME, '.copilot')) },
  codex:        { name: 'Codex',        dir: join(HOME, '.codex', 'skills'),    detect: () => existsSync(join(HOME, '.codex')) },
  gemini:       { name: 'Gemini CLI',   dir: join(HOME, '.gemini', 'skills'),   detect: () => existsSync(join(HOME, '.gemini')) },
  kimi:         { name: 'Kimi',         dir: join(HOME, '.kimi', 'skills'),     detect: () => existsSync(join(HOME, '.kimi')) },
  kilocode:     { name: 'Kilo Code',    dir: join(HOME, '.kilocode', 'skills'), detect: () => existsSync(join(HOME, '.kilocode')) },
  kiro:         { name: 'Kiro',         dir: join(HOME, '.kiro', 'skills'),     detect: () => existsSync(join(HOME, '.kiro')) },
  antigravity:  { name: 'Antigravity',  dir: join(HOME, '.agents', 'skills'),   detect: () => existsSync(join(HOME, '.agents')) },
};

const c = { reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', red: '\x1b[31m' };
const log = m => process.stdout.write(m + '\n');
const ok  = m => log(`  ${c.green}\u2713${c.reset} ${m}`);
const info = m => log(`  ${c.blue}\u2139${c.reset} ${m}`);
const fail = m => log(`  ${c.red}\u2717${c.reset} ${m}`);

function banner() {
  log(`\n${c.bold}${c.cyan}  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510`);
  log(`  \u2502  \uD83D\uDD27 @buivietphi/skill-backend-mt v1.0.0          \u2502`);
  log(`  \u2502  Master Senior Backend Engineer                  \u2502`);
  log(`  \u2502                                                  \u2502`);
  log(`  \u2502  Claude \u00B7 Cline \u00B7 Roo Code \u00B7 Cursor \u00B7 Windsurf  \u2502`);
  log(`  \u2502  Copilot \u00B7 Codex \u00B7 Gemini \u00B7 Kimi \u00B7 Kilo \u00B7 Kiro  \u2502`);
  log(`  \u2502  Antigravity                                     \u2502`);
  log(`  \u2502  NestJS \u00B7 Next.js \u00B7 Express \u00B7 Vue \u00B7 Django \u00B7 FastAPI\u2502`);
  log(`  \u2502  Spring Boot \u00B7 Laravel \u00B7 Go \u00B7 Ruby \u00B7 Rust        \u2502`);
  log(`  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518${c.reset}\n`);
}

function tokenCount(filePath) {
  if (!existsSync(filePath)) return 0;
  return Math.ceil(readFileSync(filePath, 'utf-8').length / 3.5);
}

function showContext() {
  log(`${c.bold}  \uD83D\uDCCA Context budget:${c.reset}`);
  let total = 0;
  for (const f of ROOT_FILES) {
    const t = tokenCount(join(PKG_ROOT, f));
    total += t;
    log(`  ${c.dim}  ${f.padEnd(30)} ~${t.toLocaleString()} tokens${c.reset}`);
  }
  for (const folder of SUBFOLDERS) {
    let ft = 0;
    for (const f of getMdFiles(folder)) ft += tokenCount(join(PKG_ROOT, folder, f));
    total += ft;
    log(`  ${c.dim}  ${(folder + '/').padEnd(30)} ~${ft.toLocaleString()} tokens${c.reset}`);
  }
  log(`${c.dim}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`);
  log(`  ${c.bold}  All loaded:${c.reset}                    ~${total.toLocaleString()} tokens`);
  log(`  ${c.green}  Smart load (1 platform):${c.reset}       ~${Math.ceil(total * 0.55).toLocaleString()} tokens\n`);
}

function install(baseDir, agentName) {
  // Install main skill
  const dst = join(baseDir, SKILL_NAME);
  mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of ROOT_FILES) {
    const src = join(PKG_ROOT, f);
    if (!existsSync(src)) continue;
    cpSync(src, join(dst, f), { force: true });
    n++;
  }
  for (const folder of SUBFOLDERS) {
    const dstFolder = join(dst, folder);
    mkdirSync(dstFolder, { recursive: true });
    for (const f of getMdFiles(folder)) {
      const src = join(PKG_ROOT, folder, f);
      cpSync(src, join(dstFolder, f), { force: true });
      n++;
    }
  }
  ok(`${c.bold}${SKILL_NAME}/${c.reset} \u2192 ${agentName} ${c.dim}(${dst})${c.reset}`);

  // Auto-install humanizer-backend as separate skill
  const humanizerSrc = join(PKG_ROOT, 'humanizer', 'humanizer-backend.md');
  if (existsSync(humanizerSrc)) {
    const humDst = join(baseDir, 'humanizer-backend');
    mkdirSync(humDst, { recursive: true });
    cpSync(humanizerSrc, join(humDst, 'humanizer-backend.md'), { force: true });
    ok(`${c.bold}humanizer-backend/${c.reset} \u2192 ${agentName} ${c.dim}(${humDst})${c.reset}`);
  }

  return n;
}

// --- Project Auto-Detect ---------------------------------------------------------

function detectProject(dir) {
  const has = f => existsSync(join(dir, f));
  const readJson = f => { try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')); } catch { return null; } };
  const readText = f => { try { return readFileSync(join(dir, f), 'utf-8'); } catch { return ''; } };

  let framework = '[NestJS / Next.js / Express / Django / FastAPI / Spring Boot / Laravel / Go / Rust]';
  let language  = '[TypeScript / JavaScript / Python / Java / Kotlin / PHP / Go / Ruby / Rust]';
  let orm       = '[Prisma / TypeORM / Sequelize / Drizzle / Mongoose / SQLAlchemy / Django ORM / Spring Data / Eloquent]';
  let apiStyle  = 'REST';
  let pkgMgr    = '[npm / yarn / bun / pnpm / pip / poetry / maven / gradle / composer / go mod / bundler / cargo]';

  // --- Detect framework + language ---

  // NestJS
  if (has('nest-cli.json')) {
    framework = 'NestJS'; language = 'TypeScript';
  } else if (has('package.json')) {
    const pkg = readJson('package.json');
    const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

    if (deps['@nestjs/core'])              { framework = 'NestJS'; language = 'TypeScript'; }
    else if (deps['next'] || has('next.config.js') || has('next.config.mjs') || has('next.config.ts'))
                                           { framework = 'Next.js'; language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript'; }
    else if (deps['nuxt'] || has('nuxt.config.js') || has('nuxt.config.ts'))
                                           { framework = 'Nuxt.js'; language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript'; }
    else if (deps['vue'])                  { framework = 'Vue.js'; language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript'; }
    else if (deps['express'])              { framework = 'Express'; language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript'; }
    else if (deps['fastify'])              { framework = 'Fastify'; language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript'; }
    else {
      language = deps['typescript'] || has('tsconfig.json') ? 'TypeScript' : 'JavaScript';
    }

    // ORM detection (Node.js)
    if (deps['@prisma/client'])            { orm = 'Prisma'; }
    else if (deps['typeorm'])              { orm = 'TypeORM'; }
    else if (deps['sequelize'])            { orm = 'Sequelize'; }
    else if (deps['drizzle-orm'])          { orm = 'Drizzle'; }
    else if (deps['mongoose'])             { orm = 'Mongoose'; }

    // API style detection (Node.js)
    if (deps['@nestjs/graphql'] || deps['apollo-server'] || deps['@apollo/server'])
                                           { apiStyle = 'GraphQL'; }

    // Package manager detection (Node.js)
    if (has('bun.lockb'))                  { pkgMgr = 'bun'; }
    else if (has('pnpm-lock.yaml'))        { pkgMgr = 'pnpm'; }
    else if (has('yarn.lock'))             { pkgMgr = 'yarn'; }
    else if (has('package-lock.json'))     { pkgMgr = 'npm'; }

  } else if (has('manage.py')) {
    // Django / FastAPI / Flask (Python)
    const managePy = readText('manage.py');
    const requirements = readText('requirements.txt');
    const pyproject = readText('pyproject.toml');
    const allPyDeps = requirements + '\n' + pyproject;

    if (managePy.includes('django') || allPyDeps.includes('django'))
                                           { framework = 'Django'; language = 'Python'; }
    else if (allPyDeps.includes('fastapi')){ framework = 'FastAPI'; language = 'Python'; }
    else if (allPyDeps.includes('flask'))  { framework = 'Flask'; language = 'Python'; }
    else                                   { framework = 'Django'; language = 'Python'; }

    // ORM detection (Python)
    if (allPyDeps.includes('sqlalchemy'))  { orm = 'SQLAlchemy'; }
    else if (allPyDeps.includes('django')) { orm = 'Django ORM'; }

    // Package manager (Python)
    if (has('poetry.lock'))                { pkgMgr = 'poetry'; }
    else if (has('requirements.txt'))      { pkgMgr = 'pip'; }

  } else if (has('requirements.txt') || has('pyproject.toml')) {
    // Python projects without manage.py
    const requirements = readText('requirements.txt');
    const pyproject = readText('pyproject.toml');
    const allPyDeps = requirements + '\n' + pyproject;

    if (allPyDeps.includes('fastapi'))     { framework = 'FastAPI'; language = 'Python'; }
    else if (allPyDeps.includes('flask'))  { framework = 'Flask'; language = 'Python'; }
    else if (allPyDeps.includes('django')) { framework = 'Django'; language = 'Python'; }
    else                                   { framework = 'Python'; language = 'Python'; }

    // ORM detection (Python)
    if (allPyDeps.includes('sqlalchemy'))  { orm = 'SQLAlchemy'; }

    // Package manager (Python)
    if (has('poetry.lock'))                { pkgMgr = 'poetry'; }
    else                                   { pkgMgr = 'pip'; }

  } else if (has('pom.xml')) {
    // Spring Boot (Maven)
    const pom = readText('pom.xml');
    if (pom.includes('spring-boot'))       { framework = 'Spring Boot'; }
    else                                   { framework = 'Java (Maven)'; }
    language = 'Java';

    // ORM detection (Java)
    if (pom.includes('spring-data-jpa'))   { orm = 'Spring Data'; }

    pkgMgr = 'maven';

  } else if (has('build.gradle') || has('build.gradle.kts')) {
    // Spring Boot (Gradle)
    const gradle = readText(has('build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle');
    if (gradle.includes('spring-boot'))    { framework = 'Spring Boot'; }
    else                                   { framework = has('build.gradle.kts') ? 'Kotlin (Gradle)' : 'Java (Gradle)'; }
    language = has('build.gradle.kts') ? 'Kotlin' : 'Java';

    // ORM detection (Java/Kotlin)
    if (gradle.includes('spring-data-jpa')){ orm = 'Spring Data'; }

    pkgMgr = 'gradle';

  } else if (has('composer.json')) {
    // Laravel / PHP
    const composer = readJson('composer.json');
    const deps = { ...(composer?.require || {}), ...(composer?.['require-dev'] || {}) };

    if (deps['laravel/framework'])         { framework = 'Laravel'; }
    else                                   { framework = 'PHP'; }
    language = 'PHP';

    // ORM detection (PHP)
    if (deps['illuminate/database'] || deps['laravel/framework'])
                                           { orm = 'Eloquent'; }

    pkgMgr = has('composer.lock') ? 'composer' : 'composer';

  } else if (has('go.mod')) {
    framework = 'Go'; language = 'Go';
    pkgMgr = 'go mod';

  } else if (has('Gemfile')) {
    const gemfile = readText('Gemfile');
    if (gemfile.includes('rails'))         { framework = 'Ruby on Rails'; }
    else                                   { framework = 'Ruby'; }
    language = 'Ruby';
    pkgMgr = has('Gemfile.lock') ? 'bundler' : 'bundler';

  } else if (has('Cargo.toml')) {
    framework = 'Rust'; language = 'Rust';
    pkgMgr = has('Cargo.lock') ? 'cargo' : 'cargo';
  }

  // gRPC detection (cross-language)
  if (apiStyle === 'REST') {
    // Check for .proto files or grpc in common config files
    const checkFiles = ['package.json', 'requirements.txt', 'pyproject.toml', 'pom.xml',
                        'build.gradle', 'build.gradle.kts', 'go.mod', 'Cargo.toml'];
    for (const f of checkFiles) {
      const content = readText(f);
      if (content.includes('.proto') || content.includes('grpc')) {
        apiStyle = 'gRPC';
        break;
      }
    }
  }

  return { framework, language, orm, apiStyle, pkgMgr };
}

// --- Project-Level File Templates ------------------------------------------------

const PROJECT_AGENTS = {
  cursor: {
    name: 'Cursor',
    file: '.cursorrules',
    dir:  '.',
    generate: (p) => `# ${p.framework} Project \u2014 Cursor Rules
# Generated by @buivietphi/skill-backend-mt

## Project
- Framework: ${p.framework}
- Language: ${p.language}
- ORM: ${p.orm}
- API Style: ${p.apiStyle}
- Package Manager: ${p.pkgMgr}

## Code Style
- Controller \u2192 Service \u2192 Repository layered architecture
- camelCase for functions, variables, methods
- PascalCase for classes, interfaces, types
- Absolute imports with @/ alias (if configured)

## Auto-Check (before every completion)
- No console.log / print in production code
- No hardcoded secrets or API keys
- All async wrapped in try/catch
- No raw SQL string concatenation \u2014 use parameterized queries
- All user input validated and sanitized
- Auth middleware on protected routes
- No N+1 query patterns \u2014 use eager loading / joins
- All endpoints return consistent response format
- Error responses never leak internal details

## Performance
- Caching strategy for frequently accessed data (Redis / in-memory)
- Connection pooling for database connections
- Pagination for all list endpoints
- No blocking operations on the main event loop

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) \u2014 never in code
- Database queries \u2192 parameterized / prepared statements only
- CORS \u2192 configured with explicit allowed origins
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Change framework or architecture
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code or config files
- Leave empty catch blocks
- Mix package managers
- Add packages without checking compatibility
- Expose stack traces in production error responses

## Architecture
- Dependencies flow inward: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
- Full skill: ~/.cursor/skills/skill-backend-mt/
- Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },

  copilot: {
    name: 'GitHub Copilot',
    file: 'copilot-instructions.md',
    dir:  '.github',
    generate: (p) => `# Copilot Instructions \u2014 ${p.framework} Project

> Generated by @buivietphi/skill-backend-mt

## Project Context
- **Framework:** ${p.framework}
- **Language:** ${p.language}
- **ORM:** ${p.orm}
- **API Style:** ${p.apiStyle}
- **Package Manager:** ${p.pkgMgr}

## Conventions
- PascalCase: classes, interfaces, types, DTOs
- camelCase: functions, methods, variables, services
- Files named same as their default export

## Required Patterns

### Every async function
\`\`\`typescript
try {
  const result = await service.execute(dto);
  return { success: true, data: result };
} catch (error) {
  logger.error('Operation failed', { error, context });
  throw new AppException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
}
\`\`\`

### Every endpoint must validate input
\`\`\`typescript
@Post()
async create(@Body() dto: CreateItemDto) {
  // DTO validated via class-validator / zod / joi
  return this.service.create(dto);
}
\`\`\`

### Every list endpoint must paginate
\`\`\`typescript
@Get()
async findAll(@Query() query: PaginationDto) {
  return this.service.findAll(query.page, query.limit);
}
\`\`\`

## Rules
- No console.log / print in production
- No hardcoded secrets or API keys
- No raw SQL string concatenation
- All user input validated before processing
- Auth middleware on all protected routes
- No N+1 queries \u2014 use eager loading / joins
- No empty catch blocks
- Pagination on all list endpoints
- Consistent error response format
- No blocking operations on main thread

## Security
- Secrets \u2192 environment variables only
- Queries \u2192 parameterized / prepared statements
- CORS \u2192 explicit allowed origins (no wildcard in production)
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Suggest migrating to a different framework
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code
- Mix package managers
- Expose stack traces in production errors
- Add packages without checking compatibility

## Architecture
- Clean Architecture: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
Full skill with patterns from 30+ production repos: ~/.copilot/skills/skill-backend-mt/
`,
  },

  cline: {
    name: 'Cline',
    file: 'backend-rules.md',
    dir:  '.clinerules',
    generate: (p) => `# ${p.framework} Project \u2014 Backend Rules
# Generated by @buivietphi/skill-backend-mt

## Project
- Framework: ${p.framework}
- Language: ${p.language}
- ORM: ${p.orm}
- API Style: ${p.apiStyle}
- Package Manager: ${p.pkgMgr}

## Code Style
- Controller \u2192 Service \u2192 Repository layered architecture
- camelCase for functions, variables, methods
- PascalCase for classes, interfaces, types
- Absolute imports with @/ alias (if configured)

## Auto-Check (before every completion)
- No console.log / print in production code
- No hardcoded secrets or API keys
- All async wrapped in try/catch
- No raw SQL string concatenation \u2014 use parameterized queries
- All user input validated and sanitized
- Auth middleware on protected routes
- No N+1 query patterns \u2014 use eager loading / joins
- All endpoints return consistent response format
- Error responses never leak internal details

## Performance
- Caching strategy for frequently accessed data (Redis / in-memory)
- Connection pooling for database connections
- Pagination for all list endpoints
- No blocking operations on the main event loop

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) \u2014 never in code
- Database queries \u2192 parameterized / prepared statements only
- CORS \u2192 configured with explicit allowed origins
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Change framework or architecture
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code or config files
- Leave empty catch blocks
- Mix package managers
- Add packages without checking compatibility
- Expose stack traces in production error responses

## Architecture
- Dependencies flow inward: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
- Full skill: ~/.cline/skills/skill-backend-mt/
- Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },

  roocode: {
    name: 'Roo Code',
    file: 'backend-rules.md',
    dir:  '.roo/rules',
    generate: (p) => `# ${p.framework} Project \u2014 Backend Rules
# Generated by @buivietphi/skill-backend-mt

## Project
- Framework: ${p.framework}
- Language: ${p.language}
- ORM: ${p.orm}
- API Style: ${p.apiStyle}
- Package Manager: ${p.pkgMgr}

## Code Style
- Controller \u2192 Service \u2192 Repository layered architecture
- camelCase for functions, variables, methods
- PascalCase for classes, interfaces, types
- Absolute imports with @/ alias (if configured)

## Auto-Check (before every completion)
- No console.log / print in production code
- No hardcoded secrets or API keys
- All async wrapped in try/catch
- No raw SQL string concatenation \u2014 use parameterized queries
- All user input validated and sanitized
- Auth middleware on protected routes
- No N+1 query patterns \u2014 use eager loading / joins
- All endpoints return consistent response format
- Error responses never leak internal details

## Performance
- Caching strategy for frequently accessed data (Redis / in-memory)
- Connection pooling for database connections
- Pagination for all list endpoints
- No blocking operations on the main event loop

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) \u2014 never in code
- Database queries \u2192 parameterized / prepared statements only
- CORS \u2192 configured with explicit allowed origins
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Change framework or architecture
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code or config files
- Leave empty catch blocks
- Mix package managers
- Add packages without checking compatibility
- Expose stack traces in production error responses

## Architecture
- Dependencies flow inward: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
- Full skill: ~/.roo/skills/skill-backend-mt/
- Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },

  kilocode: {
    name: 'Kilo Code',
    file: 'backend-rules.md',
    dir:  '.kilocode/rules',
    generate: (p) => `# ${p.framework} Project \u2014 Backend Rules
# Generated by @buivietphi/skill-backend-mt

## Project
- Framework: ${p.framework}
- Language: ${p.language}
- ORM: ${p.orm}
- API Style: ${p.apiStyle}
- Package Manager: ${p.pkgMgr}

## Code Style
- Controller \u2192 Service \u2192 Repository layered architecture
- camelCase for functions, variables, methods
- PascalCase for classes, interfaces, types
- Absolute imports with @/ alias (if configured)

## Auto-Check (before every completion)
- No console.log / print in production code
- No hardcoded secrets or API keys
- All async wrapped in try/catch
- No raw SQL string concatenation \u2014 use parameterized queries
- All user input validated and sanitized
- Auth middleware on protected routes
- No N+1 query patterns \u2014 use eager loading / joins
- All endpoints return consistent response format
- Error responses never leak internal details

## Performance
- Caching strategy for frequently accessed data (Redis / in-memory)
- Connection pooling for database connections
- Pagination for all list endpoints
- No blocking operations on the main event loop

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) \u2014 never in code
- Database queries \u2192 parameterized / prepared statements only
- CORS \u2192 configured with explicit allowed origins
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Change framework or architecture
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code or config files
- Leave empty catch blocks
- Mix package managers
- Add packages without checking compatibility
- Expose stack traces in production error responses

## Architecture
- Dependencies flow inward: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
- Full skill: ~/.kilocode/skills/skill-backend-mt/
- Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },

  kiro: {
    name: 'Kiro',
    file: 'backend-rules.md',
    dir:  '.kiro/steering',
    generate: (p) => `---
inclusion: always
---

# ${p.framework} Project \u2014 Backend Rules
# Generated by @buivietphi/skill-backend-mt

## Project
- Framework: ${p.framework}
- Language: ${p.language}
- ORM: ${p.orm}
- API Style: ${p.apiStyle}
- Package Manager: ${p.pkgMgr}

## Code Style
- Controller \u2192 Service \u2192 Repository layered architecture
- camelCase for functions, variables, methods
- PascalCase for classes, interfaces, types
- Absolute imports with @/ alias (if configured)

## Auto-Check (before every completion)
- No console.log / print in production code
- No hardcoded secrets or API keys
- All async wrapped in try/catch
- No raw SQL string concatenation \u2014 use parameterized queries
- All user input validated and sanitized
- Auth middleware on protected routes
- No N+1 query patterns \u2014 use eager loading / joins
- All endpoints return consistent response format
- Error responses never leak internal details

## Performance
- Caching strategy for frequently accessed data (Redis / in-memory)
- Connection pooling for database connections
- Pagination for all list endpoints
- No blocking operations on the main event loop

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) \u2014 never in code
- Database queries \u2192 parameterized / prepared statements only
- CORS \u2192 configured with explicit allowed origins
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Never
- Change framework or architecture
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Store secrets in source code or config files
- Leave empty catch blocks
- Mix package managers
- Add packages without checking compatibility
- Expose stack traces in production error responses

## Architecture
- Dependencies flow inward: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
- Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },

  windsurf: {
    name: 'Windsurf',
    file: '.windsurfrules',
    dir:  '.',
    generate: (p) => `# ${p.framework} Project \u2014 Windsurf Rules
# Generated by @buivietphi/skill-backend-mt

Project: ${p.framework}
Language: ${p.language}
ORM: ${p.orm}
API style: ${p.apiStyle}
Package manager: ${p.pkgMgr}

## Coding Rules

Always:
- Wrap all async operations in try/catch
- Validate and sanitize all user input
- Use parameterized queries \u2014 never raw SQL concatenation
- Auth middleware on all protected routes
- No N+1 queries \u2014 use eager loading / joins
- Pagination on all list endpoints
- Use PascalCase for classes, interfaces, types
- Use camelCase for functions, methods, variables
- Consistent error response format
- Caching for frequently accessed data
- Connection pooling for database connections

Never:
- Leave console.log / print in production code
- Hardcode secrets, tokens, or API keys
- Store secrets in source code or config files
- Use raw SQL string concatenation
- Use wildcard (*) CORS in production
- Change the framework or architecture
- Add packages without verifying compatibility
- Mix package managers
- Leave empty catch blocks
- Expose stack traces in production error responses

## Security (non-negotiable)
- Secrets \u2192 environment variables (.env) only
- Queries \u2192 parameterized / prepared statements
- CORS \u2192 explicit allowed origins (no wildcard in production)
- API calls \u2192 HTTPS only
- Sensitive data \u2192 never in logs
- User input \u2192 validate and sanitize before processing
- Auth tokens \u2192 short-lived with refresh rotation

## Architecture
- Clean Architecture: Controller \u2192 Service \u2192 Repository
- Single responsibility per file (max 300 lines)
- Feature-based or module-based organization preferred

## Reference
Full skill: ~/.windsurf/skills/skill-backend-mt/
Patterns from 30+ production repos (200k+ GitHub stars)
`,
  },
};

// Agents that need project-level files (don't just read from skills dir)
const NEEDS_PROJECT_FILE = new Set(['cursor', 'copilot', 'windsurf', 'cline', 'roocode', 'kilocode', 'kiro']);

function initProjectFiles(dir, agents) {
  const project = detectProject(dir);
  let created = 0;

  for (const key of agents) {
    const agent = PROJECT_AGENTS[key];
    if (!agent) continue;

    const targetDir = join(dir, agent.dir);
    const targetFile = join(targetDir, agent.file);

    if (existsSync(targetFile)) {
      info(`${c.yellow}${agent.file}${c.reset} already exists \u2014 skipped (won't overwrite)`);
      continue;
    }

    mkdirSync(targetDir, { recursive: true });
    writeFileSync(targetFile, agent.generate(project), 'utf-8');
    ok(`${c.bold}${join(agent.dir, agent.file)}${c.reset} \u2192 ${agent.name} ${c.dim}(auto-detected: ${project.framework})${c.reset}`);
    created++;
  }

  return created;
}

async function selectProjectAgents() {
  if (!process.stdin.isTTY) return Object.keys(PROJECT_AGENTS);

  const keys    = Object.keys(PROJECT_AGENTS);
  const selected = new Set(keys); // all selected by default
  let cursor    = 0;

  const UP       = '\x1b[A';
  const DOWN     = '\x1b[B';
  const ERASE_DN = '\x1b[J';
  const HIDE_CUR = '\x1b[?25l';
  const SHOW_CUR = '\x1b[?25h';
  const moveUp   = n => `\x1b[${n}A`;
  const TOTAL_LINES = 3 + keys.length;

  function render(first) {
    if (!first) process.stdout.write(moveUp(TOTAL_LINES) + ERASE_DN);
    process.stdout.write(`\n${c.bold}  Select project-level files to generate:${c.reset}\n`);
    process.stdout.write(`  ${c.dim}\u2191\u2193 navigate   Space toggle   A select all   Enter confirm   Q cancel${c.reset}\n`);

    for (let i = 0; i < keys.length; i++) {
      const k     = keys[i];
      const agent = PROJECT_AGENTS[k];
      const isCur = i === cursor;
      const isSel = selected.has(k);

      const ptr   = isCur ? `${c.cyan}\u203A${c.reset}` : ' ';
      const box   = isSel ? `${c.green}\u25C9${c.reset}` : `${c.dim}\u25EF${c.reset}`;
      const name  = isCur ? `${c.bold}${c.cyan}${agent.name}${c.reset}` : agent.name;
      const file  = `${c.dim}\u2192 ${join(agent.dir, agent.file)}${c.reset}`;

      process.stdout.write(`  ${ptr} ${box} ${name.padEnd(20)}${file}\n`);
    }
  }

  process.stdout.write(HIDE_CUR);
  render(true);

  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKey = key => {
      const done = result => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onKey);
        process.stdout.write(SHOW_CUR + '\n');
        resolve(result);
      };

      if (key === '\x03') { done(null); process.exit(0); }
      if (key === 'q' || key === 'Q' || key === '\x1b') { done([]); return; }
      if (key === '\r' || key === '\n') { done([...selected]); return; }

      if (key === UP)    cursor = (cursor - 1 + keys.length) % keys.length;
      else if (key === DOWN) cursor = (cursor + 1) % keys.length;
      else if (key === ' ') {
        if (selected.has(keys[cursor])) selected.delete(keys[cursor]);
        else selected.add(keys[cursor]);
      } else if (key === 'a' || key === 'A') {
        if (selected.size === keys.length) selected.clear();
        else keys.forEach(k => selected.add(k));
      }

      render(false);
    };

    process.stdin.on('data', onKey);
  });
}

// --- Checkbox UI -----------------------------------------------------------------

async function selectAgents(detected) {
  if (!process.stdin.isTTY) {
    return detected.length ? detected : ['claude'];
  }

  const keys    = Object.keys(AGENTS);
  const selected = new Set(detected); // pre-tick detected agents
  let cursor    = 0;

  const UP       = '\x1b[A';
  const DOWN     = '\x1b[B';
  const ERASE_DN = '\x1b[J';
  const HIDE_CUR = '\x1b[?25l';
  const SHOW_CUR = '\x1b[?25h';
  const moveUp   = n => `\x1b[${n}A`;

  // header = 3 lines (title + hint + blank), items = keys.length
  const TOTAL_LINES = 3 + keys.length;

  function render(first) {
    if (!first) process.stdout.write(moveUp(TOTAL_LINES) + ERASE_DN);

    process.stdout.write(`\n${c.bold}  Select agents to install:${c.reset}\n`);
    process.stdout.write(`  ${c.dim}\u2191\u2193 navigate   Space toggle   A select all   Enter confirm   Q cancel${c.reset}\n`);

    for (let i = 0; i < keys.length; i++) {
      const k     = keys[i];
      const agent = AGENTS[k];
      const isCur = i === cursor;
      const isSel = selected.has(k);
      const isDet = detected.includes(k);

      const ptr   = isCur ? `${c.cyan}\u203A${c.reset}` : ' ';
      const box   = isSel ? `${c.green}\u25C9${c.reset}` : `${c.dim}\u25EF${c.reset}`;
      const name  = isCur ? `${c.bold}${c.cyan}${agent.name}${c.reset}` : agent.name;
      const badge = isDet ? ` ${c.green}[detected]${c.reset}` : `${c.dim} [not found]${c.reset}`;

      process.stdout.write(`  ${ptr} ${box} ${name.padEnd(14)}${badge}\n`);
    }
  }

  process.stdout.write(HIDE_CUR);
  render(true);

  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onKey = key => {
      const done = result => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('data', onKey);
        process.stdout.write(SHOW_CUR + '\n');
        resolve(result);
      };

      if (key === '\x03') { done(null); process.exit(0); }      // Ctrl+C
      if (key === 'q' || key === 'Q' || key === '\x1b') { done([]); return; } // quit
      if (key === '\r' || key === '\n') { done([...selected]); return; }      // Enter

      if (key === UP)    cursor = (cursor - 1 + keys.length) % keys.length;
      else if (key === DOWN) cursor = (cursor + 1) % keys.length;
      else if (key === ' ') {
        if (selected.has(keys[cursor])) selected.delete(keys[cursor]);
        else selected.add(keys[cursor]);
      } else if (key === 'a' || key === 'A') {
        if (selected.size === keys.length) selected.clear();
        else keys.forEach(k => selected.add(k));
      }

      render(false);
    };

    process.stdin.on('data', onKey);
  });
}

// --- Main ------------------------------------------------------------------------

async function main() {
  const args  = process.argv.slice(2);
  const flags = new Set(args.map(a => a.replace(/^--?/, '')));

  banner();

  // --- --init mode: generate project-level files ---------------------------------
  if (flags.has('init')) {
    const cwd = process.cwd();
    log(`${c.bold}  \uD83D\uDCC1 Project directory:${c.reset} ${c.dim}${cwd}${c.reset}`);

    const project = detectProject(cwd);
    log(`${c.bold}  \uD83D\uDD0D Detected:${c.reset} ${c.cyan}${project.framework}${c.reset} (${project.language})\n`);

    // Determine which agents to init
    let initTargets = [];
    const initIdx = args.indexOf('--init');
    const initArg = args[initIdx + 1];

    if (initArg === 'all') {
      initTargets = Object.keys(PROJECT_AGENTS);
    } else if (initArg && PROJECT_AGENTS[initArg]) {
      initTargets = [initArg];
    } else if (initArg && !initArg.startsWith('-')) {
      fail(`Unknown agent: ${initArg}. Available: ${Object.keys(PROJECT_AGENTS).join(', ')}, all`);
      process.exit(1);
    } else {
      // Interactive selection
      const chosen = await selectProjectAgents();
      if (!chosen || chosen.length === 0) { info('Cancelled.'); return; }
      initTargets = chosen;
    }

    log(`\n${c.bold}  Generating project-level rules...${c.reset}\n`);
    const n = initProjectFiles(cwd, initTargets);

    if (n > 0) {
      log(`\n${c.green}${c.bold}  \u2705 Done!${c.reset} \u2192 ${n} file(s) generated\n`);
      log(`  ${c.bold}Generated files:${c.reset}`);
      for (const k of initTargets) {
        const agent = PROJECT_AGENTS[k];
        if (agent) {
          const fp = join(agent.dir, agent.file);
          log(`    ${c.green}\u25CF${c.reset} ${agent.name.padEnd(18)} ${c.dim}${fp}${c.reset}`);
        }
      }
      log(`\n  ${c.dim}Files are auto-detected for ${project.framework}.`);
      log(`  Edit the generated files to customize for your project.${c.reset}\n`);
    } else {
      info('No files generated (all already exist).\n');
    }
    return;
  }

  // --- Normal install mode -------------------------------------------------------
  showContext();

  let targets = [];

  if (flags.has('all')) {
    targets = Object.keys(AGENTS);
  } else if (flags.has('auto')) {
    targets = Object.keys(AGENTS).filter(k => AGENTS[k].detect());
    if (!targets.length) { info('No agents found. Using Claude.'); targets = ['claude']; }
  } else if (flags.has('humanizer')) {
    // Install humanizer-backend as a separate skill
    const src = join(PKG_ROOT, 'humanizer', 'humanizer-backend.md');
    if (!existsSync(src)) { fail('humanizer/humanizer-backend.md not found'); process.exit(1); }
    const detected = Object.keys(AGENTS).filter(k => AGENTS[k].detect());
    const agentKeys = detected.length ? detected : ['claude'];
    for (const k of agentKeys) {
      const dst = join(AGENTS[k].dir, 'humanizer-backend');
      mkdirSync(dst, { recursive: true });
      cpSync(src, join(dst, 'humanizer-backend.md'), { force: true });
      ok(`${c.bold}humanizer-backend/${c.reset} \u2192 ${AGENTS[k].name} ${c.dim}(${dst})${c.reset}`);
    }
    log(`\n${c.green}${c.bold}  \u2705 Done!${c.reset}\n`);
    log(`  ${c.bold}Usage:${c.reset}`);
    log(`    ${c.cyan}@humanizer-backend${c.reset}  Humanize API docs, changelog, error messages\n`);
    return;
  } else if (flags.has('path')) {
    const p = args[args.indexOf('--path') + 1];
    if (!p) { fail('--path needs a directory'); process.exit(1); }
    install(resolve(p), 'Custom');
    log(`\n${c.green}${c.bold}  \u2705 Done!${c.reset}\n`);
    return;
  } else {
    for (const k of Object.keys(AGENTS)) if (flags.has(k)) targets.push(k);
  }

  // Interactive checkbox when no flag given
  if (!targets.length) {
    const detected = Object.keys(AGENTS).filter(k => AGENTS[k].detect());
    const chosen   = await selectAgents(detected);

    if (!chosen || chosen.length === 0) {
      info('Cancelled.');
      return;
    }
    targets = chosen;
  }

  log(`\n${c.bold}  Installing...${c.reset}\n`);
  for (const k of targets) install(AGENTS[k].dir, AGENTS[k].name);

  log(`\n${c.green}${c.bold}  \u2705 Done!${c.reset} \u2192 ${targets.length} agent(s)\n`);
  log(`  ${c.bold}Usage:${c.reset}`);
  log(`    ${c.cyan}@skill-backend-mt${c.reset}         Pre-built patterns (30+ production repos)`);
  log(`    ${c.cyan}@skill-backend-mt project${c.reset} Read current project, adapt to it\n`);
  log(`  ${c.bold}Installed to:${c.reset}`);
  for (const k of targets) {
    log(`    ${c.green}\u25CF${c.reset} ${AGENTS[k].name.padEnd(14)} ${c.dim}${AGENTS[k].dir}/${SKILL_NAME}${c.reset}`);
  }

  // Show tip for agents that need project-level files
  const needsInit = targets.filter(k => NEEDS_PROJECT_FILE.has(k));
  if (needsInit.length > 0) {
    const names = needsInit.map(k => AGENTS[k].name).join(', ');
    log('');
    log(`  ${c.yellow}${c.bold}\uD83D\uDCA1 Important:${c.reset} ${names} read rules from ${c.bold}project-level files${c.reset},`);
    log(`     not from the skills directory. Run this in your project root:`);
    log('');
    log(`     ${c.cyan}npx @buivietphi/skill-backend-mt --init${c.reset}`);
    log('');
    log(`     This generates project-level rules files`);
    log(`     (${c.bold}.cursorrules${c.reset}, ${c.bold}.clinerules/${c.reset}, ${c.bold}.roo/rules/${c.reset}, etc.) with auto-detected settings.\n`);
  } else {
    log('');
  }
}

main().catch(e => { fail(e.message); process.exit(1); });
