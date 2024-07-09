import { Vec3 } from 'wgpu-matrix';
import { IGLTFAccessor } from '../../types/gltf';
import { gltfTypeSize, gltfVertexType, parseGltfType } from '../../utils/gltf';
import GLTFBufferView from './bufferView';

export default class GLTFAccessor {
	bufferView: GLTFBufferView;
	count: number;
	componentType: number;
	gltfType: number;
	byteOffset: number;
	min: Vec3 = null;
	max: Vec3 = null;

	constructor(view: GLTFBufferView, accessor: IGLTFAccessor) {
		this.bufferView = view;
		this.count = accessor['count'];
		this.componentType = accessor['componentType'];
		this.gltfType = parseGltfType(accessor['type']);
		this.byteOffset = 0;
		if (accessor['min'] && accessor['max']) {
			this.min = accessor['min'];
			this.max = accessor['max'];
		}
		if (accessor['byteOffset'] !== undefined) {
			this.byteOffset = accessor['byteOffset'];
		}
	}

	get byteStride(): number {
		const elementSize: number = gltfTypeSize(this.componentType, this.gltfType);
		return Math.max(elementSize, this.bufferView.byteStride);
	}

	get byteLength() {
		return this.count * this.byteStride;
	}

	// Get the vertex attribute type for accessors that are used as vertex attributes
	get elementType(): string {
		return gltfVertexType(this.componentType, this.gltfType);
	}
}
