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

	const allConsoleLogs = [];
	const allRequests = [];

	page.on('console', (msg) => {
		allConsoleLogs.push({ type: msg.type(), text: msg.text() });
	});

	page.on('request', (req) => {
		allRequests.push({ method: req.method(), url: req.url() });
	});

	page.on('response', async (res) => {
		if (res.url().includes('/api/notebook')) {
			console.log('\n=== API 响应 ===');
			console.log('URL:', res.url());
			console.log('Status:', res.status());
			try {
				const body = await res.json();
				console.log('Body:', JSON.stringify(body, null, 2).slice(0, 1000));
			} catch (e) {
				console.log('Body parse error:', e.message);
			}
		}
	});

	console.log('=== 访问详情页 ===');
	const url = 'http://localhost:4321/notebook/view/?name=' + encodeURIComponent('阅读记录');
	await page.goto(url, { waitUntil: 'networkidle' });
	
	console.log('等待 5 秒让内容加载...');
	await page.waitForTimeout(5000);

	console.log('\n=== 页面 DOM 结构检查 ===');
	const domInfo = await page.evaluate(() => {
		const result = {};
		
		// 检查加载状态
		const loading = document.getElementById('notebook-loading');
		result.loadingDisplay = loading ? loading.style.display : 'not found';
		result.loadingClass = loading ? loading.className : 'not found';
		
		// 检查空状态
		const empty = document.getElementById('notebook-empty');
		result.emptyDisplay = empty ? empty.style.display : 'not found';
		result.emptyClass = empty ? empty.className : 'not found';
		result.emptyText = empty ? empty.querySelector('p')?.textContent : 'not found';
		
		// 检查列表
		const list = document.getElementById('notebook-entry-list');
		result.listDisplay = list ? list.style.display : 'not found';
		result.listClass = list ? list.className : 'not found';
		result.entryCount = list ? list.querySelectorAll('.notebook-entry').length : 0;
		
		// 检查标题
		const detailHeader = document.querySelector('.notebook-detail-header');
		result.detailHeaderHTML = detailHeader ? detailHeader.innerHTML.slice(0, 500) : 'not found';
		
		const h1 = document.querySelector('.notebook-detail-header h1');
		result.h1Text = h1 ? h1.textContent : 'not found';
		
		const countEl = document.getElementById('notebook-detail-count');
		result.countText = countEl ? countEl.textContent : 'not found';
		
		// 检查 page-title 组件
		const pageTitle = document.querySelector('.page-title__text');
		result.pageTitleText = pageTitle ? pageTitle.textContent : 'not found';
		
		return result;
	});
	
	console.log(JSON.stringify(domInfo, null, 2));

	console.log('\n=== 所有控制台日志 ===');
	allConsoleLogs.forEach(log => {
		console.log(`[${log.type}] ${log.text}`);
	});

	console.log('\n=== 所有网络请求 ===');
	allRequests.forEach(req => {
		console.log(`${req.method} ${req.url}`);
	});

	console.log('\n=== 截图详情页 ===');
	await page.screenshot({ path: path.join(screenshotDir, '03-notebook-detail-debug.png'), fullPage: true });
	console.log('截图已保存: 03-notebook-detail-debug.png');

	await browser.close();
})();
