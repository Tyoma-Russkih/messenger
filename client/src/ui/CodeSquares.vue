<template>
	<div
		class="inline-flex justify-center gap-2 shake-layer"
		:class="{ 'animate-tg-shake': props.error }"
	>
		<input
			v-for="(_, i) in boxes"
			:key="i"
			ref="inputs"
			:class="[
				'w-11 h-12 text-center text-lg rounded-xl border outline-none focus:ring-2 transition-colors duration-200',
				props.error
					? 'border-red-500 focus:ring-red-200'
					: 'border-gray-300 focus:ring-black/10',
			]"
			inputmode="numeric"
			autocomplete="one-time-code"
			maxlength="1"
			:value="valueAt(i)"
			@keydown="onKeydown($event, i)"
			@input="onInput($event, i)"
			@paste="onPaste($event)"
		/>
	</div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

const props = defineProps({
	length: { type: Number, default: 6 },
	modelValue: { type: String, default: '' }, // храним строку длины length, пустые = пробелы
	error: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'complete'])

const inputs = ref([])

function clearAndFocus() {
	emit('update:modelValue', ''.padEnd(props.length, ' '))
	nextTick(() => focusAt(0))
}

defineExpose({ clearAndFocus })

const boxes = computed(() => Array.from({ length: props.length }))

function onlyDigits(s) {
	return (s || '').replace(/\D/g, '')
}

function normalizeValue(v) {
	const s = String(v || '')
	// пустые позиции храним пробелами, чтобы длина была фиксированной
	return s.padEnd(props.length, ' ').slice(0, props.length)
}

function valueAt(i) {
	const norm = normalizeValue(props.modelValue)
	const ch = norm[i] || ' '
	return ch === ' ' ? '' : ch
}

function focusAt(i) {
	const el = inputs.value?.[i]
	if (!el) return
	el.focus()
	el.select?.()
}

function emitNext(next) {
	emit('update:modelValue', next)

	// complete если нет пробелов => все символы введены
	if (!next.includes(' ')) {
		emit('complete', next.replace(/ /g, ''))
	}
}

function setCharAt(i, ch) {
	const arr = normalizeValue(props.modelValue).split('')
	arr[i] = ch ? ch : ' '
	const next = arr.join('')
	emitNext(next)
}

function onInput(e, i) {
	const ch = onlyDigits(e.target.value).slice(-1)
	e.target.value = ch
	setCharAt(i, ch)

	if (ch && i < props.length - 1) {
		nextTick(() => focusAt(i + 1))
	}
}

function onKeydown(e, i) {
	if (e.key === 'Backspace') {
		if (valueAt(i)) {
			setCharAt(i, '')
			return
		}
		if (i > 0) {
			nextTick(() => focusAt(i - 1))
			setCharAt(i - 1, '')
		}
		return
	}

	if (e.key === 'ArrowLeft' && i > 0) {
		e.preventDefault()
		nextTick(() => focusAt(i - 1))
		return
	}

	if (e.key === 'ArrowRight' && i < props.length - 1) {
		e.preventDefault()
		nextTick(() => focusAt(i + 1))
		return
	}
}

function onPaste(e) {
	const pasted = onlyDigits(e.clipboardData?.getData('text') || '').slice(
		0,
		props.length,
	)
	if (!pasted) return

	e.preventDefault()

	const arr = Array.from({ length: props.length }, () => ' ')
	for (let i = 0; i < pasted.length; i++) arr[i] = pasted[i]
	const next = arr.join('')

	emitNext(next)

	nextTick(() => {
		const idx = Math.min(pasted.length, props.length - 1)
		focusAt(idx)
	})
}
</script>
