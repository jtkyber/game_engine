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
	modelTransforms: Float32Array;
	normalTransforms: Float32Array;
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

export interface IMoveVecOnOff {
	f: MoveVecOnOffValue;
	b: MoveVecOnOffValue;
	l: MoveVecOnOffValue;
	r: MoveVecOnOffValue;
}
export type MoveVecOnOffValue = 0 | 1;
