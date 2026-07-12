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
};

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEntries(page, timeout = 15000) {
	try {
		await page.waitForSelector('#notebook-entry-list', { state: 'visible', timeout });
		await page.waitForFunction(() => {
			const list = document.getElementById('notebook-entry-list');
			return list && list.querySelectorAll('.notebook-entry').length > 0;
		}, { timeout });
		return true;
	} catch {
		return false;
	}
}

async function runTests() {
	console.log('🚀 启动笔记本功能测试...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
	});
	const page = await context.newPage();

	const listPageErrors = [];
	const detailPageErrors = [];

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			const errorInfo = {
				text: msg.text(),
				url: msg.location()?.url || '',
				line: msg.location()?.lineNumber || 0,
			};
			listPageErrors.push(errorInfo);
			console.log(`   [Console Error] ${msg.text()}`);
		}
	});

	// ==================== 测试1：列表页展示 ====================
	console.log('📋 测试1：列表页展示');
	console.log('   访问 http://localhost:4321/notebook/ ...');

	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 15000 });
	await delay(1000);

	console.log('   页面加载完成，开始检查...');

	results.test4_consoleErrors.listPage = [...listPageErrors];

	const cardData = await page.evaluate(() => {
		const cards = document.querySelectorAll('.notebook-card');
		const cardResults = [];
		cards.forEach((card, i) => {
			const rect = card.getBoundingClientRect();
			const bg = window.getComputedStyle(card).backgroundImage;
			const name = card.querySelector('.notebook-card__name')?.textContent || '';
			const count = card.querySelector('.notebook-card__count')?.textContent || '';
			cardResults.push({
				index: i,
				name: name,
				count: count,
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

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-notebook-list.png'), fullPage: true });
	console.log('   截图已保存: 01-notebook-list.png\n');

	// ==================== 测试2：点击进入详情页 ====================
	console.log('📖 测试2：点击进入详情页');

	const targetNotebook = '治愈日常番';
	console.log(`   寻找"${targetNotebook}"卡片...`);

	const targetCard = page.locator('.notebook-card', { hasText: targetNotebook });
	const targetCardCount = await targetCard.count();

	if (targetCardCount === 0) {
		console.log(`   ⚠️  未找到"${targetNotebook}"卡片，使用第一个卡片代替`);
		const firstCardName = cardData.cards[0]?.name || '';
		console.log(`   使用第一个卡片: "${firstCardName}"`);
		await targetCard.first().click();
	} else {
		console.log(`   找到"${targetNotebook}"卡片，点击进入...`);
		await targetCard.click();
	}

	await page.waitForLoadState('networkidle');
	await delay(2000);

	const currentUrl = page.url();
	console.log(`   当前URL: ${currentUrl}`);

	const hasNameParam = currentUrl.includes('name=');
	console.log(`   URL包含name参数: ${hasNameParam ? '✅' : '❌'}`);

	const entriesLoaded = await waitForEntries(page, 10000);
	console.log(`   笔记列表加载: ${entriesLoaded ? '✅' : '❌'}`);
	await delay(1000);

	results.test4_consoleErrors.detailPage = [...listPageErrors].slice(results.test4_consoleErrors.listPage.length);

	const entryData = await page.evaluate(() => {
		const entries = document.querySelectorAll('.notebook-entry');
		const entryResults = [];
		entries.forEach((entry, i) => {
			const rect = entry.getBoundingClientRect();
			const bg = window.getComputedStyle(entry).backgroundImage;
			const title = entry.querySelector('.notebook-entry__title')?.textContent || '';
			const date = entry.querySelector('.notebook-entry__date')?.textContent || '';
			entryResults.push({
				index: i,
				title: title,
				date: date,
				width: Math.round(rect.width),
				height: Math.round(rect.height),
				ratio: (rect.width / rect.height).toFixed(3),
				hasRealBg: bg.indexOf('notebook-bg/bg-') > -1,
				isExpanded: entry.classList.contains('is-expanded'),
			});
		});
		const countText = document.querySelector('#notebook-detail-count')?.textContent || '';
		const loadingVisible = document.getElementById('notebook-loading')?.style.display !== 'none';
		const emptyVisible = document.getElementById('notebook-empty')?.style.display === 'flex';
		return { count: entries.length, entries: entryResults, countText, loadingVisible, emptyVisible };
	});

	results.test2_detailPage = {
		url: currentUrl,
		hasNameParam,
		...entryData,
	};

	console.log(`   笔记数量: ${entryData.count} (${entryData.countText})`);
	if (entryData.loadingVisible) console.log('   ⚠️  加载中状态仍可见');
	if (entryData.emptyVisible) console.log('   ⚠️  空状态可见');

	entryData.entries.forEach((e) => {
		console.log(`   - [${e.index}] ${e.title} | 日期: ${e.date} | 比例: ${e.ratio} | 真实背景: ${e.hasRealBg ? '✅' : '❌'}`);
	});

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-notebook-detail-before-expand.png'), fullPage: true });
	console.log('   截图已保存: 02-notebook-detail-before-expand.png');

	let firstEntryExpanded = false;
	if (entryData.count > 0) {
		console.log('   点击第一篇笔记展开内容...');
		const firstEntry = page.locator('.notebook-entry').first();
		await firstEntry.click();
		await delay(500);

		firstEntryExpanded = await firstEntry.evaluate((el) => el.classList.contains('is-expanded'));
		console.log(`   笔记是否展开: ${firstEntryExpanded ? '✅' : '❌'}`);

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-notebook-detail-after-expand.png'), fullPage: true });
		console.log('   截图已保存: 03-notebook-detail-after-expand.png');
	} else {
		console.log('   ⚠️  没有笔记可展开，跳过展开测试');
	}

	results.test2_detailPage.firstEntryExpanded = firstEntryExpanded;
	console.log('');

	// ==================== 测试3：返回并测试另一个笔记本 ====================
	console.log('🔙 测试3：返回并测试另一个笔记本');

	console.log('   点击返回按钮...');
	const backBtn = page.locator('.notebook-back');
	await backBtn.click();
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 10000 });
	await delay(1000);

	console.log('   已返回列表页');

	const secondNotebook = '热血战斗番';
	console.log(`   点击"${secondNotebook}"卡片...`);

	const secondCard = page.locator('.notebook-card', { hasText: secondNotebook });
	const secondCardExists = await secondCard.count() > 0;

	if (secondCardExists) {
		await secondCard.click();
		await page.waitForLoadState('networkidle');
		await delay(2000);

		const secondEntriesLoaded = await waitForEntries(page, 10000);
		await delay(500);

		const secondDetailUrl = page.url();
		console.log(`   当前URL: ${secondDetailUrl}`);

		const secondEntryData = await page.evaluate(() => {
			const entries = document.querySelectorAll('.notebook-entry');
			const countText = document.querySelector('#notebook-detail-count')?.textContent || '';
			return { count: entries.length, countText };
		});

		results.test3_anotherNotebook = {
			notebookName: secondNotebook,
			url: secondDetailUrl,
			...secondEntryData,
		};

		console.log(`   笔记数量: ${secondEntryData.count} (${secondEntryData.countText})`);

		await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-notebook-second-detail.png'), fullPage: true });
		console.log('   截图已保存: 04-notebook-second-detail.png');
	} else {
		console.log(`   ⚠️  未找到"${secondNotebook}"卡片，跳过此测试`);
		results.test3_anotherNotebook = { error: `未找到"${secondNotebook}"卡片` };
	}

	console.log('');

	// ==================== 输出测试报告 ====================
	console.log('═══════════════════════════════════════════════');
	console.log('📊 测试报告汇总');
	console.log('═══════════════════════════════════════════════');

	console.log('\n📋 测试1：列表页展示');
	console.log(`  卡片总数: ${results.test1_listPage.count}`);
	console.log(`  卡片名称: ${results.test1_listPage.cards.map((c) => c.name).join(', ')}`);
	const allRatioCorrect = results.test1_listPage.cards.every((c) => Math.abs(parseFloat(c.ratio) - 1.778) < 0.1);
	console.log(`  比例正确(≈1.778): ${allRatioCorrect ? '✅' : '❌'}`);
	const allRealBg = results.test1_listPage.cards.every((c) => c.hasRealBg);
	console.log(`  背景图真实: ${allRealBg ? '✅' : '❌'}`);
	const expected6 = results.test1_listPage.count === 6;
	console.log(`  卡片数量为6: ${expected6 ? '✅' : '❌'}`);

	console.log('\n📖 测试2：详情页');
	console.log(`  URL有name参数: ${results.test2_detailPage.hasNameParam ? '✅' : '❌'}`);
	console.log(`  笔记数量: ${results.test2_detailPage.count}`);
	console.log(`  数量文本: ${results.test2_detailPage.countText}`);
	if (results.test2_detailPage.entries?.length > 0) {
		const entriesRatioCorrect = results.test2_detailPage.entries.every((e) => Math.abs(parseFloat(e.ratio) - 1.778) < 0.1);
		console.log(`  笔记比例正确: ${entriesRatioCorrect ? '✅' : '❌'}`);
		const entriesRealBg = results.test2_detailPage.entries.every((e) => e.hasRealBg);
		console.log(`  笔记背景图真实: ${entriesRealBg ? '✅' : '❌'}`);
	}
	console.log(`  笔记展开功能: ${results.test2_detailPage.firstEntryExpanded ? '✅' : '❌'}`);

	console.log('\n🔙 测试3：另一个笔记本');
	if (results.test3_anotherNotebook.error) {
		console.log(`  ${results.test3_anotherNotebook.error}`);
	} else {
		console.log(`  笔记本: ${results.test3_anotherNotebook.notebookName}`);
		console.log(`  笔记数量: ${results.test3_anotherNotebook.count}`);
		console.log(`  数量文本: ${results.test3_anotherNotebook.countText}`);
	}

	console.log('\n⚠️  测试4：控制台错误');
	console.log(`  列表页错误数: ${results.test4_consoleErrors.listPage.length}`);
	if (results.test4_consoleErrors.listPage.length > 0) {
		results.test4_consoleErrors.listPage.forEach((e) => console.log(`    - ${e.text}`));
	}
	console.log(`  详情页错误数: ${results.test4_consoleErrors.detailPage.length}`);
	if (results.test4_consoleErrors.detailPage.length > 0) {
		results.test4_consoleErrors.detailPage.forEach((e) => console.log(`    - ${e.text}`));
	}

	console.log('\n🖼️  截图保存位置:');
	console.log(`  ${SCREENSHOT_DIR}`);

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
