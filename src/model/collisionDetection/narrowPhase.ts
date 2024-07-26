import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix';
import { AABBResultPair, IOBB } from '../../types/types';
import { nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

export function narrow_phase(pairs: AABBResultPair[]) {
	pairLoop: for (let pair of pairs) {
		const node1: GLTFNode = nodes[pair.nodeIndices[0]];
		const node2: GLTFNode = nodes[pair.nodeIndices[1]];

		const OBB1: IOBB = node1.OBBs[pair.primIndices[0]];
		const OBB2: IOBB = node2.OBBs[pair.primIndices[1]];

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

function offset_nodes(offsetVector: Vec3, node1: GLTFNode, node2: GLTFNode) {
	if (node1.name === 'Player') {
		node1.position = vec3.add(node1.position, offsetVector);
	} else if (node2.name === 'Player') {
		node2.position = vec3.add(node2.position, offsetVector);
	}
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
