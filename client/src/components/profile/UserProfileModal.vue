<template>
  <Teleport to="body">
    <div
      v-if="open && user"
      class="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-4"
      @click="$emit('close')"
    >
      <div
        class="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
        @click.stop
      >
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-semibold">Профиль</h2>

          <button
            class="text-gray-400 hover:text-black"
            @click="$emit('close')"
          >
            ✕
          </button>
        </div>

        <div class="mt-6 flex flex-col items-center text-center">
          <div class="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-600">
            <img
              v-if="user.avatarUrl"
              :src="fileUrl(user.avatarUrl)"
              class="w-full h-full object-cover"
            />

            <span v-else>
              {{ avatarLetter(user) }}
            </span>
          </div>

          <div class="mt-4 text-lg font-semibold">
            {{ user.name || user.phone }}
          </div>

          <div v-if="user.username" class="text-gray-500">
            @{{ user.username }}
          </div>

          <div v-if="user.bio" class="mt-3 text-sm text-gray-600 max-w-xs">
            {{ user.bio }}
          </div>

          <div class="mt-4 text-sm text-gray-500">
            {{ user.phone }}
          </div>

          <div class="mt-2 text-xs text-gray-400">
            <span v-if="isOnline">в сети</span>
            <span v-else-if="user.lastSeenAt">
              был(а) {{ formatLastSeen(user.lastSeenAt) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { fileUrl } from '../../api/http'

const props = defineProps({
  open: Boolean,
  user: Object,
  isOnline: Boolean
})

function avatarLetter(user) {
  const source =
    user?.name ||
    user?.username ||
    user?.phone ||
    '?'

  return String(source).trim().slice(0, 1).toUpperCase()
}

function formatLastSeen(date) {
  const d = new Date(date)
  return d.toLocaleString()
}
</script>
