export function phoneValue(value) {
  const cleaned = value.replace(/[^0-9+]/g, '')
  return (cleaned.startsWith('+') ? '+' : '') + cleaned.replace(/\D/g, '')
}

const bindings = new WeakMap()
export const phoneDirective = {
  mounted(element) {
    let composing = false
    const normalize = () => {
      const original = element.value
      const start = element.selectionStart ?? original.length
      const end = element.selectionEnd ?? start
      const value = phoneValue(original)
      if (original !== value) {
        element.value = value
        element.setSelectionRange(phoneValue(original.slice(0, start)).length, phoneValue(original.slice(0, end)).length)
      }
    }
    const input = (event) => { if (!composing && !event.isComposing) normalize() }
    const begin = () => { composing = true }
    const finish = () => { composing = false; normalize() }
    element.addEventListener('input', input, true)
    element.addEventListener('compositionstart', begin, true)
    element.addEventListener('compositionend', finish, true)
    bindings.set(element, () => {
      element.removeEventListener('input', input, true)
      element.removeEventListener('compositionstart', begin, true)
      element.removeEventListener('compositionend', finish, true)
    })
  },
  unmounted(element) { bindings.get(element)?.(); bindings.delete(element) },
}
export default { install(app) { app.directive('phone', phoneDirective) } }
