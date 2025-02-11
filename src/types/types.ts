import { Vec2, Vec3, Vec4 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import GLTFAnimation from '../view/gltf/animation';
import { Flag } from './enums';

export interface Test {
	test: string;
}

declare global {
	interface Window {
		myLib: {
			deltaTime?: number;
		};
	}
}

export interface IRenderData {
	camera: Camera;
	nodeTransforms: Float32Array;
	normalTransforms: Float32Array;
	jointMatricesBufferList: GPUBuffer[];
	lightTypes: Float32Array;
	lightPositions: Float32Array;
	lightColors: Float32Array;
	lightIntensities: Float32Array;
	lightDirections: Float32Array;
	lightAngleData: Float32Array;
	lightViewProjMatrices: Float32Array;
	lightViewMatrices: Float32Array;
	inverseLightViewProjMatrices?: Float32Array;
	sunAboveHorizon: Float32Array;
}

export function getFlagType(name: string): Flag | null {
	switch (name) {
		case 'static':
			return Flag.STATIC;
		case 'moveableRoot':
			return Flag.MOVEABLE_ROOT;
		default:
			return null;
	}
}

export type MoveSignFB = -1 | 0 | 1;
export type MoveSignLR = -1 | 0 | 1;
export type MoveVec = [MoveSignFB, MoveSignLR];

export interface ControlBoard {
	f: ControlBoardValue;
	b: ControlBoardValue;
	l: ControlBoardValue;
	r: ControlBoardValue;
	space: ControlBoardValue;
	shift: ControlBoardValue;
}
export type ControlBoardValue = 0 | 1;

export interface IAnimations {
	[key: string]: GLTFAnimation;
}

export type TypedArray =
	| Int8Array
	| Uint8Array
	| Uint8ClampedArray
	| Int16Array
	| Uint16Array
	| Int32Array
	| Uint32Array
	| Float32Array
	| Float64Array;

export type TypedArrayConstructor =
	| typeof Int8Array
	| typeof Uint8Array
	| typeof Uint8ClampedArray
	| typeof Int16Array
	| typeof Uint16Array
	| typeof Int32Array
	| typeof Uint32Array
	| typeof Float32Array
	| typeof Float64Array;

export interface IAABB {
	min: Vec3;
	max: Vec3;
}

export interface IOBB {
	vertices: Vec3[];
	normals: Vec3[];
}

export type AABBResultPair = Vec2;

export interface IDebug {
	showAABBs: boolean;
	showOBBs: boolean;
	visualizeLightFrustums: boolean;
	lockDirectionalFrustums: boolean;
	firstPersonMode: boolean;
	flashlightOn: boolean;
	forceWalking: boolean;
	antialiasing: boolean;
	showFPS: boolean;
	frameCap: number;
	todLocked: boolean;
}
