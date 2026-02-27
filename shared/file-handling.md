# File Upload & Storage Patterns

> Validation, S3/R2 upload, streaming, cleanup, progress tracking.
> Real code for production file handling.

---

## Upload Flow

```
CLIENT → BACKEND (validate) → STORAGE (S3/R2/local) → DB (save metadata)

TWO APPROACHES:
  1. Server-side upload: client → server → S3 (simple, server handles everything)
  2. Presigned URL: client → server (get URL) → client → S3 direct (scalable, large files)
```

---

## Server-Side Upload (< 10MB files)

### Node.js (NestJS + Multer + S3)

```typescript
// Upload endpoint
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException('File type not allowed'), false);
    }
    cb(null, true);
  },
}))
async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: User) {
  return this.fileService.upload(file, user);
}

// File service
async upload(file: Express.Multer.File, user: User): Promise<FileResponseDto> {
  // 1. VALIDATE (double-check — don't trust Multer alone)
  this.validateFile(file);

  // 2. GENERATE unique key
  const ext = path.extname(file.originalname).toLowerCase();
  const key = `uploads/${user.id}/${Date.now()}-${crypto.randomUUID()}${ext}`;

  // 3. UPLOAD to S3
  await this.s3.send(new PutObjectCommand({
    Bucket: this.configService.get('S3_BUCKET'),
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentDisposition: `inline; filename="${file.originalname}"`,
  }));

  // 4. SAVE metadata to DB
  const record = await this.prisma.file.create({
    data: {
      key,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: user.id,
      url: `${this.configService.get('CDN_URL')}/${key}`,
    },
  });

  return this.mapToDto(record);
}

private validateFile(file: Express.Multer.File): void {
  // Size check
  if (file.size > 10 * 1024 * 1024) throw new BadRequestException('File too large (max 10MB)');

  // MIME type check (don't trust Content-Type header alone)
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedMimes.includes(file.mimetype)) throw new BadRequestException('File type not allowed');

  // Extension check (prevent .exe disguised as .jpg)
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  if (!allowedExts.includes(ext)) throw new BadRequestException('File extension not allowed');

  // Magic bytes check (optional but recommended for images)
  const header = file.buffer.slice(0, 4).toString('hex');
  const magicBytes = {
    'ffd8ffe0': 'image/jpeg', 'ffd8ffe1': 'image/jpeg',
    '89504e47': 'image/png',
    '52494646': 'image/webp',
    '25504446': 'application/pdf',
  };
  if (!magicBytes[header] || magicBytes[header] !== file.mimetype) {
    throw new BadRequestException('File content does not match declared type');
  }
}
```

---

## Presigned URL Upload (Large files > 10MB)

```
FLOW:
  1. Client requests presigned URL from backend
  2. Backend generates URL (with constraints) → returns to client
  3. Client uploads directly to S3 using presigned URL
  4. Client notifies backend: "upload complete"
  5. Backend verifies file exists + validates → saves metadata
```

```typescript
// Step 1-2: Generate presigned URL
async getUploadUrl(dto: RequestUploadDto, user: User): Promise<{ uploadUrl: string; key: string }> {
  const ext = path.extname(dto.filename).toLowerCase();
  const key = `uploads/${user.id}/${Date.now()}-${crypto.randomUUID()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    ContentType: dto.contentType,
  });

  const uploadUrl = await getSignedUrl(this.s3, command, {
    expiresIn: 600, // 10 minutes
  });

  // Save pending upload record
  await this.prisma.file.create({
    data: { key, status: 'PENDING', uploadedBy: user.id, originalName: dto.filename },
  });

  return { uploadUrl, key };
}

// Step 4-5: Confirm upload
async confirmUpload(key: string, user: User): Promise<FileResponseDto> {
  // Verify file exists in S3
  const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));

  // Validate size
  if (head.ContentLength > 100 * 1024 * 1024) {
    await this.deleteFromS3(key); // cleanup
    throw new BadRequestException('File too large (max 100MB)');
  }

  // Update record
  const file = await this.prisma.file.update({
    where: { key },
    data: {
      status: 'CONFIRMED',
      size: head.ContentLength,
      mimeType: head.ContentType,
      url: `${this.cdnUrl}/${key}`,
    },
  });

  return this.mapToDto(file);
}
```

---

## File Deletion & Cleanup

```typescript
// Delete file (soft delete record, queue S3 cleanup)
async deleteFile(id: string, user: User): Promise<void> {
  const file = await this.prisma.file.findUnique({ where: { id } });
  if (!file) throw new NotFoundException('File');
  if (file.uploadedBy !== user.id && !user.isAdmin) throw new ForbiddenException();

  // Soft delete record
  await this.prisma.file.update({ where: { id }, data: { deletedAt: new Date() } });

  // Queue S3 deletion (async — don't block response)
  await this.jobQueue.add('delete-s3-file', { key: file.key }, { delay: 24 * 3600 * 1000 }); // 24h grace
}

// Cleanup orphaned files (CRON job — run daily)
@Cron('0 3 * * *') // 3 AM daily
async cleanupOrphanedFiles() {
  // Find PENDING uploads older than 24h
  const orphans = await this.prisma.file.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) } },
  });

  for (const file of orphans) {
    await this.deleteFromS3(file.key).catch(() => {});
    await this.prisma.file.delete({ where: { id: file.id } });
  }
  this.logger.info(`Cleaned up ${orphans.length} orphaned files`);
}
```

---

## Image Processing

```typescript
// Resize on upload (using Sharp — Node.js)
async processImage(file: Express.Multer.File): Promise<{ original: Buffer; thumb: Buffer }> {
  const sharp = (await import('sharp')).default;

  const original = await sharp(file.buffer)
    .rotate()             // auto-rotate based on EXIF
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }) // convert to WebP
    .toBuffer();

  const thumb = await sharp(file.buffer)
    .resize(300, 300, { fit: 'cover' })
    .webp({ quality: 60 })
    .toBuffer();

  return { original, thumb };
}

// Upload both versions
const key = `uploads/${user.id}/${uuid}`;
await Promise.all([
  this.uploadToS3(`${key}/original.webp`, processed.original, 'image/webp'),
  this.uploadToS3(`${key}/thumb.webp`, processed.thumb, 'image/webp'),
]);
```

---

## Security Checklist

```
□ VALIDATE file type (MIME + extension + magic bytes)
□ LIMIT file size (per endpoint — different for avatar vs document)
□ SANITIZE filename (remove path traversal: ../ , null bytes)
□ GENERATE unique key (never use original filename as storage key)
□ SCAN for malware (ClamAV for enterprise, basic header check for MVP)
□ RESTRICT access (signed URLs or auth middleware for private files)
□ SET Content-Disposition (inline for images, attachment for downloads)
□ CLEANUP orphans (CRON job for pending uploads never confirmed)
□ LIMIT uploads per user (rate limit: max N uploads per hour)
□ LOG all uploads (audit trail: who uploaded what when)
```
