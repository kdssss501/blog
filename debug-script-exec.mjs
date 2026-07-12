import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试 Swup 脚本执行...\n');

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

	console.log('① 访问列表页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1000);

	console.log('\n② 点击第一个卡片，监控脚本执行...');

	page.on('framenavigated', (frame) => {
		console.log('[FRAME] Frame navigated:', frame.url());
	});

	const firstCard = page.locator('.notebook-card').first();
	await firstCard.click();

	console.log('已点击，等待 8 秒...');
	await delay(8000);

	console.log('\n③ 检查详情页脚本情况:');

	const scriptInfo = await page.evaluate(() => {
		const allScripts = document.querySelectorAll('script');
		const inContainer = document.querySelectorAll('#swup-container script');
		const scriptDetails = [];
		
		inContainer.forEach((s, i) => {
			const text = s.textContent || '';
			scriptDetails.push({
				index: i,
				src: s.src || '(inline)',
				hasSwupIgnore: s.hasAttribute('data-swup-ignore-script'),
				isInline: s.hasAttribute('is:inline'),
				textLength: text.length,
				hasLoadEntries: text.includes('loadEntries'),
				hasLoadNotebooks: text.includes('loadNotebooks'),
			});
		});
		
		return {
			totalScripts: allScripts.length,
			scriptsInSwupContainer: inContainer.length,
			scriptDetails,
			hasLoadEntriesGlobal: typeof loadEntries === 'function',
			hasLoadNotebooksGlobal: typeof loadNotebooks === 'function',
			url: window.location.href,
		};
	});

	console.log(JSON.stringify(scriptInfo, null, 2));

	console.log('\n④ 检查 Swup 实例和配置:');
	const swupInfo = await page.evaluate(() => {
		if (!window.swup) return { hasSwup: false };
		return {
			hasSwup: true,
			containers: window.swup.options.containers,
			plugins: window.swup.plugins.map(p => p.name),
		};
	});
	console.log(JSON.stringify(swupInfo, null, 2));

	await delay(1000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
