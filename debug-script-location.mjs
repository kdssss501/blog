import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试脚本位置...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	console.log('① 直接访问详情页...');
	await page.goto(`${BASE_URL}/notebook/view/?name=%E6%B2%BB%E6%84%88%E6%97%A5%E5%B8%B8%E7%95%AA`);
	await delay(3000);

	const allScripts = await page.evaluate(() => {
		const scripts = document.querySelectorAll('script');
		const result = [];
		scripts.forEach((s, i) => {
			const text = s.textContent || '';
			const parent = s.parentElement;
			let inSwupContainer = false;
			let el = s;
			while (el) {
				if (el.id === 'swup-container') {
					inSwupContainer = true;
					break;
				}
				el = el.parentElement;
			}
			result.push({
				index: i,
				src: s.src || '(inline)',
				textLength: text.length,
				inSwupContainer,
				parentTag: parent?.tagName || '',
				parentId: parent?.id || '',
				parentClass: parent?.className || '',
				hasLoadEntries: text.includes('function loadEntries'),
				hasLoadNotebooks: text.includes('function loadNotebooks'),
			});
		});
		return result;
	});

	console.log('\n所有脚本:');
	allScripts.forEach((s) => {
		const marker = s.hasLoadEntries ? '📗' : s.hasLoadNotebooks ? '📘' : '';
		console.log(`  [${s.index}] ${marker} src=${s.src.substring(0, 50)} len=${s.textLength} inSwup=${s.inSwupContainer} parent=${s.parentTag}#${s.parentId}`);
	});

	console.log('\n② 通过 Swup 导航从列表页到详情页...');
	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1000);

	const firstCard = page.locator('.notebook-card').first();
	await firstCard.click();
	await delay(5000);

	const afterSwupScripts = await page.evaluate(() => {
		const scripts = document.querySelectorAll('script');
		const result = [];
		scripts.forEach((s, i) => {
			const text = s.textContent || '';
			let inSwupContainer = false;
			let el = s;
			while (el) {
				if (el.id === 'swup-container') {
					inSwupContainer = true;
					break;
				}
				el = el.parentElement;
			}
			result.push({
				index: i,
				src: s.src || '(inline)',
				textLength: text.length,
				inSwupContainer,
				hasLoadEntries: text.includes('function loadEntries'),
				hasLoadNotebooks: text.includes('function loadNotebooks'),
			});
		});
		return result;
	});

	console.log('\nSwup 导航后的脚本:');
	afterSwupScripts.forEach((s) => {
		const marker = s.hasLoadEntries ? '📗' : s.hasLoadNotebooks ? '📘' : '';
		console.log(`  [${s.index}] ${marker} len=${s.textLength} inSwup=${s.inSwupContainer}`);
	});

	const hasLoadEntries = afterSwupScripts.some(s => s.hasLoadEntries);
	console.log(`\n包含 loadEntries 函数的脚本: ${hasLoadEntries ? '✅ 有' : '❌ 没有'}`);

	await delay(1000);
	await browser.close();
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
