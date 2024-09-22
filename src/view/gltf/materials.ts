import { Vec3, Vec4 } from 'wgpu-matrix';
import { ImageUsage } from '../../types/enums';
import BindGroupLayouts from '../bindGroupLayouts';
import { GLTFTexture } from './texture';

export default class GLTFMaterial {
	name: string;

	baseColorTextureView: GLTFTexture = null;
	baseColorFactor: Vec4 = new Float32Array([1, 1, 1, 1]);

	metallicRoughnessTextureView: GLTFTexture = null;
	metallicFactor: number = 1;
	roughnessFactor: number = 1;

	normalTextureView: GLTFTexture = null;

	emissiveFactor: Vec3 = new Float32Array([0, 0, 0]);

	isTransparent: boolean = false;

	bindGroup: GPUBindGroup = null;

	constructor(
		name: string,
		baseColorFactor: Vec4,
		baseColorTextureView: GLTFTexture,
		metallicFactor: number,
		roughnessFactor: number,
		metallicRoughnessTextureView: GLTFTexture,
		normalTextureView: GLTFTexture,
		emissiveFactor: Vec3,
		isTransparent: boolean
	) {
		this.name = name;
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

		this.normalTextureView = normalTextureView;
		if (this.normalTextureView) {
			this.normalTextureView.setUsage(ImageUsage.NORMAL);
		}

		this.emissiveFactor = emissiveFactor;

		if (isTransparent) this.isTransparent = isTransparent;
	}

	upload(device: GPUDevice, bindGroupLayouts: BindGroupLayouts) {
		const paramBuffer = device.createBuffer({
			label: 'Material Params Buffer',
			// We'll be passing 6 floats, which round up to 8 in UBO alignment
			size: 12 * 4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
			mappedAtCreation: true,
		});

		// Upload the factor params
		{
			const params = new Float32Array(paramBuffer.getMappedRange());
			params.set(this.baseColorFactor, 0);
			params.set([this.metallicFactor, this.roughnessFactor], 4);
			params.set(this.emissiveFactor, 8);
		}
		paramBuffer.unmap();

		const defaultSampler: GPUSampler = device.createSampler({
			label: 'Default Sampler',
			magFilter: 'linear',
			minFilter: 'nearest',
			addressModeU: 'repeat',
			addressModeV: 'repeat',
			// mipmapFilter: 'nearest',
		});

		const texture = device.createTexture({
			label: 'Default Texture',
			size: { width: 1, height: 1 },
			format: 'rgba8unorm-srgb',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		});

		const defaultTextureView: GPUTextureView = texture.createView({
			format: 'rgba8unorm-srgb',
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

		let normalSampler: GPUSampler = this.normalTextureView?.sampler?.sampler;
		if (!normalSampler) normalSampler = defaultSampler;

		let normalTextureView: GPUTextureView = this.normalTextureView?.image?.view;
		if (!normalTextureView) normalTextureView = defaultTextureView;

		this.bindGroup = device.createBindGroup({
			label: 'Material Bind Group',
			layout: bindGroupLayouts.materialBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: paramBuffer,
						size: 12 * 4,
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
				{
					binding: 5,
					resource: normalSampler,
				},
				{
					binding: 6,
					resource: normalTextureView,
				},
			],
		});
	}
}
