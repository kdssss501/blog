import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();

	const url = 'http://localhost:4321/notebook/view/?name=' + encodeURIComponent('阅读记录');
	await page.goto(url, { waitUntil: 'networkidle' });
	await page.waitForTimeout(3000);

	console.log('=== 检查元素可见性 ===');
	const visibilityInfo = await page.evaluate(() => {
		const result = {};
		
		const list = document.getElementById('notebook-entry-list');
		if (list) {
			const style = window.getComputedStyle(list);
			result.list = {
				display: style.display,
				visibility: style.visibility,
				opacity: style.opacity,
				classList: list.className,
				offsetHeight: list.offsetHeight,
				offsetWidth: list.offsetWidth,
				clientHeight: list.clientHeight,
				scrollHeight: list.scrollHeight,
			};
			
			const entries = list.querySelectorAll('.notebook-entry');
			result.entryCount = entries.length;
			
			if (entries.length > 0) {
				const firstEntry = entries[0];
				const entryStyle = window.getComputedStyle(firstEntry);
				result.firstEntry = {
					display: entryStyle.display,
					visibility: entryStyle.visibility,
					opacity: entryStyle.opacity,
					offsetHeight: firstEntry.offsetHeight,
					outerHTML: firstEntry.outerHTML.slice(0, 300),
				};
			}
		}
		
		const container = document.getElementById('notebook-detail-container');
		if (container) {
			const style = window.getComputedStyle(container);
			result.container = {
				display: style.display,
				offsetHeight: container.offsetHeight,
			};
		}
		
		return result;
	});
	
	console.log(JSON.stringify(visibilityInfo, null, 2));

	console.log('\n=== 检查 hidden 类的 CSS 规则 ===');
	const cssRules = await page.evaluate(() => {
		const rules = [];
		for (const sheet of document.styleSheets) {
			try {
				for (const rule of sheet.cssRules) {
					if (rule.selectorText && rule.selectorText.includes('.hidden')) {
						rules.push({
							selector: rule.selectorText,
							cssText: rule.cssText,
						});
					}
				}
			} catch (e) {
				// cross-origin stylesheets
			}
		}
		return rules;
	});
	
	console.log(JSON.stringify(cssRules, null, 2));

	await browser.close();
})();
