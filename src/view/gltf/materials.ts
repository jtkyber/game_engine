import { Vec4 } from 'wgpu-matrix';
import { ImageUsage } from '../../types/enums';

export default class GLTFMaterial {
	baseColorTexture: any = null; // Make texture, sampler and image classes
	baseColorFactor: Vec4 = new Float32Array([1, 1, 1, 1]);

	metallicRoughnessTexture: any = null;
	metallicFactor: number = 1;
	roughnessFactor: number = 1;

	paramBuffer: GPUBuffer = null;

	bindGroup: GPUBindGroup = null;

	constructor(
		baseColorFactor: Vec4,
		baseColorTexture: any,
		metallicFactor: number,
		roughnessFactor: number,
		metallicRoughnessTexture: any
	) {
		this.baseColorFactor = baseColorFactor;
		this.baseColorTexture = baseColorTexture;
		if (this.baseColorTexture) {
			this.baseColorTexture.setUsage(ImageUsage.BASE_COLOR);
		}

		this.metallicFactor = metallicFactor;
		this.roughnessFactor = roughnessFactor;
		this.metallicRoughnessTexture = metallicRoughnessTexture;
		if (this.metallicRoughnessTexture) {
			this.metallicRoughnessTexture.setUsage(ImageUsage.METALLIC_ROUGHNESS);
		}
	}

	upload(device: GPUDevice) {
		this.paramBuffer = device.createBuffer({
			label: 'Material Params Buffer',
			// We'll be passing 6 floats, which round up to 8 in UBO alignment
			size: 8 * 4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
			mappedAtCreation: true,
		});

		// Upload the factor params
		{
			const params = new Float32Array(this.paramBuffer.getMappedRange());
			params.set(this.baseColorFactor, 0);
			params.set([this.metallicFactor, this.roughnessFactor], 4);
		}
		this.paramBuffer.unmap();
	}
}
