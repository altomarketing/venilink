<script setup lang="ts">
const props = defineProps<{
  error?: { statusCode?: number; message?: string }
}>()

const isDashboard = import.meta.client
  ? window.location.pathname.startsWith('/dashboard')
  : false
const isNotFound = props.error?.statusCode === 404

if (import.meta.client && isNotFound && !isDashboard) {
  window.location.replace('https://cdn.altomarketing.com/cpanel/404')
}
</script>

<template>
  <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
    <template v-if="isNotFound && !isDashboard">
      <p>Link no encontrado. Redirigiendo...</p>
      <a href="https://cdn.altomarketing.com/cpanel/404">Ir al sitio principal</a>
    </template>
    <template v-else>
      <p>Error {{ error?.statusCode || '' }}: {{ error?.message || 'Ocurrió un error' }}</p>
      <a href="/dashboard">Volver al dashboard</a>
    </template>
  </div>
</template>
