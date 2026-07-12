import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试 astro:page-load 事件...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	await page.addInitScript(() => {
		window.__astroPageLoadCount = 0;
		window.__astroPageLoadEvents = [];
		const origAdd = document.addEventListener;
		document.addEventListener = function(type, handler, options) {
			if (type === 'astro:page-load') {
				console.log('[DEBUG] astro:page-load listener added:', handler.name || 'anonymous');
			}
			return origAdd.call(this, type, function(...args) {
				if (type === 'astro:page-load') {
					window.__astroPageLoadCount++;
					window.__astroPageLoadEvents.push({
						time: Date.now(),
						handler: handler.name || 'anonymous',
					});
					console.log('[DEBUG] astro:page-load fired! Count:', window.__astroPageLoadCount, 'Handler:', handler.name || 'anonymous');
				}
				return handler.apply(this, args);
			}, options);
		};
	});

	page.on('console', (msg) => {
		if (msg.text().includes('[DEBUG]') || msg.type() === 'error') {
			console.log(`[Console ${msg.type()}] ${msg.text()}`);
		}
	});

	console.log('访问 notebook 列表页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await delay(5000);

	console.log('\n📊 结果:');
	const result = await page.evaluate(() => {
		const masonry = document.getElementById('notebook-masonry');
		const cards = document.querySelectorAll('.notebook-card');
		return {
			astroPageLoadCount: window.__astroPageLoadCount,
			astroPageLoadEvents: window.__astroPageLoadEvents,
			masonryVisible: masonry && window.getComputedStyle(masonry).display !== 'none',
			cardCount: cards.length,
			hasLoadNotebooks: typeof loadNotebooks === 'function',
		};
	});

	console.log(JSON.stringify(result, null, 2));

	if (!result.masonryVisible) {
		console.log('\n🔧 手动触发 loadNotebooks...');
		await page.evaluate(() => loadNotebooks());
		await delay(2000);
		const after = await page.evaluate(() => {
			const masonry = document.getElementById('notebook-masonry');
			const cards = document.querySelectorAll('.notebook-card');
			return {
				masonryVisible: masonry && window.getComputedStyle(masonry).display !== 'none',
				cardCount: cards.length,
			};
		});
		console.log('手动调用后:', JSON.stringify(after, null, 2));
	}

	await delay(1000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
