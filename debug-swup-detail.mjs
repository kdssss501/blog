import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试 Swup 详情页导航...\n');

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

	console.log('① 访问 notebook 列表页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1000);

	const listCards = await page.evaluate(() => document.querySelectorAll('.notebook-card').length);
	console.log(`列表页卡片数量: ${listCards}`);

	console.log('\n② 点击第一个卡片...');
	const firstCard = page.locator('.notebook-card').first();
	const firstName = await firstCard.locator('.notebook-card__name').textContent();
	console.log(`点击卡片: ${firstName}`);

	await firstCard.click();
	await delay(5000);

	console.log('\n③ 检查详情页状态...');

	const detailState = await page.evaluate(() => {
		const list = document.getElementById('notebook-entry-list');
		const loading = document.getElementById('notebook-loading');
		const count = document.getElementById('notebook-detail-count');
		const entries = list ? list.querySelectorAll('.notebook-entry') : [];
		
		const scripts = document.querySelectorAll('script');
		const notebookScripts = [];
		scripts.forEach((s, i) => {
			const text = s.textContent || '';
			if (text.includes('loadEntries') || text.includes('notebook-detail')) {
				notebookScripts.push({
					index: i,
					hasSwupIgnore: s.hasAttribute('data-swup-ignore-script'),
					isInline: s.hasAttribute('is:inline'),
					textLength: text.length,
				});
			}
		});
		
		return {
			url: window.location.href,
			listDisplay: list ? list.style.display : 'no element',
			loadingDisplay: loading ? loading.style.display : 'no element',
			countText: count ? count.textContent : 'no element',
			entryCount: entries.length,
			hasLoadEntries: typeof loadEntries === 'function',
			notebookScripts,
			totalScripts: scripts.length,
			hasSwup: typeof window.swup !== 'undefined',
		};
	});

	console.log(JSON.stringify(detailState, null, 2));

	if (!detailState.hasLoadEntries) {
		console.log('\n⚠️  loadEntries 函数不存在！Swup 没有重新执行内联脚本');
	}

	console.log('\n④ 尝试手动调用 loadEntries...');
	const manualResult = await page.evaluate(() => {
		if (typeof loadEntries === 'function') {
			loadEntries();
			return 'called loadEntries';
		}
		return 'loadEntries not found';
	});
	console.log(manualResult);

	await delay(3000);

	const afterManual = await page.evaluate(() => {
		const list = document.getElementById('notebook-entry-list');
		const entries = list ? list.querySelectorAll('.notebook-entry') : [];
		return {
			entryCount: entries.length,
			listDisplay: list ? list.style.display : 'no element',
		};
	});
	console.log('手动调用后:', JSON.stringify(afterManual, null, 2));

	console.log('\n⑤ 直接访问详情页（非Swup）...');
	await page.goto(`${BASE_URL}/notebook/view/?name=%E6%B2%BB%E6%84%88%E6%97%A5%E5%B8%B8%E7%95%AA`);
	await delay(5000);

	const directDetail = await page.evaluate(() => {
		const list = document.getElementById('notebook-entry-list');
		const entries = list ? list.querySelectorAll('.notebook-entry') : [];
		return {
			url: window.location.href,
			entryCount: entries.length,
			hasLoadEntries: typeof loadEntries === 'function',
		};
	});
	console.log('直接访问结果:', JSON.stringify(directDetail, null, 2));

	await delay(1000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
