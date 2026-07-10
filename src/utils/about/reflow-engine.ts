/**
 * 弹跳球物理引擎 + 文字排斥区域计算
 * 用于 About 页面的 Canvas 3D 文字重排效果
 */

// ===== 类型 =====

export interface BallState {
	x: number;
	y: number;
	vx: number;
	vy: number;
	radius: number;
}

export interface PhysicsConfig {
	/** 摩擦系数，每帧速度衰减 (0-1)，越大越快停下 */
	friction: number;
	/** 墙壁反弹系数 (0-1)，越大弹得越高 */
	restitution: number;
	/** 速度低于此阈值时归零 */
	sleepThreshold: number;
	/** 重力加速度（可选，0 = 无重力） */
	gravity: number;
}

export interface DragState {
	isDragging: boolean;
	startX: number;
	startY: number;
	lastX: number;
	lastY: number;
	lastTime: number;
	velX: number;
	velY: number;
}

export interface LineExclusion {
	hasExclusion: boolean;
	/** 排斥区域左边缘 x */
	exclusionLeft: number;
	/** 排斥区域右边缘 x */
	exclusionRight: number;
}

// ===== 默认物理参数 =====

const DEFAULT_PHYSICS: PhysicsConfig = {
	friction: 0.008,
	restitution: 0.65,
	sleepThreshold: 0.3,
	gravity: 0,
};

// ===== 球初始化 =====

export function createBall(
	radius: number,
	containerW: number,
	containerH: number,
): BallState {
	return {
		x: radius + 20,
		y: radius + 20,
		vx: containerW * 0.004,
		vy: containerH * 0.003,
		radius,
	};
}

// ===== 物理步进 =====

export function stepPhysics(
	ball: BallState,
	dt: number,
	containerW: number,
	containerH: number,
	config: PhysicsConfig = DEFAULT_PHYSICS,
): BallState {
	let { x, y, vx, vy, radius } = ball;

	// 重力
	vy += config.gravity * dt;

	// 摩擦衰减
	const frictionMul = 1 - config.friction;
	vx *= frictionMul;
	vy *= frictionMul;

	// 位置更新
	x += vx * dt;
	y += vy * dt;

	// 墙壁碰撞
	if (x - radius < 0) {
		x = radius;
		vx = Math.abs(vx) * config.restitution;
	}
	if (x + radius > containerW) {
		x = containerW - radius;
		vx = -Math.abs(vx) * config.restitution;
	}
	if (y - radius < 0) {
		y = radius;
		vy = Math.abs(vy) * config.restitution;
	}
	if (y + radius > containerH) {
		y = containerH - radius;
		vy = -Math.abs(vy) * config.restitution;
	}

	// 休眠检测
	if (Math.abs(vx) < config.sleepThreshold) vx = 0;
	if (Math.abs(vy) < config.sleepThreshold) vy = 0;

	return { x, y, vx, vy, radius };
}

// ===== 拖拽 =====

export function createDragState(): DragState {
	return {
		isDragging: false,
		startX: 0,
		startY: 0,
		lastX: 0,
		lastY: 0,
		lastTime: 0,
		velX: 0,
		velY: 0,
	};
}

export function updateDragVelocity(
	drag: DragState,
	x: number,
	y: number,
	now: number,
): DragState {
	const dt = Math.max(1, now - drag.lastTime);
	const velX = (x - drag.lastX) / dt;
	const velY = (y - drag.lastY) / dt;
	// 指数平滑
	return {
		...drag,
		lastX: x,
		lastY: y,
		lastTime: now,
		velX: drag.velX * 0.5 + velX * 0.5,
		velY: drag.velY * 0.5 + velY * 0.5,
	};
}

// ===== 排斥区域计算 =====

/**
 * 计算球形排斥区域对每一行文字的影响。
 * 返回每行是否有排斥、排斥的水平区间。
 */
export function computeLineExclusions(
	ball: BallState,
	lineCount: number,
	lineHeight: number,
	padding: number,
): LineExclusion[] {
	const result: LineExclusion[] = [];
	const { x, y, radius } = ball;

	for (let i = 0; i < lineCount; i++) {
		const lineY = padding + i * lineHeight + lineHeight / 2;
		const dy = Math.abs(lineY - y);

		if (dy >= radius + lineHeight * 0.3) {
			// 行完全在球的排斥范围外
			result.push({ hasExclusion: false, exclusionLeft: 0, exclusionRight: 0 });
		} else {
			// 计算球在该行占据的水平区间
			const halfChord = Math.sqrt(Math.max(0, radius * radius - dy * dy));
			const exLeft = Math.max(0, x - halfChord);
			const exRight = x + halfChord;

			if (halfChord > 0.5) {
				result.push({
					hasExclusion: true,
					exclusionLeft: exLeft,
					exclusionRight: exRight,
				});
			} else {
				result.push({
					hasExclusion: false,
					exclusionLeft: 0,
					exclusionRight: 0,
				});
			}
		}
	}

	return result;
}
