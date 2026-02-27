# NestJS — Production Patterns

> Clean Architecture with NestJS. Modules, DI, guards, interceptors, Prisma/TypeORM.
> Reference: nestjs/nest (70k+ stars), @nestjs/cli, @nestjs/swagger

---

## Project Structure

```
src/
├── modules/
│   ├── users/
│   │   ├── users.controller.ts         ← @Controller, routes, Swagger
│   │   ├── users.service.ts            ← Business logic
│   │   ├── users.repository.ts         ← Data access (Prisma/TypeORM)
│   │   ├── users.module.ts             ← Module registration
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts      ← class-validator decorators
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts    ← Response mapping
│   │   ├── entities/
│   │   │   └── user.entity.ts          ← DB schema (TypeORM) or Prisma model
│   │   ├── guards/
│   │   │   └── user-owner.guard.ts     ← Resource ownership check
│   │   └── __tests__/
│   │       ├── users.service.spec.ts
│   │       └── users.controller.spec.ts
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts         ← Passport JWT strategy
│   │   │   └── local.strategy.ts       ← Passport local strategy
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   └── auth.module.ts
│   └── [feature]/
│       └── ... (same pattern)
├── common/
│   ├── decorators/
│   ├── filters/
│   │   └── all-exceptions.filter.ts    ← Global exception handler
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts
│   ├── middleware/
│   │   └── correlation-id.middleware.ts
│   └── pipes/
│       └── validation.pipe.ts
├── config/
│   ├── app.config.ts                   ← @nestjs/config validation
│   ├── database.config.ts
│   └── auth.config.ts
├── database/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── seeds/
├── app.module.ts
└── main.ts
```

---

## Core Patterns

### Module Registration
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },     // Global auth
    { provide: APP_FILTER, useClass: AllExceptionsFilter }, // Global errors
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

### Controller Pattern
```typescript
@ApiTags('users')
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiPaginatedResponse(UserResponseDto)
  findAll(@Query() query: PaginationDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiResponse({ type: UserResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(UserOwnerGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
```

### Service Pattern
```typescript
@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findAll(query: PaginationDto) {
    return this.usersRepository.findMany(query);
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    const exists = await this.usersRepository.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already in use');
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    return this.usersRepository.create({ ...dto, password: hashedPassword });
  }
}
```

### DTO Validation
```typescript
export class CreateUserDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])/, { message: 'Password too weak' })
  password: string;
}
```

---

## Exception Handling

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = exception instanceof HttpException
      ? exception.getResponse()
      : 'Internal server error';

    response.status(status).json({
      error: {
        statusCode: status,
        message: typeof message === 'string' ? message : (message as any).message,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.headers['x-request-id'],
      },
    });
  }
}
```

---

## Testing

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: DeepMocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: createMock<UsersRepository>() },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  describe('findOne', () => {
    it('should return user when found', async () => {
      const user = { id: '1', email: 'test@test.com', name: 'Test' };
      repository.findById.mockResolvedValue(user);
      expect(await service.findOne('1')).toEqual(user);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });
});
```

---

## Common Libraries

```
CATEGORY            LIBRARY                 PURPOSE
──────────────────────────────────────────────────────
ORM                 @prisma/client          Type-safe DB client
ORM                 @nestjs/typeorm         Decorator-based ORM
Validation          class-validator         DTO validation
Serialization       class-transformer       DTO transformation
Auth                @nestjs/passport        Authentication
Auth                @nestjs/jwt             JWT handling
Docs                @nestjs/swagger         OpenAPI/Swagger
Config              @nestjs/config          Environment config
Cache               @nestjs/cache-manager   Redis/memory cache
Queue               @nestjs/bull            Background jobs
WebSocket           @nestjs/websockets      Real-time
Health              @nestjs/terminus        Health checks
Rate Limit          @nestjs/throttler       Rate limiting
```
