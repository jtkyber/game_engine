import { vec4, Vec4 } from 'wgpu-matrix';
import BindGroupLayouts from '../bindGroupLayouts';
import GLTFMaterial from './materials';

export default class GLTFTerrainMaterial {
	materials: GLTFMaterial[];
	bindGroup: GPUBindGroup;

	constructor(materials: GLTFMaterial[]) {
		this.materials = materials;
	}

	setMaterials(device: GPUDevice, bindGroupLayouts: BindGroupLayouts) {
		const imgSize = {
			width: this.materials[0].baseColorTextureView?.image?.bitmap.width,
			height: this.materials[0].baseColorTextureView?.image?.bitmap.height,
		};

		const baseColorTextureArray = device.createTexture({
			size: [imgSize.width, imgSize.height, this.materials.length],
			format: 'rgba8unorm-srgb',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
		});

		const metallicRoughnessTextureArray = device.createTexture({
			size: [imgSize.width, imgSize.height, this.materials.length],
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
		});

		let baseColorTextureView: GPUTextureView = baseColorTextureArray.createView({
			format: 'rgba8unorm-srgb',
			dimension: '2d-array',
			aspect: 'all',
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: this.materials.length,
		});

		let metallicRoughnessTextureView: GPUTextureView = metallicRoughnessTextureArray.createView({
			format: 'rgba8unorm',
			dimension: '2d-array',
			aspect: 'all',
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: this.materials.length,
		});

		const materialIndices: Vec4 = vec4.create(-1, -1, -1, -1);

		const paramBuffer = device.createBuffer({
			label: 'Splat Material params buffer',
			size: 12 * 4 * this.materials.length,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
			mappedAtCreation: true,
		});
		const mappedRange = paramBuffer.getMappedRange();

		for (let i = 0; i < this.materials.length; i++) {
			const m: GLTFMaterial = this.materials[i];

			const params = new Float32Array(mappedRange);
			params.set(m.baseColorFactor, i * 12);
			params.set([m.metallicFactor, m.roughnessFactor], i * 12 + 4);
			params.set(m.emissiveFactor, i * 12 + 8);

			device.queue.copyExternalImageToTexture(
				{ source: m.baseColorTextureView.image.bitmap },
				{ texture: baseColorTextureArray, premultipliedAlpha: true, origin: { z: i } },
				imgSize
			);

			device.queue.copyExternalImageToTexture(
				{ source: m.metallicRoughnessTextureView.image.bitmap },
				{ texture: metallicRoughnessTextureArray, premultipliedAlpha: true, origin: { z: i } },
				imgSize
			);

			switch (m.name) {
				case 'Red':
					materialIndices[0] = i;
					break;
				case 'Green':
					materialIndices[1] = i;
					break;
				case 'Blue':
					materialIndices[2] = i;
					break;
				case 'Alpha':
					materialIndices[3] = i;
					break;
			}
		}

		paramBuffer.unmap();

		const materialIndicesBuffer = device.createBuffer({
			label: 'materialIndicesBuffer',
			size: 4 * 4,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
			mappedAtCreation: false,
		});
		device.queue.writeBuffer(materialIndicesBuffer, 0, materialIndices);

		const defaultSampler: GPUSampler = device.createSampler({
			label: 'Default Sampler',
			magFilter: 'linear',
			minFilter: 'nearest',
			addressModeU: 'repeat',
			addressModeV: 'repeat',
		});

		let baseColorSampler: GPUSampler = this.materials[0].baseColorTextureView?.sampler?.sampler;
		if (!baseColorSampler) baseColorSampler = defaultSampler;

		let metallicRoughnessSampler: GPUSampler =
			this.materials[0].metallicRoughnessTextureView?.sampler?.sampler;
		if (!metallicRoughnessSampler) metallicRoughnessSampler = defaultSampler;

		this.bindGroup = device.createBindGroup({
			label: 'Splat Material Bind Group',
			layout: bindGroupLayouts.splatMaterialBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: paramBuffer,
						size: 12 * 4 * this.materials.length,
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
					resource: {
						buffer: materialIndicesBuffer,
					},
				},
			],
		});
	}
}
