import { GLTFRenderMode } from '../../types/enums';
import GLTFAccessor from './accessor';
import GLTFMaterial from './materials';

export default class GLTFPrimitive {
	material: GLTFMaterial = null;
	indices: GLTFAccessor = null;
	positions: GLTFAccessor = null;
	normals: GLTFAccessor = null;
	colors: GLTFAccessor = null;
	texCoords: GLTFAccessor = null;
	joints: GLTFAccessor = null;
	weights: GLTFAccessor = null;
	topology: GLTFRenderMode = null;

	constructor(
		material: GLTFMaterial,
		indices: GLTFAccessor,
		positions: GLTFAccessor,
		normals: GLTFAccessor,
		colors: GLTFAccessor,
		texCoords: GLTFAccessor,
		joints: GLTFAccessor,
		weights: GLTFAccessor,
		topology: GLTFRenderMode
	) {
		this.material = material;
		this.indices = indices;
		this.positions = positions;
		this.normals = normals;
		this.colors = colors;
		this.texCoords = texCoords;
		this.joints = joints;
		this.weights = weights;
		this.topology = topology;

		this.positions.bufferView.needsUpload = true;
		this.positions.bufferView.addUsage(GPUBufferUsage.VERTEX);

		this.normals.bufferView.needsUpload = true;
		this.normals.bufferView.addUsage(GPUBufferUsage.VERTEX);

		if (this.indices) {
			this.indices.bufferView.needsUpload = true;
			this.indices.bufferView.addUsage(GPUBufferUsage.INDEX);
		}

		if (this.texCoords) {
			this.texCoords.bufferView.needsUpload = true;
			this.texCoords.bufferView.addUsage(GPUBufferUsage.VERTEX);
		}

		if (this.joints) {
			this.joints.bufferView.needsUpload = true;
			this.joints.bufferView.addUsage(GPUBufferUsage.VERTEX);
		}

		if (this.weights) {
			this.weights.bufferView.needsUpload = true;
			this.weights.bufferView.addUsage(GPUBufferUsage.VERTEX);
		}

		if (this.colors) {
			this.colors.bufferView.needsUpload = true;
			this.colors.bufferView.addUsage(GPUBufferUsage.VERTEX);
		}
	}
}
