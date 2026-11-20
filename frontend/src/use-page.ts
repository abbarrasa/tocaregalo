import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { ApiError, errorMessage } from './api.ts';
import type { Page } from './pagination.ts';

// Holds one bounded page, not a growing cache. Generation fences late responses.
export function usePage<T>(load: (cursor: string | null) => Promise<Page<T>>, expired: () => void, unavailable: () => void = () => {}) {
  const data = shallowRef<Page<T> | null>(null);
  const loading = ref(false); const error = ref(''); const cursor = ref<string | null>(null);
  let generation = 0;
  function clear() { generation++; data.value = null; error.value = ''; loading.value = false; cursor.value = null; }
  async function fetchPage(after: string | null = null) {
    const request = ++generation;
    data.value = null; error.value = ''; loading.value = true; cursor.value = after;
    try { const result = await load(after); if (request === generation) data.value = result; }
    catch (failure) {
      if (request !== generation) return;
      if (failure instanceof ApiError && failure.status === 401) expired();
      else if (failure instanceof ApiError && failure.status === 404) {
        error.value = 'El grupo no existe o ya no tienes acceso.'; unavailable();
      } else error.value = errorMessage(failure);
    } finally { if (request === generation) loading.value = false; }
  }
  onBeforeUnmount(clear);
  return { data, loading, error, cursor, fetchPage, clear };
}
