<script lang="ts">
function openCompose() {
	window.dispatchEvent(new CustomEvent("guestbook:open-compose"));
}

function openList() {
	window.dispatchEvent(new CustomEvent("guestbook:open-list"));
}
</script>

<div class="compose-btn-group">
	<button class="compose-btn list-btn" onclick={openList}>
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
		查看列表
	</button>
	<button class="compose-btn" onclick={openCompose}>
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
		发表留言
	</button>
</div>
