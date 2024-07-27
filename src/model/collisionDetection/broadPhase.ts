import { Vec2, vec2 } from 'wgpu-matrix';
import { IModelNodeChunks } from '../../types/gltf';
import { AABBResultPair, IAABB } from '../../types/types';
import { nodes } from '../../view/gltf/loader';
import GLTFNode from '../../view/gltf/node';

export function broad_phase(modelNodeChunks: IModelNodeChunks): AABBResultPair[] {
	const modelIndices = modelNodeChunks.opaque.concat(modelNodeChunks.transparent);
	const passed: AABBResultPair[] = [];

	for (let i = 0; i < modelIndices.length - 1; i++) {
		const modelIndexChunk1 = modelIndices[i];
		const nodeIndex1: number = modelIndexChunk1.nodeIndex;
		const primIndex1: number = modelIndexChunk1.primitiveIndex;
		const node1: GLTFNode = nodes[nodeIndex1];
		if (!node1.mesh) continue;

		const AABB1: IAABB = node1.AABBs[primIndex1];

		for (let j = i + 1; j < modelIndices.length; j++) {
			const modelIndexChunk2 = modelIndices[j];
			const nodeIndex2: number = modelIndexChunk2.nodeIndex;
			const primIndex2: number = modelIndexChunk2.primitiveIndex;
			const node2: GLTFNode = nodes[nodeIndex2];
			if (!node2.mesh || nodeIndex1 === nodeIndex2) continue;

			const AABB2: IAABB = node2.AABBs[primIndex2];

			if (intersecting(AABB1, AABB2)) {
				passed.push({
					nodeIndices: vec2.create(nodeIndex1, nodeIndex2),
					primIndices: vec2.create(primIndex1, primIndex2),
				});
			}
		}
	}

	return passed;
}

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
