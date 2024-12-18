import { GLTFAnimationInterpolation } from '../../types/enums';
import { typedArrayFromComponentType } from '../../types/gltf';
import { TypedArray } from '../../types/types';
import GLTFAccessor from './accessor';

export default class GLTFAnimationSampler {
	input: TypedArray;
	output: TypedArray;
	interpolation: GLTFAnimationInterpolation;
	min: number;
	max: number;

	constructor(input: GLTFAccessor, output: GLTFAccessor, interpolation: GLTFAnimationInterpolation) {
		this.interpolation = interpolation;

		input.bufferView.needsUpload = true;
		input.bufferView.addUsage(GPUBufferUsage.STORAGE);
		this.input = new (typedArrayFromComponentType(input.componentType) as any)(
			input.bufferView.view.buffer,
			input.bufferView.view.byteOffset,
			input.bufferView.view.byteLength / 4
		);

		output.bufferView.needsUpload = true;
		output.bufferView.addUsage(GPUBufferUsage.STORAGE);
		this.output = new (typedArrayFromComponentType(output.componentType) as any)(
			output.bufferView.view.buffer,
			output.bufferView.view.byteOffset,
			output.bufferView.view.byteLength / 4
		);

		this.min = input.min[0];
		this.max = input.max[0];
	}
}
