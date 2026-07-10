const MIN_COPIES = 2;
const COPY_HEADROOM = 2;

export function getLoopCopyCount({ viewportSize, sequenceSize }) {
	if (!sequenceSize || sequenceSize <= 0) return MIN_COPIES;
	return Math.max(
		MIN_COPIES,
		Math.ceil(viewportSize / sequenceSize) + COPY_HEADROOM,
	);
}

export function wrapLoopOffset(offset, sequenceSize) {
	if (!sequenceSize || sequenceSize <= 0) return 0;
	return ((offset % sequenceSize) + sequenceSize) % sequenceSize;
}

export function resolveTargetVelocity({ speed, direction }) {
	const magnitude = Math.abs(speed);
	const isVertical = direction === "up" || direction === "down";
	const directionMultiplier = isVertical
		? direction === "up"
			? 1
			: -1
		: direction === "left"
			? 1
			: -1;
	const speedMultiplier = speed < 0 ? -1 : 1;
	return magnitude * directionMultiplier * speedMultiplier;
}

export function getClampedTooltipAnchor({
	clientX,
	clientY,
	viewportWidth,
	viewportHeight,
	margin = 56,
}) {
	const maxX = Math.max(margin, viewportWidth - margin);
	const maxY = Math.max(margin, viewportHeight - margin);
	return {
		x: Math.min(Math.max(clientX, margin), maxX),
		y: Math.min(Math.max(clientY, margin), maxY),
	};
}
