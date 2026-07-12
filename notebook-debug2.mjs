import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 深度调试笔记本详情页...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	let allConsole = [];
	page.on('console', (msg) => {
		allConsole.push({ type: msg.type(), text: msg.text() });
		console.log(`[Console ${msg.type()}] ${msg.text()}`);
	});

	let allRequests = [];
	page.on('request', (req) => {
		allRequests.push({ url: req.url(), method: req.method() });
	});

	page.on('response', async (res) => {
		if (res.url().includes('/api/notebook')) {
			console.log(`[Response] ${res.url()} - ${res.status()}`);
			try {
				const body = await res.text();
				console.log(`[Response Body] ${body.substring(0, 200)}...`);
			} catch (e) {
				console.log(`[Response Body Error] ${e}`);
			}
		}
	});

	console.log('📖 直接访问详情页...');
	await page.goto(`${BASE_URL}/notebook/view/?name=%E6%B2%BB%E6%84%88%E6%97%A5%E5%B8%B8%E7%95%AA`);

	console.log('等待10秒...');
	await delay(10000);

	console.log('\n🔍 检查页面状态...');
	const pageState = await page.evaluate(() => {
		const loading = document.getElementById('notebook-loading');
		const empty = document.getElementById('notebook-empty');
		const list = document.getElementById('notebook-entry-list');
		const countEl = document.getElementById('notebook-detail-count');

		return {
			loadingDisplay: loading ? window.getComputedStyle(loading).display : 'not found',
			emptyDisplay: empty ? window.getComputedStyle(empty).display : 'not found',
			emptyText: empty ? empty.textContent : 'not found',
			listDisplay: list ? window.getComputedStyle(list).display : 'not found',
			countText: countEl ? countEl.textContent : 'not found',
			entryCount: list ? list.querySelectorAll('.notebook-entry').length : 0,
			title: document.title,
			h1Text: document.querySelector('.notebook-detail-header h1')?.textContent || 'not found',
		};
	});

	console.log('页面状态:', JSON.stringify(pageState, null, 2));

	console.log('\n📋 所有控制台消息:');
	allConsole.forEach((c) => console.log(`  [${c.type}] ${c.text}`));

	console.log('\n🌐 所有API请求:');
	allRequests.filter((r) => r.url.includes('/api/')).forEach((r) => console.log(`  ${r.method} ${r.url}`));

	await delay(2000);
	await browser.close();
	console.log('\n✅ 调试完成！');
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
