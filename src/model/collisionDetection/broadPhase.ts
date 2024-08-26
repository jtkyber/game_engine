import { vec2 } from 'wgpu-matrix';
import { AABBResultPair, IAABB } from '../../types/types';
import { models, nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

export function broad_phase(): AABBResultPair[] {
	const passed: AABBResultPair[] = [];

	for (let i = 0; i < models.length - 1; i++) {
		const nodeIndex1: number = models[i];
		const node1: GLTFNode = nodes[nodeIndex1];
		if (!node1.hasBoundingBox) continue;

		const AABB1: IAABB = node1.AABB;

		for (let j = i + 1; j < models.length; j++) {
			const nodeIndex2: number = models[j];
			const node2: GLTFNode = nodes[nodeIndex2];

			const sameRoot: boolean = node1.rootNode === node2.rootNode && node1.rootNode !== null;
			if (!node2.hasBoundingBox || nodeIndex1 === nodeIndex2 || sameRoot) continue;

			const AABB2: IAABB = node2.AABB;

			if (intersecting(AABB1, AABB2)) {
				passed.push(vec2.create(nodeIndex1, nodeIndex2));
			}
		}
	}

	return passed;
}

// function get_max_ys(passed: AABBResultPair[]) {
// 	const maxYs: any[][] = [];
// 	for (let i = 0; i < passed.length; i++) {
// 		const node1: GLTFNode = nodes[passed[i].nodeIndices[0]];
// 		const node2: GLTFNode = nodes[passed[i].nodeIndices[1]];

// 		const AABB1: IAABB = node1.AABBs[passed[i].primIndices[0]];
// 		const AABB2: IAABB = node2.AABBs[passed[i].primIndices[1]];

// 		maxYs.push([node1.name, node2.name, AABB1.max[1], AABB2.max[1]]);
// 	}
// 	return maxYs;
// }

function intersecting(a: IAABB, b: IAABB): boolean {
	if (
		a.min[0] <= b.max[0] &&
		a.max[0] >= b.min[0] &&
		a.min[1] <= b.max[1] &&
		a.max[1] >= b.min[1] &&
		a.min[2] <= b.max[2] &&
		a.max[2] >= b.min[2]
	) {
		return true;
	}
	return false;
}

// function get_sorted(passed: AABBResultPair[]) {
// 	for (let i = 0; i < passed.length; i++) {
// 		const passedNodeIndex1: number = passed[i].nodeIndices[0];
// 		const passedNodeIndex2: number = passed[i].nodeIndices[1];

// 		const passedPrimIndex1: number = passed[i].primIndices[0];
// 		const passedPrimIndex2: number = passed[i].primIndices[1];

// 		const node1: GLTFNode = nodes[passedNodeIndex1];
// 		const node2: GLTFNode = nodes[passedNodeIndex2];

// 		const AABB1: IAABB = node1.AABBs[passedPrimIndex1];
// 		const AABB2: IAABB = node2.AABBs[passedPrimIndex2];

// 		if (AABB1.max[1] > AABB2.max[1]) {
// 			passed[i].nodeIndices[0] = passedNodeIndex2;
// 			passed[i].nodeIndices[1] = passedNodeIndex1;

// 			passed[i].primIndices[0] = passedPrimIndex2;
// 			passed[i].primIndices[1] = passedPrimIndex1;
// 		}
// 	}

// 	return passed.sort((a, b) => {
// 		const node1: GLTFNode = nodes[a.nodeIndices[0]];
// 		const node2: GLTFNode = nodes[b.nodeIndices[0]];

// 		const AABB1: IAABB = node1.AABBs[a.primIndices[0]];
// 		const AABB2: IAABB = node2.AABBs[b.primIndices[0]];

// 		return AABB2.max[1] - AABB1.max[1];
// 	});
// }
