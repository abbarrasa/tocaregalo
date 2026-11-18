<script setup>
import { ref } from 'vue'
import { phoneDirective as vPhone, phoneValue } from '../plugins/phone.js'
defineOptions({ inheritAttrs: false })
defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const composing = ref(false)
function input(event) {
  if (!composing.value && !event.isComposing) emit('update:modelValue', phoneValue(event.target.value))
}
function finish(event) { composing.value = false; input(event) }
</script>
<template>
  <input v-phone v-bind="$attrs" :value="modelValue" type="tel" inputmode="tel" autocomplete="tel"
    @input="input" @compositionstart="composing = true" @compositionend="finish">
</template>
