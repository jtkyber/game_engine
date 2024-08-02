import { Mat4, Vec3, Vec4 } from 'wgpu-matrix';
import Light from '../model/light';
import { GLTFComponentType, GLTFTextureFilter, GLTFTextureWrap, GLTFType } from './enums';

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
	skin: number;
	extras?: {
		mass?: number;
		speed?: number;
	};
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

export function typedArrayFromComponentType(componentType: GLTFComponentType) {
	switch (componentType) {
		case GLTFComponentType.BYTE:
			return Int8Array;
		case GLTFComponentType.UNSIGNED_BYTE:
			return Uint8Array;
		case GLTFComponentType.SHORT:
			return Int16Array;
		case GLTFComponentType.UNSIGNED_SHORT:
			return Uint16Array;
		case GLTFComponentType.INT:
			return Int32Array;
		case GLTFComponentType.UNSIGNED_INT:
			return Uint32Array;
		case GLTFComponentType.FLOAT:
			return Float32Array;
		case GLTFComponentType.DOUBLE:
			return Float64Array;
	}
}

export function elementCountFromGLTFtype(type: GLTFType): number {
	switch (type) {
		case GLTFType.SCALAR:
			return 1;
		case GLTFType.VEC2:
			return 2;
		case GLTFType.VEC3:
			return 3;
		case GLTFType.VEC4:
			return 4;
		case GLTFType.MAT2:
			return 4;
		case GLTFType.MAT3:
			return 9;
		case GLTFType.MAT4:
			return 16;
	}
}

export interface IModelNodeChunks {
	opaque: IModelNodeIndices[];
	transparent: IModelNodeIndices[];
}

export interface IModelNodeIndices {
	nodeIndex: number;
	primitiveIndex: number;
}

export interface IGLTFScene {
	models: number[];
	player: number;
	lights: Light[];
	modelNodeChunks: IModelNodeChunks;
}

export interface IGLTFAnimationSampler {
	input: number;
	interpolation: string;
	output: number;
}

export interface IGLTFAnimationChannel {
	sampler: number;
	target: {
		node: number;
		path: string;
	};
}
