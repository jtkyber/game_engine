import GLTFAnimation from '../view/gltf/animation';
import { moveableFlag } from './enums';

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
	viewTransform: Float32Array;
	nodeTransforms: Float32Array;
	normalTransforms: Float32Array;
	jointMatricesBufferList: GPUBuffer[];
}

export function getMoveableFlagType(name: string): moveableFlag | null {
	switch (name) {
		case 'static':
			return moveableFlag.STATIC;
		case 'moveableRoot':
			return moveableFlag.MOVEABLE_ROOT;
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
