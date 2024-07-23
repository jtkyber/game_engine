import { Vec4, quat, vec3 } from 'wgpu-matrix';
import { GLTFAnimationInterpolation, GLTFAnimationPath } from '../../types/enums';
import { TypedArray } from '../../types/types';
import GLTFAnimationSampler from './animationSampler';
import { nodes } from './loader';

export default class GLTFAnimationChannel {
	sampler: GLTFAnimationSampler;
	targetNode: number;
	path: GLTFAnimationPath;
	currentTime: number = 0;
	animationSpeed: number = 0.0006;

	constructor(sampler: GLTFAnimationSampler, targetNode: number, path: GLTFAnimationPath) {
		this.sampler = sampler;
		this.targetNode = targetNode;
		this.path = path;
	}

	play() {
		const min = this.sampler.min;
		const max = this.sampler.max;
		const times = this.sampler.input;
		const values = this.sampler.output;

		if (this.currentTime > max) this.currentTime -= max;
		if (this.currentTime < min) this.currentTime += min + 0.00001;

		switch (this.path) {
			case GLTFAnimationPath.TRANSLATION:
				nodes[this.targetNode].position = this.get_interpolated_value(3, times, values);
				break;
			case GLTFAnimationPath.ROTATION:
				nodes[this.targetNode].quat = this.get_interpolated_value(4, times, values);
				break;
			case GLTFAnimationPath.SCALE:
				nodes[this.targetNode].scale = this.get_interpolated_value(3, times, values);
				break;
		}

		this.currentTime += this.animationSpeed * window.myLib.deltaTime;
	}

	get_value(values: any, i: number, componentCount: number) {
		return values.slice(i * componentCount, i * componentCount + componentCount);
	}

	get_lerped_value(prevValue: any, nextValue: any, interpolationValue: number) {
		switch (this.path) {
			case GLTFAnimationPath.TRANSLATION:
				return vec3.lerp(prevValue, nextValue, interpolationValue);
			case GLTFAnimationPath.ROTATION:
				return quat.slerp(prevValue, nextValue, interpolationValue);
			case GLTFAnimationPath.SCALE:
				return vec3.lerp(prevValue, nextValue, interpolationValue);
		}
	}

	get_interpolated_value(componentCount: number, times: TypedArray, values: TypedArray) {
		const interpolation: GLTFAnimationInterpolation = this.sampler.interpolation;

		for (let i = 0; i < times.length; i++) {
			const prevTime: number = times[i];
			const nextTime: number = times[i + 1];
			const prevValue: Vec4 = this.get_value(values, i, componentCount);
			const nextValue: Vec4 = this.get_value(values, i + 1, componentCount);

			if (this.currentTime >= prevTime && this.currentTime <= nextTime) {
				switch (interpolation) {
					case GLTFAnimationInterpolation.STEP:
						return prevValue;
					case GLTFAnimationInterpolation.LINEAR:
						const interpolationValue: number = (this.currentTime - prevTime) / (nextTime - prevTime);
						return this.get_lerped_value(prevValue, nextValue, interpolationValue);
				}
			}
		}
	}
}
