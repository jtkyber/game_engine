import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix';
import { globalToggles } from '../../control/app';
import { AABBResultPair, IOBB } from '../../types/types';
import { nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

let nodesAdjusted: boolean = true;

export function narrow_phase(pairs: AABBResultPair[]): boolean {
	nodesAdjusted = false;

	for (let pair of pairs) {
		const node1: GLTFNode = nodes[pair[0]];
		const node2: GLTFNode = nodes[pair[1]];

		if (
			vec3.dist(node1.position, node1.previousPosition) < 0.001 &&
			vec3.dist(node2.position, node2.previousPosition) < 0.001
		) {
			continue;
		}

		const OBB1: IOBB = node1.OBB;
		const OBB2: IOBB = node2.OBB;

		switch (globalToggles.collisionDetection) {
			case 'sat':
				sat(node1, node2, OBB1, OBB2);
				break;
			case 'satContinuous':
				sat_continous(node1, node2, OBB1, OBB2);
				break;
			default:
				return;
		}
	}

	return nodesAdjusted;
}

function sat(node1: GLTFNode, node2: GLTFNode, OBB1: IOBB, OBB2: IOBB) {
	const axes: Vec3[] = get_axes(OBB1, OBB2);
	let minOverlap = Infinity;
	let mtvAxis: Vec3 = null;

	for (let j = 0; j < axes.length; j++) {
		const axis: Vec3 = axes[j];

		const range1: Vec2 = get_min_max(OBB1.vertices, axis);
		const range2: Vec2 = get_min_max(OBB2.vertices, axis);

		if (!ranges_overlap(range1, range2)) {
			return;
		} else {
			let overlap = Math.min(range1[1], range2[1]) - Math.max(range1[0], range2[0]);
			if (overlap < minOverlap) {
				minOverlap = overlap;
				mtvAxis = axis;
			}
		}
	}

	const center1: Vec3 = get_center(OBB1.vertices);
	const center2: Vec3 = get_center(OBB2.vertices);

	const direction: Vec3 = vec3.sub(center2, center1);
	let offsetVector = vec3.scale(mtvAxis, minOverlap);
	if (vec3.dot(direction, offsetVector) > 0) {
		vec3.negate(offsetVector, offsetVector);
	}

	offset_nodes(offsetVector, node1, node2, node1.position, node2.position);
}

function sat_continous(node1: GLTFNode, node2: GLTFNode, OBB1: IOBB, OBB2: IOBB) {
	const moveVec1: Vec3 = vec3.sub(node1.position, node1.previousPosition);
	const moveVec2: Vec3 = vec3.sub(node2.position, node2.previousPosition);

	const sweepNum: number = Math.ceil(vec3.dist(moveVec1, moveVec2) * 4);
	// const sweepNum: number = 3;
	// step-size = bounding box size / (constant * |velocity|)

	sweepLoop: for (let i = sweepNum; i > 0; i--) {
		const stepRatio: number = (i - 1) / sweepNum;

		const vert1: Vec3[] = OBB1.vertices.map(v => vec3.sub(v, vec3.mulScalar(moveVec1, stepRatio)));
		const vert2: Vec3[] = OBB2.vertices.map(v => vec3.sub(v, vec3.mulScalar(moveVec2, stepRatio)));

		const axes: Vec3[] = get_axes(OBB1, OBB2);
		let minOverlap = Infinity;
		let mtvAxis: Vec3 = null;

		for (let j = 0; j < axes.length; j++) {
			const axis: Vec3 = axes[j];

			const range1: Vec2 = get_min_max(vert1, axis);
			const range2: Vec2 = get_min_max(vert2, axis);

			if (!ranges_overlap(range1, range2)) {
				if (i === 1) return;
				else continue sweepLoop;
			} else {
				let overlap = Math.min(range1[1], range2[1]) - Math.max(range1[0], range2[0]);
				if (overlap < minOverlap) {
					minOverlap = overlap;
					mtvAxis = axis;
				}
			}
		}

		const center1: Vec3 = get_center(vert1);
		const center2: Vec3 = get_center(vert2);

		const direction: Vec3 = vec3.sub(center2, center1);
		let offsetVector = vec3.scale(mtvAxis, minOverlap);
		if (vec3.dot(direction, offsetVector) > 0) {
			vec3.negate(offsetVector, offsetVector);
		}

		const MAX_MOVE_STEP = 0.1;

		let clampedMoveVec1 = vec3.scale(
			moveVec1,
			Math.min(stepRatio * globalToggles.fixedTimeStep, MAX_MOVE_STEP)
		);
		let clampedMoveVec2 = vec3.scale(
			moveVec2,
			Math.min(stepRatio * globalToggles.fixedTimeStep, MAX_MOVE_STEP)
		);

		let steppedPos1: Vec3 = vec3.sub(node1.position, clampedMoveVec1);
		let steppedPos2: Vec3 = vec3.sub(node2.position, clampedMoveVec2);

		offset_nodes(offsetVector, node1, node2, steppedPos1, steppedPos2);
		break sweepLoop;
	}
}

function offset_nodes(mtv: Vec3, node1: GLTFNode, node2: GLTFNode, node1Pos: Vec3, node2Pos: Vec3) {
	const velocityAlongMTV: number = get_relative_velocity_along_mtv(
		node1.currentVelocity,
		node2.currentVelocity,
		mtv
	);

	if (velocityAlongMTV === 0) return;

	const totalMass: number = node1.mass + node2.mass;

	let massFactor1: number = (1 - node1.mass) / totalMass;
	let massFactor2: number = (1 - node2.mass) / totalMass;

	let velocityFactor1 = Math.abs(vec3.dot(node1.currentVelocity, mtv)) / Math.abs(velocityAlongMTV);
	let velocityFactor2 = Math.abs(vec3.dot(node2.currentVelocity, mtv)) / Math.abs(velocityAlongMTV);

	if (node1.mass === null && node2.mass !== null) {
		massFactor1 = 0;
		massFactor2 = 1;
	} else if (node1.mass !== null && node2.mass === null) {
		massFactor1 = 1;
		massFactor2 = 0;
	} else if (node1.mass === null && node2.mass === null) {
		massFactor1 = 1;
		massFactor2 = 1;
	}

	const totalFactor = massFactor1 + velocityFactor1 + massFactor2 + velocityFactor2;

	const node1Proportion = (massFactor1 + velocityFactor1) / totalFactor;
	const node2Proportion = (massFactor2 + velocityFactor2) / totalFactor;

	let node1Offset = vec3.scale(mtv, node1Proportion);
	let node2Offset = vec3.scale(mtv, -node2Proportion);

	let playerNode: GLTFNode = null;
	let otherNode: GLTFNode = null;
	if (node1.name === 'Player') {
		playerNode = node1;
		otherNode = node2;
	} else if (node2.name === 'Player') {
		playerNode = node2;
		otherNode = node1;
	}

	let diff: number = 0;

	if (playerNode !== null) {
		const stepMax: number = (playerNode.AABB.max[1] - playerNode.AABB.min[1]) / 3;
		diff = otherNode.AABB.max[1] - playerNode.AABB.min[1];
		if (diff < stepMax && diff > 0) {
			// If within max step height
			node1Offset = vec3.create(0, node1.name === 'Player' ? diff : 0, 0);
			node2Offset = vec3.create(0, node2.name === 'Player' ? diff : 0, 0);

			playerNode.inAir = false;
		}
	}

	offset_root_position(node1, node1Offset, node1Pos);
	offset_root_position(node2, node2Offset, node2Pos);

	if (mtv[1] !== 0) {
		// If collision is on y-axis
		if (node1.currentVelocity[1] < node2.currentVelocity[1]) {
			node1.inAir = false;
			node1.reset_gravity();
		} else if (node2.currentVelocity[1] < node1.currentVelocity[1]) {
			node2.inAir = false;
			node2.reset_gravity();
		}
	}

	nodesAdjusted = true;
}

function offset_root_position(node: GLTFNode, offset: Vec3, pos: Vec3) {
	vec3.add(pos, offset, node.position);
}

function get_relative_velocity_along_mtv(v1: Vec3, v2: Vec3, mtv: Vec3): number {
	let relativeVelocity = vec3.sub(v1, v2);
	return vec3.dot(relativeVelocity, vec3.normalize(mtv));
}

function get_center(vertices: Vec3[]) {
	let sum: Vec3 = vec3.create(0, 0, 0);

	for (let v of vertices) {
		vec3.add(sum, v, sum);
	}

	return vec3.divScalar(sum, 8);
}

function ranges_overlap(range1: Vec2, range2: Vec2): boolean {
	return range1[1] >= range2[0] && range2[1] >= range1[0];
}

function get_min_max(vertices: Vec3[], axis: Vec3): Vec2 {
	let min = Infinity;
	let max = -Infinity;

	for (let vertex of vertices) {
		let projection = vec3.dot(vertex, axis);
		if (projection < min) min = projection;
		if (projection > max) max = projection;
	}

	return vec2.create(min, max);
}

function get_axes(OBB1: IOBB, OBB2: IOBB): Vec3[] {
	const axes: Vec3[] = [];

	for (let n of OBB1.normals) axes.push(n);
	for (let n of OBB2.normals) axes.push(n);

	for (let i = 0; i < 6; i++) {
		const norm1: Vec3 = OBB1.normals[i];
		for (let j = 0; j < 6; j++) {
			const norm2: Vec3 = OBB2.normals[j];
			const cross: Vec3 = vec3.normalize(vec3.cross(norm1, norm2));
			if (!zero_vector(cross)) axes.push(cross);
		}
	}

	return axes;
}

function zero_vector(v: Vec3) {
	return v[0] === 0 && v[1] === 0 && v[2] === 0;
}
