<script lang="ts">
import { createTreehole } from "@/utils/treehole-api";

let content = $state("");
let submitting = $state(false);
let submitted = $state(false);
let error = $state<string | null>(null);

const MAX = 1000;

async function submit() {
	const trimmed = content.trim();
	if (trimmed.length < 5 || submitting) return;

	submitting = true;
	error = null;
	try {
		await createTreehole(trimmed);
		content = "";
		submitted = true;
		setTimeout(() => (submitted = false), 4000);
	} catch (e) {
		error = (e as Error).message;
	} finally {
		submitting = false;
	}
}

function onInput(e: Event) {
	const target = e.target as HTMLTextAreaElement;
	content = target.value.slice(0, MAX);
}
</script>

<div class="treehole-compose">
	{#if submitted}
		<div class="treehole-submitted-hint">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
			<span>已投入树洞，经审核后将展示在这里</span>
		</div>
	{/if}

	{#if error}
		<div class="treehole-error">{error}</div>
	{/if}

	<textarea
		class="treehole-textarea"
		placeholder="把心里的话留在这里，没人知道你是谁..."
		rows="4"
		maxlength={MAX}
		disabled={submitting}
		oninput={onInput}
		bind:value={content}
	></textarea>

	<div class="treehole-compose-footer">
		<span class="treehole-counter">{content.length} / {MAX}</span>
		<button
			class="treehole-submit-btn"
			onclick={submit}
			disabled={content.trim().length < 5 || submitting}
		>
			{submitting ? "投递中..." : "投入树洞"}
		</button>
	</div>
</div>
