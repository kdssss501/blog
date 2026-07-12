import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
	const page = await context.newPage();

	const url = 'http://localhost:4321/notebook/view/?name=' + encodeURIComponent('阅读记录');
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);

	// 滚动到内容区域
	await page.evaluate(() => {
		const container = document.getElementById('notebook-detail-container');
		if (container) {
			container.scrollIntoView({ behavior: 'smooth' });
		}
	});
	
	await page.waitForTimeout(1000);

	// 检查卡片的颜色
	const colorInfo = await page.evaluate(() => {
		const entries = document.querySelectorAll('.notebook-entry');
		const result = [];
		
		entries.forEach((entry, index) => {
			const style = window.getComputedStyle(entry);
			const body = document.body;
			const bodyStyle = window.getComputedStyle(body);
			
			result.push({
				index,
				backgroundColor: style.backgroundColor,
				backgroundImage: style.backgroundImage,
				color: style.color,
				bodyBg: bodyStyle.backgroundColor,
				position: entry.getBoundingClientRect(),
			});
		});
		
		return result;
	});
	
	console.log('=== 卡片颜色信息 ===');
	console.log(JSON.stringify(colorInfo, null, 2));

	// 对内容区域截图
	const list = page.locator('#notebook-entry-list');
	await list.screenshot({ path: './notebook-test-screenshots/04-entry-list-closeup.png' });
	console.log('\n已保存条目列表特写截图');

	await browser.close();
})();
