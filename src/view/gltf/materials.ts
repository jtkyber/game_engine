import { Vec4 } from 'wgpu-matrix';
import { ImageUsage } from '../../types/enums';

export default class GLTFMaterial {
	baseColorTextureView: any = null; // Make texture, sampler and image classes
	baseColorFactor: Vec4 = new Float32Array([1, 1, 1, 1]);

	metallicRoughnessTextureView: any = null;
	metallicFactor: number = 1;
	roughnessFactor: number = 1;

	paramBuffer: GPUBuffer = null;

	bindGroupLayout: GPUBindGroupLayout = null;
	bindGroup: GPUBindGroup = null;

	isTransparent: boolean = false;

	constructor(
		baseColorFactor: Vec4,
		baseColorTextureView: any,
		metallicFactor: number,
		roughnessFactor: number,
		metallicRoughnessTextureView: any,
		isTransparent: boolean
	) {
		this.baseColorFactor = baseColorFactor;
		this.baseColorTextureView = baseColorTextureView;
		if (this.baseColorTextureView) {
			this.baseColorTextureView.setUsage(ImageUsage.BASE_COLOR);
		}

		this.metallicFactor = metallicFactor;
		this.roughnessFactor = roughnessFactor;
		this.metallicRoughnessTextureView = metallicRoughnessTextureView;
		if (this.metallicRoughnessTextureView) {
			this.metallicRoughnessTextureView.setUsage(ImageUsage.METALLIC_ROUGHNESS);
		}

		if (isTransparent) this.isTransparent = isTransparent;
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

		this.bindGroupLayout = device.createBindGroupLayout({
			label: 'Material Bind Group Layout',
			entries: [
				{
					// Material Params
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
					},
				},
				{
					// Base Color Sampler
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {},
				},
				{
					// Base Color Texture
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {},
				},
				{
					// Metallic Roughness Sampler
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {},
				},
				{
					// Metallic Roughness Texture
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {},
				},
			],
		});

		const defaultSampler: GPUSampler = device.createSampler({
			label: 'Default Sampler',
			magFilter: 'linear',
			minFilter: 'nearest',
			addressModeU: 'repeat',
			addressModeV: 'repeat',
			// mipmapFilter: 'nearest',
		});

		let defaultTextureView: GPUTextureView;

		const texture = device.createTexture({
			label: 'Default Texture',
			size: { width: 1, height: 1 },
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		});

		defaultTextureView = texture.createView({
			format: 'rgba8unorm',
			dimension: '2d',
			aspect: 'all',
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: 1,
		});

		let baseColorSampler: GPUSampler = this.baseColorTextureView?.sampler?.sampler;
		if (!baseColorSampler) baseColorSampler = defaultSampler;

		let baseColorTextureView: GPUTextureView = this.baseColorTextureView?.image?.view;
		if (!baseColorTextureView) baseColorTextureView = defaultTextureView;

		let metallicRoughnessSampler: GPUSampler = this.metallicRoughnessTextureView?.sampler?.sampler;
		if (!metallicRoughnessSampler) metallicRoughnessSampler = defaultSampler;

		let metallicRoughnessTextureView: GPUTextureView = this.metallicRoughnessTextureView?.image?.view;
		if (!metallicRoughnessTextureView) metallicRoughnessTextureView = defaultTextureView;

		this.bindGroup = device.createBindGroup({
			label: 'Material Bind Group',
			layout: this.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.paramBuffer,
						size: 8 * 4,
					},
				},
				{
					binding: 1,
					resource: baseColorSampler,
				},
				{
					binding: 2,
					resource: baseColorTextureView,
				},
				{
					binding: 3,
					resource: metallicRoughnessSampler,
				},
				{
					binding: 4,
					resource: metallicRoughnessTextureView,
				},
			],
		});
	}
}
