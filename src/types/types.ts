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

export interface MoveSwitchBoard {
	f: MoveSwitchValue;
	b: MoveSwitchValue;
	l: MoveSwitchValue;
	r: MoveSwitchValue;
}
export type MoveSwitchValue = 0 | 1;

export interface IAnimations {
	[key: string]: GLTFAnimation;
}
