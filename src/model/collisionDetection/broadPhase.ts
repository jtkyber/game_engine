import { vec2 } from 'wgpu-matrix';
import { AABBResultPair } from '../../types/types';
import { models, nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

export function broad_phase(): AABBResultPair[] {
	const passed: AABBResultPair[] = [];

	for (let i = 0; i < models.length - 1; i++) {
		const nodeIndex1: number = models[i];
		const node1: GLTFNode = nodes[nodeIndex1];
		if (!node1.hasBoundingBox) continue;

		for (let j = i + 1; j < models.length; j++) {
			const nodeIndex2: number = models[j];
			const node2: GLTFNode = nodes[nodeIndex2];

			const sameRoot: boolean = node1.rootNode === node2.rootNode && node1.rootNode !== null;
			if (!node2.hasBoundingBox || nodeIndex1 === nodeIndex2 || sameRoot) continue;

			if (intersecting(node1, node2)) {
				passed.push(vec2.create(nodeIndex1, nodeIndex2));
			}
		}
	}

	return passed;
}

function intersecting(a: GLTFNode, b: GLTFNode): boolean {
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

// function intersecting(a: GLTFNode, b: GLTFNode): boolean {
// 	const moveVecA: Vec3 = vec3.sub(a.position, a.previousPosition);
// 	const moveVecB: Vec3 = vec3.sub(b.position, b.previousPosition);

// 	for (let i = 4; i > 0; i--) {
// 		const currentMinA: Vec3 = vec3.sub(a.min, vec3.mulScalar(moveVecA, (i - 1) / 4));
// 		const currentMinB: Vec3 = vec3.sub(b.min, vec3.mulScalar(moveVecB, (i - 1) / 4));
// 		const currentMaxA: Vec3 = vec3.sub(a.max, vec3.mulScalar(moveVecA, (i - 1) / 4));
// 		const currentMaxB: Vec3 = vec3.sub(b.max, vec3.mulScalar(moveVecB, (i - 1) / 4));

// 		if (
// 			currentMinA[0] <= currentMaxB[0] &&
// 			currentMaxA[0] >= currentMinB[0] &&
// 			currentMinA[1] <= currentMaxB[1] &&
// 			currentMaxA[1] >= currentMinB[1] &&
// 			currentMinA[2] <= currentMaxB[2] &&
// 			currentMaxA[2] >= currentMinB[2]
// 		) {
// 			// if (i < 4) console.log(i);
// 			return true;
// 		}
// 	}
// 	return false;
// }
