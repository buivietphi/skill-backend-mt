# Django & DRF — Production Patterns

> Django ORM, REST Framework, class-based views, Celery, admin.
> Reference: django/django (82k+ stars), encode/django-rest-framework (29k+ stars)

---

## Project Structure

```
project/
├── config/                          ← Project settings
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py
│   │   ├── base.py                  ← Shared settings
│   │   ├── development.py
│   │   ├── production.py
│   │   └── testing.py
│   ├── urls.py                      ← Root URL config
│   ├── wsgi.py
│   └── asgi.py
├── apps/
│   ├── users/
│   │   ├── __init__.py
│   │   ├── admin.py                 ← Admin registration
│   │   ├── apps.py
│   │   ├── models.py                ← Django models
│   │   ├── serializers.py           ← DRF serializers
│   │   ├── views.py                 ← DRF viewsets
│   │   ├── urls.py                  ← App URLs
│   │   ├── permissions.py           ← Custom permissions
│   │   ├── filters.py              ← DRF filters
│   │   ├── signals.py              ← Model signals
│   │   ├── tasks.py                ← Celery tasks
│   │   ├── tests/
│   │   │   ├── __init__.py
│   │   │   ├── test_models.py
│   │   │   ├── test_views.py
│   │   │   └── factories.py        ← Test factories
│   │   └── migrations/
│   │       └── 0001_initial.py
│   ├── auth/
│   │   └── ... (same pattern)
│   └── core/
│       ├── models.py               ← Abstract base models
│       ├── pagination.py           ← Custom pagination
│       └── permissions.py          ← Shared permissions
├── manage.py
├── requirements/
│   ├── base.txt
│   ├── development.txt
│   └── production.txt
└── docker-compose.yml
```

---

## Core Patterns

### Model
```python
# apps/core/models.py
from django.db import models
import uuid

class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

# apps/users/models.py
from django.contrib.auth.models import AbstractUser
from apps.core.models import BaseModel

class User(AbstractUser, BaseModel):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        db_table = 'users'
        ordering = ['-created_at']
```

### DRF Serializer
```python
# apps/users/serializers.py
from rest_framework import serializers
from .models import User

class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['email', 'name', 'password']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
```

### DRF ViewSet
```python
# apps/users/views.py
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import User
from .serializers import UserSerializer, UserCreateSerializer
from .permissions import IsOwnerOrAdmin
from .filters import UserFilter

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_active=True)
    permission_classes = [permissions.IsAuthenticated]
    filterset_class = UserFilter

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [IsOwnerOrAdmin()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        # Soft delete
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
```

### URL Configuration
```python
# apps/users/urls.py
from rest_framework.routers import DefaultRouter
from .views import UserViewSet

router = DefaultRouter()
router.register('users', UserViewSet)

urlpatterns = router.urls

# config/urls.py
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('apps.users.urls')),
    path('api/v1/', include('apps.auth.urls')),
]
```

---

## Query Optimization

```python
# AVOID N+1:
# BAD: N+1 query
users = User.objects.all()
for user in users:
    print(user.orders.count())  # N extra queries!

# GOOD: select_related (ForeignKey, OneToOne — JOIN)
orders = Order.objects.select_related('user').all()

# GOOD: prefetch_related (ManyToMany, reverse FK — separate query)
users = User.objects.prefetch_related('orders').all()

# GOOD: F expressions for atomic updates
from django.db.models import F
Product.objects.filter(id=1).update(stock=F('stock') - 1)

# GOOD: values/values_list for specific columns
emails = User.objects.values_list('email', flat=True)

# GOOD: only/defer for partial loading
users = User.objects.only('id', 'email', 'name')
```

---

## Celery Background Tasks

```python
# apps/users/tasks.py
from celery import shared_task
from django.core.mail import send_mail

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, user_id: str):
    try:
        user = User.objects.get(id=user_id)
        send_mail(
            subject='Welcome!',
            message=f'Hello {user.name}, welcome to our platform.',
            from_email='noreply@example.com',
            recipient_list=[user.email],
        )
    except Exception as exc:
        self.retry(exc=exc)
```

---

## Settings Split

```python
# config/settings/base.py (shared)
SECRET_KEY = env('SECRET_KEY')
DATABASES = {'default': env.db('DATABASE_URL')}
AUTH_USER_MODEL = 'users.User'
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PAGINATION_CLASS': 'apps.core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
}

# config/settings/production.py
from .base import *
DEBUG = False
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
```

---

## Common Libraries

```
CATEGORY            LIBRARY                     PURPOSE
──────────────────────────────────────────────────────────
REST API            djangorestframework         REST API framework
Auth                djangorestframework-simplejwt JWT auth
Filtering           django-filter               Query filtering
CORS                django-cors-headers         CORS handling
Env                 django-environ              Environment variables
Celery              celery + django-celery-beat  Background tasks
Cache               django-redis                Redis cache backend
Debug               django-debug-toolbar        Dev debugging
Admin               django-unfold               Modern admin UI
Testing             factory-boy + faker         Test data factories
Storage             django-storages             S3/GCS file storage
```
