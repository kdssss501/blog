export const MOBILE_REMOVAL_WIDTH = 768;
export const DESKTOP_MEDIA_QUERY = `(min-width: ${MOBILE_REMOVAL_WIDTH + 1}px)`;
export const DISPLAY_MIN_SCROLL_VIEWPORTS = 4;
export const CINEMATIC_DISTANCE_RATIO = 0.46;
export const CINEMATIC_MIN_SCROLL_VIEWPORTS = 4.5;
export const CINEMATIC_MAX_SCROLL_VIEWPORTS = 6;

/**
 * 计算展示层 pin 的滚动距离。
 * 取配置值与「最小视口倍数」中的较大者，确保动画有足够展开空间。
 */
export function getDisplayPinEndDistance(
	configuredDistance,
	viewportHeight,
	minViewportMultiplier = DISPLAY_MIN_SCROLL_VIEWPORTS,
) {
	const configured = Number(configuredDistance);
	const viewport = Number(viewportHeight);
	const fallback = Math.round(
		(Number.isFinite(viewport) && viewport > 0 ? viewport : 0) *
			minViewportMultiplier,
	);

	return Math.max(Number.isFinite(configured) ? configured : 0, fallback);
}

/**
 * 将展示层与百叶窗的配置距离合并成一次紧凑的电影式滚动。
 * 配置值仍决定相对长度，同时用视口上下限避免超长黑场或过快跳帧。
 */
export function getHomeCinematicScrollDistance(
	displayDistance,
	shutterDistance,
	viewportHeight,
	ratio = CINEMATIC_DISTANCE_RATIO,
	minViewportMultiplier = CINEMATIC_MIN_SCROLL_VIEWPORTS,
	maxViewportMultiplier = CINEMATIC_MAX_SCROLL_VIEWPORTS,
) {
	const normalize = (value) => {
		const number = Number(value);
		return Number.isFinite(number) && number > 0 ? number : 0;
	};
	const configuredTotal =
		normalize(displayDistance) + normalize(shutterDistance);
	const scaledDistance = Math.round(configuredTotal * normalize(ratio));
	const viewport = normalize(viewportHeight);

	if (viewport === 0) return scaledDistance;

	const minimum = Math.round(viewport * normalize(minViewportMultiplier));
	const requestedMaximum = Math.round(
		viewport * normalize(maxViewportMultiplier),
	);
	const maximum = Math.max(minimum, requestedMaximum);

	return Math.min(Math.max(scaledDistance, minimum), maximum);
}
