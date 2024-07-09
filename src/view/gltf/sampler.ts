import { GLTFTextureFilter, GLTFTextureWrap } from '../../types/enums';
import { gltfAddressMode, gltfTextureFilterMode } from '../../types/gltf';

export class GLTFSampler {
	magFilter: GPUFilterMode = 'linear';
	minFilter: GPUFilterMode = 'linear';

	wrapU: GPUAddressMode = 'repeat';
	wrapV: GPUAddressMode = 'repeat';

	sampler: GPUSampler;

	constructor(
		magFilter: GLTFTextureFilter,
		minFilter: GLTFTextureFilter,
		wrapU: GLTFTextureWrap,
		wrapV: GLTFTextureWrap
	) {
		this.magFilter = gltfTextureFilterMode(magFilter) || this.magFilter;
		this.minFilter = gltfTextureFilterMode(minFilter) || this.minFilter;

		this.wrapU = gltfAddressMode(wrapU) || this.wrapU;
		this.wrapV = gltfAddressMode(wrapV) || this.wrapV;
	}

	// Create the GPU sampler
	create(device: GPUDevice) {
		this.sampler = device.createSampler({
			label: 'Sampler',
			magFilter: this.magFilter,
			minFilter: this.minFilter,
			addressModeU: this.wrapU,
			addressModeV: this.wrapV,
			// mipmapFilter: 'nearest',
		});
	}
}
