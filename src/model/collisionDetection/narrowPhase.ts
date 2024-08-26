import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix';
import { AABBResultPair, IOBB } from '../../types/types';
import { nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

export function narrow_phase(pairs: AABBResultPair[]) {
	pairLoop: for (let pair of pairs) {
		const node1: GLTFNode = nodes[pair[0]];
		const node2: GLTFNode = nodes[pair[1]];

		const OBB1: IOBB = node1.OBB;
		const OBB2: IOBB = node2.OBB;

		const vert1: Vec3[] = OBB1.vertices;
		const vert2: Vec3[] = OBB2.vertices;

		const axes: Vec3[] = get_axes(OBB1, OBB2);
		let minOverlap = Infinity;
		let mtvAxis: Vec3 = null;

		for (let i = 0; i < axes.length; i++) {
			const axis: Vec3 = axes[i];

			const range1: Vec2 = get_min_max(vert1, axis);
			const range2: Vec2 = get_min_max(vert2, axis);

			if (!ranges_overlap(range1, range2)) {
				continue pairLoop;
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

		offset_nodes(offsetVector, node1, node2);
	}
}

function offset_nodes(mtv: Vec3, node1: GLTFNode, node2: GLTFNode) {
	const velocityAlongMTV: number = get_relative_velocity_along_mtv(
		node1.currentVelocity,
		node2.currentVelocity,
		mtv
	);

	if (velocityAlongMTV === 0) return;

	const totalMass: number = node1.mass + node2.mass;

	let massFactor1: number = (1 - node1.mass) / totalMass;
	let massFactor2: number = (1 - node2.mass) / totalMass;

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

	const velocityFactor1 = Math.abs(vec3.dot(node1.currentVelocity, mtv)) / Math.abs(velocityAlongMTV);
	const velocityFactor2 = Math.abs(vec3.dot(node2.currentVelocity, mtv)) / Math.abs(velocityAlongMTV);

	const totalFactor = massFactor1 + velocityFactor1 + massFactor2 + velocityFactor2;

	const node1Proportion = (massFactor1 + velocityFactor1) / totalFactor;
	const node2Proportion = (massFactor2 + velocityFactor2) / totalFactor;

	const node1Offset = vec3.scale(mtv, node1Proportion);
	const node2Offset = vec3.scale(mtv, -node2Proportion);

	node1.offset_root_position(node1Offset);
	node2.offset_root_position(node2Offset);

	if (mtv[1] !== 0) {
		if (node1.currentVelocity[1] < node2.currentVelocity[1]) {
			node1.reset_gravity();
		} else if (node2.currentVelocity[1] < node1.currentVelocity[1]) {
			node2.reset_gravity();
		}
	}
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
