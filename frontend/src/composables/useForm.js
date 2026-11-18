import { nextTick, ref } from 'vue'
export function useForm(scope = 'main') {
  const busy = ref(false)
  const error = ref('')
  const fields = ref({})
  async function failed(problem, fallback) {
    fields.value = problem.fields ?? {}
    error.value = fallback ?? problem.message ?? 'No se pudo completar la solicitud.'
    await nextTick()
    const root = document.querySelector(scope)
    const invalid = root?.querySelector('[aria-invalid="true"]') ?? root?.querySelector('[role="alert"]')
    if (invalid) {
      if (invalid.getAttribute('role') === 'alert') invalid.setAttribute('tabindex', '-1')
      invalid.focus()
    }
  }
  function begin() { busy.value = true; error.value = ''; fields.value = {} }
  return { busy, error, fields, begin, failed }
}
