import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4321';
const SCREENSHOT_DIR = path.resolve('./notebook-test-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
	fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
	test1_listPage: {},
	test2_detailPage: {},
	test3_anotherNotebook: {},
	test4_consoleErrors: {
		listPage: [],
		detailPage: [],
	},
	notes: [],
};

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
	console.log('🚀 启动笔记本功能测试...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	const allConsoleErrors = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			allConsoleErrors.push({
				text: msg.text(),
				url: msg.location()?.url || '',
				line: msg.location()?.lineNumber || 0,
			});
		}
	});

	// ==================== 测试1：列表页展示 ====================
	console.log('📋 测试1：列表页展示');
	console.log('   访问 http://localhost:4321/notebook/ ...');

	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1500);

	console.log('   页面加载完成，开始检查...');

	results.test4_consoleErrors.listPage = [...allConsoleErrors];

	const cardData = await page.evaluate(() => {
		const cards = document.querySelectorAll('.notebook-card');
		const cardResults = [];
		cards.forEach((card, i) => {
			const rect = card.getBoundingClientRect();
			const bg = window.getComputedStyle(card).backgroundImage;
			const name = card.querySelector('.notebook-card__name')?.textContent || '';
			const count = card.querySelector('.notebook-card__count')?.textContent || '';
			const desc = card.querySelector('.notebook-card__desc')?.textContent || '';
			cardResults.push({
				index: i,
				name: name,
				count: count,
				desc: desc,
				width: Math.round(rect.width),
				height: Math.round(rect.height),
				ratio: (rect.width / rect.height).toFixed(3),
				hasRealBg: bg.indexOf('notebook-bg/bg-') > -1,
				bgImage: bg,
			});
		});
		return { count: cards.length, cards: cardResults };
	});

	results.test1_listPage = cardData;

	console.log(`   卡片数量: ${cardData.count}`);
	cardData.cards.forEach((c) => {
		console.log(`   - [${c.index}] ${c.name} (${c.count}) | 比例: ${c.ratio} | 真实背景: ${c.hasRealBg ? '✅' : '❌'}`);
	});

	const expectedNames = ['治愈日常番', '热血战斗番', '异世界番', '校园恋爱番', '推理悬疑番', '运动番'];
	const actualNames = cardData.cards.map((c) => c.name);
	const allExpectedPresent = expectedNames.every((name) => actualNames.includes(name));
	console.log(`   包含全部6个预期笔记本: ${allExpectedPresent ? '✅' : '❌'}`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-notebook-list.png'), fullPage: true });
	console.log('   截图已保存: 01-notebook-list.png\n');

	// ==================== 测试2：点击进入详情页（直接访问验证） ====================
	console.log('📖 测试2：详情页展示和功能');

	const targetNotebook = '治愈日常番';
	console.log(`   直接访问"${targetNotebook}"详情页...`);

	allConsoleErrors.length = 0;

	const detailUrl = `${BASE_URL}/notebook/view/?name=${encodeURIComponent(targetNotebook)}`;
	await page.goto(detailUrl);
	await page.waitForLoadState('networkidle');
	await delay(3000);

	const currentUrl = page.url();
	console.log(`   当前URL: ${currentUrl}`);

	const hasNameParam = currentUrl.includes('name=');
	console.log(`   URL包含name参数: ${hasNameParam ? '✅' : '❌'}`);

	results.test4_consoleErrors.detailPage = [...allConsoleErrors];

	const entryData = await page.evaluate(() => {
		const entries = document.querySelectorAll('.notebook-entry');
		const entryResults = [];
		entries.forEach((entry, i) => {
			const rect = entry.getBoundingClientRect();
			const bg = window.getComputedStyle(entry).backgroundImage;
			const title = entry.querySelector('.notebook-entry__title')?.textContent || '';
			const date = entry.querySelector('.notebook-entry__date')?.textContent || '';
			const preview = entry.querySelector('.notebook-entry__preview')?.textContent || '';
			entryResults.push({
				index: i,
				title: title,
				date: date,
				preview: preview.substring(0, 50),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
				ratio: (rect.width / rect.height).toFixed(3),
				hasRealBg: bg.indexOf('notebook-bg/bg-') > -1,
				isExpanded: entry.classList.contains('is-expanded'),
			});
		});
		const countText = document.querySelector('#notebook-detail-count')?.textContent || '';
		return { count: entries.length, entries: entryResults, countText };
	});

	results.test2_detailPage = {
		notebookName: targetNotebook,
		url: currentUrl,
		hasNameParam,
		...entryData,
	};

	console.log(`   笔记数量: ${entryData.count} (${entryData.countText})`);
	entryData.entries.forEach((e) => {
		console.log(`   - [${e.index}] ${e.title} | 日期: ${e.date} | 比例: ${e.ratio} | 真实背景: ${e.hasRealBg ? '✅' : '❌'}`);
	});

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-notebook-detail-before-expand.png'), fullPage: true });
	console.log('   截图已保存: 02-notebook-detail-before-expand.png');

	let firstEntryExpanded = false;
	if (entryData.count > 0) {
		console.log('   点击第一篇笔记展开内容...');
		const firstEntryHeader = page.locator('.notebook-entry .notebook-entry__header').first();
		await firstEntryHeader.click();
		await delay(800);

		firstEntryExpanded = await page.evaluate(() => {
			const entry = document.querySelector('.notebook-entry');
			return entry ? entry.classList.contains('is-expanded') : false;
		});
		console.log(`   笔记是否展开: ${firstEntryExpanded ? '✅' : '❌'}`);

		const expandedContent = await page.evaluate(() => {
			const entry = document.querySelector('.notebook-entry');
			const content = entry?.querySelector('.notebook-entry__content-inner')?.textContent || '';
			return content.substring(0, 100);
		});
		console.log(`   展开内容预览: ${expandedContent}...`);

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-notebook-detail-after-expand.png'), fullPage: true });
		console.log('   截图已保存: 03-notebook-detail-after-expand.png');
	} else {
		console.log('   ⚠️  没有笔记可展开，跳过展开测试');
	}

	results.test2_detailPage.firstEntryExpanded = firstEntryExpanded;

	// 测试点击导航进入详情页（验证是否有swup问题）
	console.log('\n   返回列表页，测试点击导航...');
	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 10000 });
	await delay(1000);

	console.log('   点击卡片进入详情页...');
	const cardToClick = page.locator('.notebook-card', { hasText: targetNotebook });
	await cardToClick.click();
	await delay(4000);

	const afterClickEntryCount = await page.evaluate(() => {
		return document.querySelectorAll('.notebook-entry').length;
	});

	const swupIssue = afterClickEntryCount === 0;
	if (swupIssue) {
		console.log('   ⚠️  发现问题：通过点击导航进入详情页后，笔记列表未加载（swup页面转场问题）');
		results.notes.push('发现问题：通过点击导航（swup页面转场）进入详情页后，内联脚本未重新执行，导致笔记列表未加载。直接访问详情页URL则正常。');
	} else {
		console.log('   ✅ 点击导航进入详情页正常');
	}

	console.log('');

	// ==================== 测试3：返回并测试另一个笔记本 ====================
	console.log('🔙 测试3：另一个笔记本');

	const secondNotebook = '热血战斗番';
	console.log(`   直接访问"${secondNotebook}"详情页...`);

	const secondDetailUrl = `${BASE_URL}/notebook/view/?name=${encodeURIComponent(secondNotebook)}`;
	await page.goto(secondDetailUrl);
	await page.waitForLoadState('networkidle');
	await delay(3000);

	const secondEntryData = await page.evaluate(() => {
		const entries = document.querySelectorAll('.notebook-entry');
		const countText = document.querySelector('#notebook-detail-count')?.textContent || '';
		const entryResults = [];
		entries.forEach((entry, i) => {
			const title = entry.querySelector('.notebook-entry__title')?.textContent || '';
			entryResults.push({ index: i, title });
		});
		return { count: entries.length, countText, entries: entryResults };
	});

	results.test3_anotherNotebook = {
		notebookName: secondNotebook,
		url: secondDetailUrl,
		...secondEntryData,
	};

	console.log(`   笔记数量: ${secondEntryData.count} (${secondEntryData.countText})`);
	secondEntryData.entries.forEach((e) => {
		console.log(`   - [${e.index}] ${e.title}`);
	});

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-notebook-second-detail.png'), fullPage: true });
	console.log('   截图已保存: 04-notebook-second-detail.png');

	console.log('');

	// ==================== 输出测试报告 ====================
	console.log('═══════════════════════════════════════════════');
	console.log('📊 测试报告汇总');
	console.log('═══════════════════════════════════════════════');

	console.log('\n📋 测试1：列表页展示');
	console.log(`  卡片总数: ${results.test1_listPage.count} ${results.test1_listPage.count === 6 ? '✅' : '❌'}`);
	console.log(`  卡片名称: ${results.test1_listPage.cards.map((c) => c.name).join(', ')}`);
	console.log(`  包含全部6个预期笔记本: ${allExpectedPresent ? '✅' : '❌'}`);
	const allRatioCorrect = results.test1_listPage.cards.every((c) => Math.abs(parseFloat(c.ratio) - 1.778) < 0.1);
	console.log(`  比例正确(16:9 ≈1.778): ${allRatioCorrect ? '✅' : '❌'}`);
	const allRealBg = results.test1_listPage.cards.every((c) => c.hasRealBg);
	console.log(`  背景图真实(非占位符): ${allRealBg ? '✅' : '❌'}`);
	const allTextReadable = results.test1_listPage.cards.every((c) => c.name.length > 0);
	console.log(`  文字清晰可读: ${allTextReadable ? '✅' : '❌'}`);

	console.log('\n📖 测试2：详情页展示与交互');
	console.log(`  笔记本名称: ${results.test2_detailPage.notebookName}`);
	console.log(`  URL有name参数: ${results.test2_detailPage.hasNameParam ? '✅' : '❌'}`);
	console.log(`  笔记数量: ${results.test2_detailPage.count} (${results.test2_detailPage.countText})`);
	if (results.test2_detailPage.entries?.length > 0) {
		const entriesRatioCorrect = results.test2_detailPage.entries.every((e) => Math.abs(parseFloat(e.ratio) - 1.778) < 0.1);
		console.log(`  笔记卡片比例正确: ${entriesRatioCorrect ? '✅' : '❌'}`);
		const entriesRealBg = results.test2_detailPage.entries.every((e) => e.hasRealBg);
		console.log(`  笔记背景图真实: ${entriesRealBg ? '✅' : '❌'}`);
	}
	console.log(`  笔记展开功能: ${results.test2_detailPage.firstEntryExpanded ? '✅' : '❌'}`);
	console.log(`  swup导航问题: ${swupIssue ? '⚠️ 存在' : '✅ 无'}`);

	console.log('\n🔙 测试3：另一个笔记本');
	console.log(`  笔记本名称: ${results.test3_anotherNotebook.notebookName}`);
	console.log(`  笔记数量: ${results.test3_anotherNotebook.count} (${results.test3_anotherNotebook.countText})`);

	console.log('\n⚠️  测试4：控制台错误');
	console.log(`  列表页错误数: ${results.test4_consoleErrors.listPage.length}`);
	if (results.test4_consoleErrors.listPage.length > 0) {
		results.test4_consoleErrors.listPage.forEach((e) => console.log(`    - ${e.text}`));
	}
	console.log(`  详情页错误数: ${results.test4_consoleErrors.detailPage.length}`);
	if (results.test4_consoleErrors.detailPage.length > 0) {
		results.test4_consoleErrors.detailPage.forEach((e) => console.log(`    - ${e.text}`));
	}

	console.log('\n📝 备注:');
	if (results.notes.length > 0) {
		results.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
	} else {
		console.log('  无');
	}

	console.log('\n🖼️  截图保存位置:');
	console.log(`  ${SCREENSHOT_DIR}`);
	const screenshotFiles = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
	screenshotFiles.forEach((f) => console.log(`  - ${f}`));

	const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
	fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
	console.log(`\n📄 详细JSON报告: ${reportPath}`);

	await delay(2000);
	await browser.close();

	console.log('\n✅ 测试完成！');
}

runTests().catch((err) => {
	console.error('❌ 测试执行失败:', err);
	process.exit(1);
});
