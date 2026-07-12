import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试首次加载时 astro:page-load 事件...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	await page.addInitScript(() => {
		window.__astroPageLoadCount = 0;
		const origDispatch = document.dispatchEvent;
		document.dispatchEvent = function(event) {
			if (event.type === 'astro:page-load') {
				window.__astroPageLoadCount++;
				console.log('[DEBUG] astro:page-load dispatched! Count:', window.__astroPageLoadCount);
			}
			return origDispatch.call(this, event);
		};
	});

	page.on('console', (msg) => {
		if (msg.text().includes('[DEBUG]') || msg.type() === 'error') {
			console.log(`[Console ${msg.type()}] ${msg.text()}`);
		}
	});

	console.log('① 直接访问详情页...');
	await page.goto(`${BASE_URL}/notebook/view/?name=%E6%B2%BB%E6%84%88%E6%97%A5%E5%B8%B8%E7%95%AA`);
	await delay(5000);

	const result = await page.evaluate(() => {
		const list = document.getElementById('notebook-entry-list');
		const entries = list ? list.querySelectorAll('.notebook-entry') : [];
		return {
			astroPageLoadCount: window.__astroPageLoadCount,
			entryCount: entries.length,
			hasLoadEntries: typeof loadEntries === 'function',
		};
	});

	console.log('\n📊 结果:');
	console.log(JSON.stringify(result, null, 2));

	await delay(1000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
