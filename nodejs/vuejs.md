# Vue.js & Nuxt — Production Patterns

> Vue 3 Composition API, Pinia, Vue Router, Nuxt 3 server routes.
> Reference: vuejs/core (48k+ stars), nuxt/nuxt (56k+ stars)

---

## Vue 3 Project Structure

```
src/
├── components/
│   ├── ui/                          ← Shared UI components
│   │   ├── BaseButton.vue
│   │   ├── BaseInput.vue
│   │   └── BaseModal.vue
│   ├── layout/
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   └── AppFooter.vue
│   └── [feature]/
│       └── UserCard.vue
├── composables/                      ← Reusable logic (like React hooks)
│   ├── useAuth.ts
│   ├── useFetch.ts
│   └── useUsers.ts
├── stores/                           ← Pinia stores
│   ├── auth.store.ts
│   └── users.store.ts
├── views/                            ← Page components
│   ├── HomeView.vue
│   ├── LoginView.vue
│   └── users/
│       ├── UsersListView.vue
│       └── UserDetailView.vue
├── router/
│   └── index.ts                     ← Vue Router config
├── services/                         ← API calls
│   ├── api.ts                       ← Axios instance
│   ├── users.service.ts
│   └── auth.service.ts
├── types/
│   └── index.ts
├── App.vue
└── main.ts
```

---

## Core Patterns

### Composition API (`<script setup>`)
```vue
<!-- components/UserCard.vue -->
<script setup lang="ts">
interface Props {
  user: User;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  (e: 'delete', id: string): void;
  (e: 'edit', user: User): void;
}>();

const handleDelete = () => {
  if (confirm('Are you sure?')) {
    emit('delete', props.user.id);
  }
};
</script>

<template>
  <div class="user-card">
    <div v-if="loading" class="skeleton" />
    <template v-else>
      <h3>{{ user.name }}</h3>
      <p>{{ user.email }}</p>
      <button @click="emit('edit', user)">Edit</button>
      <button @click="handleDelete">Delete</button>
    </template>
  </div>
</template>
```

### Pinia Store
```typescript
// stores/users.store.ts
import { defineStore } from 'pinia';
import { UsersService } from '@/services/users.service';

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchUsers(params?: PaginationParams) {
    loading.value = true;
    error.value = null;
    try {
      const response = await UsersService.getAll(params);
      users.value = response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch users';
    } finally {
      loading.value = false;
    }
  }

  async function createUser(data: CreateUserDto) {
    const user = await UsersService.create(data);
    users.value.push(user);
    return user;
  }

  return { users, loading, error, fetchUsers, createUser };
});
```

### Composable (Reusable Logic)
```typescript
// composables/useFetch.ts
export function useFetch<T>(url: string) {
  const data = ref<T | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  async function execute() {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get<T>(url);
      data.value = response.data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Request failed';
    } finally {
      loading.value = false;
    }
  }

  onMounted(execute);

  return { data, loading, error, refetch: execute };
}
```

### API Service Layer
```typescript
// services/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token refresh
      const refreshed = await refreshToken();
      if (refreshed) return api(error.config);
      router.push('/login');
    }
    return Promise.reject(error);
  }
);
```

---

## Vue Router

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const routes = [
  { path: '/', component: () => import('@/views/HomeView.vue') },
  { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { guest: true } },
  {
    path: '/dashboard',
    component: () => import('@/views/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'users', component: () => import('@/views/users/UsersListView.vue') },
      { path: 'users/:id', component: () => import('@/views/users/UserDetailView.vue') },
    ],
  },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isAuthenticated) return '/login';
  if (to.meta.guest && auth.isAuthenticated) return '/dashboard';
});
```

---

## Nuxt 3 (Full-Stack Vue)

### Nuxt Project Structure
```
server/
├── api/
│   ├── users/
│   │   ├── index.get.ts            ← GET /api/users
│   │   ├── index.post.ts           ← POST /api/users
│   │   └── [id].get.ts             ← GET /api/users/:id
│   └── auth/
│       ├── login.post.ts
│       └── register.post.ts
├── middleware/
│   └── auth.ts                     ← Server middleware
└── utils/
    └── db.ts                       ← Database client

pages/
├── index.vue
├── login.vue
└── dashboard/
    └── users/
        ├── index.vue
        └── [id].vue

composables/
├── useAuth.ts
└── useUsers.ts
```

### Nuxt Server API Route
```typescript
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 20;

  const users = await prisma.user.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return { data: users, pagination: { page, limit } };
});
```

### Nuxt Data Fetching
```vue
<script setup lang="ts">
// Auto-imported, SSR-friendly, cached
const { data: users, pending, error, refresh } = await useFetch('/api/users');
</script>

<template>
  <div>
    <div v-if="pending">Loading...</div>
    <div v-else-if="error">{{ error.message }}</div>
    <div v-else-if="!users?.data.length">No users found</div>
    <UserList v-else :users="users.data" />
  </div>
</template>
```
