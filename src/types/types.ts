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
}
