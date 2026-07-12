import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve('./notebook-test-screenshots');
if (!fs.existsSync(screenshotDir)) {
	fs.mkdirSync(screenshotDir, { recursive: true });
}

(async () => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();

	const consoleErrors = [];
	const pageErrors = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			consoleErrors.push({ text: msg.text(), location: msg.location() });
		}
	});

	page.on('pageerror', (err) => {
		pageErrors.push(err.message);
	});

	console.log('=== 步骤 1-2: 访问笔记本列表页并等待加载 ===');
	await page.goto('http://localhost:4321/notebook/', { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);

	console.log('=== 步骤 3: 截图列表页 ===');
	await page.screenshot({ path: path.join(screenshotDir, '01-notebook-list.png'), fullPage: true });
	console.log('截图已保存: 01-notebook-list.png');

	console.log('\n=== 步骤 4: 检查控制台错误 ===');
	console.log('Console errors:', JSON.stringify(consoleErrors, null, 2));
	console.log('Page errors:', JSON.stringify(pageErrors, null, 2));

	console.log('\n=== 步骤 5: 检查第一张卡片的背景图 ===');
	const cardInfo = await page.evaluate(() => {
		const card = document.querySelector('.notebook-card');
		if (card) {
			const style = window.getComputedStyle(card);
			const bg = style.backgroundImage;
			const rect = card.getBoundingClientRect();
			return JSON.stringify({
				hasCard: true,
				bgImage: bg,
				width: rect.width,
				height: rect.height,
				ratio: (rect.width / rect.height).toFixed(3),
			});
		}
		return 'No cards found';
	});
	console.log('卡片信息:', cardInfo);

	console.log('\n=== 步骤 6: 点击第一个笔记本卡片 ===');
	const firstCard = page.locator('.notebook-card').first();
	const cardCount = await page.locator('.notebook-card').count();
	console.log('找到卡片数量:', cardCount);

	if (cardCount > 0) {
		const href = await firstCard.getAttribute('href');
		console.log('第一个卡片链接:', href);

		const detailConsoleErrors = [];
		const detailPageErrors = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				detailConsoleErrors.push({ text: msg.text(), location: msg.location() });
			}
		});
		page.on('pageerror', (err) => {
			detailPageErrors.push(err.message);
		});

		await firstCard.click();
		await page.waitForLoadState('networkidle');

		console.log('当前 URL:', page.url());

		console.log('\n=== 步骤 7: 详情页等待2秒 ===');
		await page.waitForTimeout(2000);

		const detailContent = await page.evaluate(() => {
			const body = document.body;
			return {
				title: document.title,
				bodyTextLength: body.innerText.length,
				hasEntries: document.querySelectorAll('.notebook-entry').length,
				hasBackButton: document.querySelectorAll('.notebook-back').length > 0,
				hasDetailTitle: document.querySelectorAll('.notebook-detail-title').length > 0,
			};
		});
		console.log('详情页内容信息:', JSON.stringify(detailContent, null, 2));

		console.log('\n=== 步骤 8: 检查详情页控制台错误 ===');
		console.log('详情页 Console errors:', JSON.stringify(detailConsoleErrors, null, 2));
		console.log('详情页 Page errors:', JSON.stringify(detailPageErrors, null, 2));

		console.log('\n=== 步骤 9: 截图详情页 ===');
		await page.screenshot({ path: path.join(screenshotDir, '02-notebook-detail.png'), fullPage: true });
		console.log('截图已保存: 02-notebook-detail.png');
	} else {
		console.log('没有找到卡片，无法进行跳转测试');
	}

	console.log('\n=== 总结报告 ===');
	console.log('列表页卡片数量:', cardCount);
	console.log('列表页控制台错误数:', consoleErrors.length + pageErrors.length);

	await browser.close();
	console.log('\n测试完成，截图保存在:', screenshotDir);
})();
