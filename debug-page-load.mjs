import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试页面加载...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	page.on('console', (msg) => {
		console.log(`[Console ${msg.type()}] ${msg.text()}`);
	});

	page.on('pageerror', (err) => {
		console.log(`[Page Error] ${err.message}`);
	});

	console.log('访问 notebook 列表页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await delay(5000);

	console.log('\n📊 页面状态检查:');

	const state = await page.evaluate(() => {
		const masonry = document.getElementById('notebook-masonry');
		const loading = document.getElementById('notebook-loading');
		const empty = document.getElementById('notebook-empty');
		const scripts = document.querySelectorAll('script');
		const inlineScripts = [];
		scripts.forEach((s, i) => {
			if (!s.src) {
				inlineScripts.push({
					index: i,
					hasSwupIgnore: s.hasAttribute('data-swup-ignore-script'),
					isInline: s.hasAttribute('is:inline'),
					textLength: s.textContent?.length || 0,
				});
			}
		});
		return {
			masonryClass: masonry?.className || 'not found',
			masonryDisplay: masonry ? window.getComputedStyle(masonry).display : 'not found',
			loadingDisplay: loading ? window.getComputedStyle(loading).display : 'not found',
			emptyDisplay: empty ? window.getComputedStyle(empty).display : 'not found',
			hasSwup: typeof window.swup !== 'undefined',
			astroPageLoadFired: window.__astroPageLoadFired || false,
			totalScripts: scripts.length,
			inlineScripts,
			location: window.location.href,
		};
	});

	console.log(JSON.stringify(state, null, 2));

	console.log('\n🔍 手动触发 loadNotebooks 看看...');
	const result = await page.evaluate(() => {
		if (typeof loadNotebooks === 'function') {
			loadNotebooks();
			return 'called loadNotebooks';
		}
		return 'loadNotebooks not found';
	});
	console.log(result);

	await delay(3000);

	const state2 = await page.evaluate(() => {
		const masonry = document.getElementById('notebook-masonry');
		const cards = document.querySelectorAll('.notebook-card');
		return {
			masonryDisplay: masonry ? window.getComputedStyle(masonry).display : 'not found',
			cardCount: cards.length,
		};
	});
	console.log('\n📊 手动调用后状态:');
	console.log(JSON.stringify(state2, null, 2));

	await delay(2000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
