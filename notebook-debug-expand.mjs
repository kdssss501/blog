import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4321';

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDebug() {
	console.log('🔍 调试笔记展开功能...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	console.log('📖 访问治愈日常番详情页...');
	await page.goto(`${BASE_URL}/notebook/view/?name=%E6%B2%BB%E6%84%88%E6%97%A5%E5%B8%B8%E7%95%AA`);
	await page.waitForLoadState('networkidle');
	await delay(3000);

	const beforeState = await page.evaluate(() => {
		const entry = document.querySelector('.notebook-entry');
		if (!entry) return { error: 'no entry found' };
		return {
			hasIsExpandedClass: entry.classList.contains('is-expanded'),
			contentMaxHeight: window.getComputedStyle(entry.querySelector('.notebook-entry__content')).maxHeight,
			aspectRatio: window.getComputedStyle(entry).aspectRatio,
		};
	});
	console.log('点击前状态:', JSON.stringify(beforeState, null, 2));

	console.log('\n🖱️  点击第一篇笔记的header...');
	const header = page.locator('.notebook-entry .notebook-entry__header').first();
	await header.click();
	await delay(1000);

	const afterState = await page.evaluate(() => {
		const entry = document.querySelector('.notebook-entry');
		if (!entry) return { error: 'no entry found' };
		return {
			hasIsExpandedClass: entry.classList.contains('is-expanded'),
			contentMaxHeight: window.getComputedStyle(entry.querySelector('.notebook-entry__content')).maxHeight,
			aspectRatio: window.getComputedStyle(entry).aspectRatio,
			contentVisible: window.getComputedStyle(entry.querySelector('.notebook-entry__content')).maxHeight !== '0px',
		};
	});
	console.log('点击后状态:', JSON.stringify(afterState, null, 2));

	console.log('\n📸 截图...');
	await page.screenshot({ path: './notebook-test-screenshots/debug-expand.png', fullPage: true });

	await delay(2000);
	await browser.close();
	console.log('\n✅ 调试完成！');
}

runDebug().catch((err) => {
	console.error('❌ 调试失败:', err);
	process.exit(1);
});
