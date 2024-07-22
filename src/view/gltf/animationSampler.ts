import { GLTFAnimationInterpolation } from '../../types/enums';
import GLTFAccessor from './accessor';

export default class GLTFAnimationSampler {
	input: GLTFAccessor;
	output: GLTFAccessor;
	interpolation: GLTFAnimationInterpolation;

	constructor(input: GLTFAccessor, output: GLTFAccessor, interpolation: GLTFAnimationInterpolation) {
		this.input = input;
		this.output = output;
		this.interpolation = interpolation;

		this.input.bufferView.needsUpload = true;
		this.input.bufferView.addUsage(GPUBufferUsage.STORAGE);

		this.output.bufferView.needsUpload = true;
		this.output.bufferView.addUsage(GPUBufferUsage.STORAGE);
	}
}
