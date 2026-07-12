import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试笔记本详情页...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	page.on('console', (msg) => {
		console.log(`[Console ${msg.type()}] ${msg.text()}`);
	});

	page.on('requestfailed', (req) => {
		console.log(`[Request Failed] ${req.url()} - ${req.failure()?.errorText}`);
	});

	console.log('📋 访问列表页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1000);

	const cardNames = await page.evaluate(() => {
		return Array.from(document.querySelectorAll('.notebook-card__name')).map((el) => el.textContent);
	});
	console.log('卡片列表:', cardNames);

	console.log('\n📖 点击"治愈日常番"...');
	const targetCard = page.locator('.notebook-card', { hasText: '治愈日常番' });
	console.log('找到的卡片数量:', await targetCard.count());

	if ((await targetCard.count()) > 0) {
		await targetCard.click();
	} else {
		console.log('未找到，点击第一个卡片');
		await page.locator('.notebook-card').first().click();
	}

	console.log('等待导航...');
	await page.waitForLoadState('networkidle');
	console.log('当前URL:', page.url());

	await delay(5000);

	console.log('\n🔍 检查页面状态...');
	const pageState = await page.evaluate(() => {
		const loading = document.getElementById('notebook-loading');
		const empty = document.getElementById('notebook-empty');
		const list = document.getElementById('notebook-entry-list');
		const countEl = document.getElementById('notebook-detail-count');

		return {
			loadingDisplay: loading ? window.getComputedStyle(loading).display : 'not found',
			emptyDisplay: empty ? window.getComputedStyle(empty).display : 'not found',
			listDisplay: list ? window.getComputedStyle(list).display : 'not found',
			countText: countEl ? countEl.textContent : 'not found',
			entryCount: list ? list.querySelectorAll('.notebook-entry').length : 0,
			searchParams: new URLSearchParams(window.location.search).toString(),
		};
	});

	console.log('页面状态:', JSON.stringify(pageState, null, 2));

	console.log('\n🖼️ 截图保存...');
	await page.screenshot({ path: './notebook-test-screenshots/debug-detail.png', fullPage: true });

	await delay(2000);
	await browser.close();
	console.log('\n✅ 调试完成！');
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
