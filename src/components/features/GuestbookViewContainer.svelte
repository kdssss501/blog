<script lang="ts">
/**
 * 留言板视图容器
 * 仅管理卡片视图，列表视图已移至弹窗
 */
import { onMount } from "svelte";
import GuestbookCardStack from "./GuestbookCardStack.svelte";
import GuestbookDataProvider from "./GuestbookDataProvider.svelte";

let isReady = $state(false);

onMount(() => {
	isReady = true;
});
</script>

<GuestbookDataProvider />

{#if isReady}
	<div class="guestbook-container">
		<GuestbookCardStack />
	</div>
{/if}
