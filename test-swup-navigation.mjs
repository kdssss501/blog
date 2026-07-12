import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4321';
const SCREENSHOT_DIR = path.resolve('./notebook-swup-test-screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
	fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const results = {
	test1_listPage: {},
	test2_firstDetailPage: {},
	test3_secondDetailPage: {},
	consoleErrors: {
		listPage: [],
		firstDetail: [],
		secondDetail: [],
	},
	summary: {},
};

async function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getDetailPageState(page) {
	return await page.evaluate(() => {
		const list = document.getElementById('notebook-entry-list');
		const loading = document.getElementById('notebook-loading');
		const count = document.getElementById('notebook-detail-count');
		const entries = list ? list.querySelectorAll('.notebook-entry') : [];
		return JSON.stringify({
			listDisplay: list ? list.style.display : 'no element',
			loadingDisplay: loading ? loading.style.display : 'no element',
			countText: count ? count.textContent : 'no element',
			entryCount: entries.length,
		}, null, 2);
	});
}

async function runTests() {
	console.log('🚀 启动 Swup 导航测试...\n');

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
			console.log(`   [Console Error] ${msg.text()}`);
		}
	});

	// ==================== 测试1：列表页展示 ====================
	console.log('📋 步骤1-2：访问列表页，确认有6个笔记本卡片');
	console.log(`   访问 ${BASE_URL}/notebook/ ...`);

	await page.goto(`${BASE_URL}/notebook/`);
	await page.waitForLoadState('networkidle');
	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 30000 });
	await delay(2000);

	console.log('   页面加载完成，开始检查...');

	results.consoleErrors.listPage = [...allConsoleErrors];

	const cardData = await page.evaluate(() => {
		const cards = document.querySelectorAll('.notebook-card');
		const cardResults = [];
		cards.forEach((card, i) => {
			const name = card.querySelector('.notebook-card__name')?.textContent || '';
			const count = card.querySelector('.notebook-card__count')?.textContent || '';
			cardResults.push({ index: i, name, count });
		});
		return { count: cards.length, cards: cardResults };
	});

	results.test1_listPage = cardData;

	console.log(`   卡片数量: ${cardData.count}`);
	cardData.cards.forEach((c) => {
		console.log(`   - [${c.index}] ${c.name} (${c.count})`);
	});

	const has6Cards = cardData.count === 6;
	console.log(`   卡片数量为6: ${has6Cards ? '✅' : '❌'}`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-notebook-list.png'), fullPage: true });
	console.log('   截图已保存: 01-notebook-list.png\n');

	// ==================== 测试2：点击第一个卡片进入详情页 ====================
	console.log('📖 步骤3-6：点击第一个卡片，等待3秒，检查详情页');

	const firstCardName = cardData.cards[0]?.name || '';
	console.log(`   第一个卡片: "${firstCardName}"`);

	allConsoleErrors.length = 0;

	const firstCard = page.locator('.notebook-card').first();
	await firstCard.click();

	console.log('   已点击，等待3秒...');
	await delay(3000);

	const firstDetailUrl = page.url();
	console.log(`   当前URL: ${firstDetailUrl}`);

	results.consoleErrors.firstDetail = [...allConsoleErrors];

	const firstDetailState = await getDetailPageState(page);
	console.log('   详情页状态:');
	console.log(firstDetailState);

	const firstDetailStateObj = JSON.parse(firstDetailState);
	results.test2_firstDetailPage = {
		notebookName: firstCardName,
		url: firstDetailUrl,
		...firstDetailStateObj,
	};

	const firstHasEntries = firstDetailStateObj.entryCount >= 2;
	console.log(`   笔记数量>=2: ${firstHasEntries ? '✅' : '❌'}`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-first-detail-page.png'), fullPage: true });
	console.log('   截图已保存: 02-first-detail-page.png\n');

	// ==================== 测试3：返回列表页，点击另一个卡片 ====================
	console.log('🔙 步骤7-10：点击返回，再点击另一个卡片');

	console.log('   点击返回按钮...');
	const backBtn = page.locator('.notebook-back');
	await backBtn.click();

	await page.waitForSelector('#notebook-masonry', { state: 'visible', timeout: 10000 });
	await delay(1000);
	console.log('   已返回列表页');

	allConsoleErrors.length = 0;

	const secondNotebookName = '治愈日常番';
	console.log(`   寻找"${secondNotebookName}"卡片...`);

	const secondCard = page.locator('.notebook-card', { hasText: secondNotebookName });
	const secondCardCount = await secondCard.count();

	let actualSecondName = secondNotebookName;
	if (secondCardCount === 0) {
		console.log(`   未找到"${secondNotebookName}"，使用第二个卡片`);
		actualSecondName = cardData.cards[1]?.name || '';
		console.log(`   第二个卡片: "${actualSecondName}"`);
		await page.locator('.notebook-card').nth(1).click();
	} else {
		await secondCard.click();
	}

	console.log('   已点击，等待3秒...');
	await delay(3000);

	const secondDetailUrl = page.url();
	console.log(`   当前URL: ${secondDetailUrl}`);

	results.consoleErrors.secondDetail = [...allConsoleErrors];

	const secondDetailState = await getDetailPageState(page);
	console.log('   详情页状态:');
	console.log(secondDetailState);

	const secondDetailStateObj = JSON.parse(secondDetailState);
	results.test3_secondDetailPage = {
		notebookName: actualSecondName,
		url: secondDetailUrl,
		...secondDetailStateObj,
	};

	const secondHasEntries = secondDetailStateObj.entryCount >= 2;
	console.log(`   笔记数量>=2: ${secondHasEntries ? '✅' : '❌'}`);

	await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-second-detail-page.png'), fullPage: true });
	console.log('   截图已保存: 03-second-detail-page.png\n');

	// ==================== 输出测试报告 ====================
	console.log('═══════════════════════════════════════════════');
	console.log('📊 Swup 导航测试报告');
	console.log('═══════════════════════════════════════════════');

	console.log('\n📋 列表页:');
	console.log(`  卡片数量: ${cardData.count} ${has6Cards ? '✅' : '❌'}`);
	console.log(`  卡片名称: ${cardData.cards.map((c) => c.name).join(', ')}`);

	console.log('\n📖 第一个详情页:');
	console.log(`  笔记本: ${results.test2_firstDetailPage.notebookName}`);
	console.log(`  URL: ${results.test2_firstDetailPage.url}`);
	console.log(`  笔记数量: ${results.test2_firstDetailPage.entryCount}`);
	console.log(`  数量文本: ${results.test2_firstDetailPage.countText}`);
	console.log(`  列表显示: ${results.test2_firstDetailPage.listDisplay}`);
	console.log(`  加载显示: ${results.test2_firstDetailPage.loadingDisplay}`);
	console.log(`  正常显示笔记: ${firstHasEntries ? '✅' : '❌'}`);

	console.log('\n📖 第二个详情页:');
	console.log(`  笔记本: ${results.test3_secondDetailPage.notebookName}`);
	console.log(`  URL: ${results.test3_secondDetailPage.url}`);
	console.log(`  笔记数量: ${results.test3_secondDetailPage.entryCount}`);
	console.log(`  数量文本: ${results.test3_secondDetailPage.countText}`);
	console.log(`  列表显示: ${results.test3_secondDetailPage.listDisplay}`);
	console.log(`  加载显示: ${results.test3_secondDetailPage.loadingDisplay}`);
	console.log(`  正常显示笔记: ${secondHasEntries ? '✅' : '❌'}`);

	console.log('\n⚠️  控制台错误:');
	console.log(`  列表页错误数: ${results.consoleErrors.listPage.length}`);
	if (results.consoleErrors.listPage.length > 0) {
		results.consoleErrors.listPage.forEach((e) => console.log(`    - ${e.text}`));
	}
	console.log(`  第一个详情页错误数: ${results.consoleErrors.firstDetail.length}`);
	if (results.consoleErrors.firstDetail.length > 0) {
		results.consoleErrors.firstDetail.forEach((e) => console.log(`    - ${e.text}`));
	}
	console.log(`  第二个详情页错误数: ${results.consoleErrors.secondDetail.length}`);
	if (results.consoleErrors.secondDetail.length > 0) {
		results.consoleErrors.secondDetail.forEach((e) => console.log(`    - ${e.text}`));
	}

	const allPassed = has6Cards && firstHasEntries && secondHasEntries;
	results.summary = {
		has6Cards,
		firstDetailWorks: firstHasEntries,
		secondDetailWorks: secondHasEntries,
		totalConsoleErrors: results.consoleErrors.listPage.length + results.consoleErrors.firstDetail.length + results.consoleErrors.secondDetail.length,
		allPassed,
	};

	console.log('\n🎯 总结:');
	console.log(`  从列表页点击导航到详情页，笔记正常显示: ${firstHasEntries ? '✅ 是' : '❌ 否'}`);
	console.log(`  两次点击不同卡片都正常: ${firstHasEntries && secondHasEntries ? '✅ 是' : '❌ 否'}`);
	console.log(`  控制台错误总数: ${results.summary.totalConsoleErrors}`);
	console.log(`  整体测试结果: ${allPassed ? '✅ 通过' : '❌ 失败'}`);

	console.log('\n🖼️  截图保存位置:');
	console.log(`  ${SCREENSHOT_DIR}`);
	const screenshotFiles = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith('.png'));
	screenshotFiles.forEach((f) => console.log(`  - ${f}`));

	const reportPath = path.join(SCREENSHOT_DIR, 'swup-test-report.json');
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
