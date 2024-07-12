import { Mat4, Vec3, Vec4 } from 'wgpu-matrix';
import { GLTFTextureFilter, GLTFTextureWrap } from './enums';

export interface IGLTFNode {
	name: string;
	mesh: number;
	children?: number[];
	rotation?: Vec4;
	scale?: Vec3;
	translation?: Vec3;
	matrix?: Mat4;
	camera?: number;
	extensions?: { [key: string]: any };
}

export interface IGLTFMesh {
	name: string;
	primitives: IGLTFPrimitive[];
}

export interface IGLTFPrimitive {
	mode?: number;
	attributes: IGLTFAttributes;
	indices?: number;
	material?: number;
}

export interface IGLTFAttributes {
	NORMAL: number;
	POSITION: number;
	TEXTCOORD_0?: number;
	COLOR_0?: number;
}

export interface IGLTFBufferView {
	buffer: number;
	byteOffset: number;
	byteLength: number;
	byteStride?: number;
	target?: number;
}

export interface IGLTFAccessor {
	bufferView: number;
	byteOffset?: number;
	type: string;
	componentType: number;
	count: number;
	min?: Vec3;
	max?: Vec3;
}

export interface IGLTFImage {
	bufferView: number;
	mimeType: string;
	name: string;
}

export function gltfTextureFilterMode(filter: GLTFTextureFilter) {
	switch (filter) {
		case GLTFTextureFilter.NEAREST_MIPMAP_NEAREST:
		case GLTFTextureFilter.NEAREST_MIPMAP_LINEAR:
		case GLTFTextureFilter.NEAREST:
			return 'nearest' as GPUFilterMode;
		case GLTFTextureFilter.LINEAR_MIPMAP_NEAREST:
		case GLTFTextureFilter.LINEAR_MIPMAP_LINEAR:
		case GLTFTextureFilter.LINEAR:
			return 'linear' as GPUFilterMode;
	}
}

export function gltfTextureMipMapMode(filter: GLTFTextureFilter) {
	switch (filter) {
		case GLTFTextureFilter.NEAREST_MIPMAP_NEAREST:
		case GLTFTextureFilter.LINEAR_MIPMAP_NEAREST:
		case GLTFTextureFilter.NEAREST:
			return 'nearest' as GPUMipmapFilterMode;
		case GLTFTextureFilter.LINEAR_MIPMAP_LINEAR:
		case GLTFTextureFilter.NEAREST_MIPMAP_LINEAR:
		case GLTFTextureFilter.LINEAR:
			return 'linear' as GPUMipmapFilterMode;
	}
}

export function gltfAddressMode(mode: GLTFTextureWrap) {
	switch (mode) {
		case GLTFTextureWrap.REPEAT:
			return 'repeat' as GPUAddressMode;
		case GLTFTextureWrap.CLAMP_TO_EDGE:
			return 'clamp-to-edge' as GPUAddressMode;
		case GLTFTextureWrap.MIRRORED_REPEAT:
			return 'mirror-repeat' as GPUAddressMode;
	}
}
