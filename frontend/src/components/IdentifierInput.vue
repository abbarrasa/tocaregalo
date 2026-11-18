<script setup>
import { ref } from 'vue'
import PhoneInput from './PhoneInput.vue'
const props = defineProps({ modelValue: { type: String, default: '' }, id: { type: String, required: true }, error: { type: String, default: '' }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const mode = ref('email')
function change() { emit('update:modelValue', '') }
function update(value) { emit('update:modelValue', value) }
</script>
<template>
  <fieldset class="mb-3" :disabled="disabled">
    <legend class="fs-6">Acceder con</legend>
    <div class="d-flex gap-3 mb-3">
      <label><input v-model="mode" type="radio" :name="`${id}-mode`" value="email" @change="change"> Email</label>
      <label><input v-model="mode" type="radio" :name="`${id}-mode`" value="phone" @change="change"> Teléfono</label>
    </div>
    <label class="form-label" :for="id">{{ mode === 'email' ? 'Correo electrónico' : 'Número de teléfono' }}</label>
    <input v-if="mode === 'email'" :id="id" class="form-control" type="email" autocomplete="username" :value="modelValue"
      :aria-invalid="!!error" :aria-describedby="`${id}-help ${id}-error`" maxlength="255" required @input="update($event.target.value)">
    <PhoneInput v-else :id="id" class="form-control" :model-value="modelValue" :aria-invalid="!!error"
      :aria-describedby="`${id}-help ${id}-error`" maxlength="255" required @update:model-value="update" />
    <p :id="`${id}-help`" class="form-text">{{ mode === 'phone' ? 'Incluye + y el prefijo de país, sin espacios ni signos adicionales.' : 'Introduce el email de tu cuenta.' }}</p>
    <p :id="`${id}-error`" class="text-danger mb-0">{{ error }}</p>
  </fieldset>
</template>
