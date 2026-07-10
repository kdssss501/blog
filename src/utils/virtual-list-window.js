/**
 * Calculates the visible item window for a virtual list that scrolls with the page.
 *
 * @param {{
 *   itemCount: number;
 *   itemHeight: number;
 *   scrollY: number;
 *   viewportHeight: number;
 *   containerTop: number;
 *   overscan?: number;
 * }} input
 */
export function getVirtualWindow(input) {
	const itemCount = Math.max(0, Math.floor(input.itemCount));
	const itemHeight = Math.max(1, input.itemHeight);
	const overscan = Math.max(0, Math.floor(input.overscan ?? 3));
	const totalHeight = itemCount * itemHeight;

	if (itemCount === 0) {
		return {
			start: 0,
			end: 0,
			paddingTop: 0,
			paddingBottom: 0,
			totalHeight: 0,
		};
	}

	const scrollTop = Math.max(0, input.scrollY - input.containerTop);
	const scrollBottom = Math.max(
		0,
		input.scrollY + input.viewportHeight - input.containerTop,
	);
	const visibleStart = Math.floor(scrollTop / itemHeight);
	const visibleEnd = Math.ceil(scrollBottom / itemHeight);
	const start = Math.max(0, Math.min(itemCount, visibleStart - overscan));
	const minWindowSize = Math.min(itemCount, Math.max(1, overscan));
	const end = Math.min(
		itemCount,
		Math.max(start + minWindowSize, visibleEnd + overscan),
	);

	return {
		start,
		end,
		paddingTop: start * itemHeight,
		paddingBottom: (itemCount - end) * itemHeight,
		totalHeight,
	};
}

/**
 * Calculates a page-scroll virtual window for fixed-height grid rows.
 *
 * @param {VirtualGridWindowInput} input
 */
export function getVirtualGridWindow(input) {
	const itemCount = Math.max(0, Math.floor(input.itemCount));
	const columnCount = Math.max(1, Math.floor(input.columnCount));
	const rowCount = Math.ceil(itemCount / columnCount);
	const rowWindow = getVirtualWindow({
		itemCount: rowCount,
		itemHeight: input.rowHeight,
		scrollY: input.scrollY,
		viewportHeight: input.viewportHeight,
		containerTop: input.containerTop,
		overscan: input.overscan,
	});

	return {
		...rowWindow,
		rowCount,
		columnCount,
		startIndex: Math.min(itemCount, rowWindow.start * columnCount),
		endIndex: Math.min(itemCount, rowWindow.end * columnCount),
	};
}
