import { nextTick, ref } from 'vue'
export function useForm() {
  const busy = ref(false)
  const error = ref('')
  const fields = ref({})
  async function failed(problem, fallback) {
    fields.value = problem.fields ?? {}
    error.value = fallback ?? problem.message ?? 'No se pudo completar la solicitud.'
    await nextTick()
    const invalid = document.querySelector('main [aria-invalid="true"]') ?? document.querySelector('main [role="alert"]')
    if (invalid) {
      if (invalid.getAttribute('role') === 'alert') invalid.setAttribute('tabindex', '-1')
      invalid.focus()
    }
  }
  function begin() { busy.value = true; error.value = ''; fields.value = {} }
  return { busy, error, fields, begin, failed }
}
