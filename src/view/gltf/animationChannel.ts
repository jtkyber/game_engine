import { GLTFAnimationPath } from '../../types/enums';
import GLTFAnimationSampler from './animationSampler';

export default class GLTFAnimationChannel {
	sampler: GLTFAnimationSampler;
	targetNode: number;
	path: GLTFAnimationPath;

	constructor(sampler: GLTFAnimationSampler, targetNode: number, path: GLTFAnimationPath) {
		this.sampler = sampler;
		this.targetNode = targetNode;
		this.path = path;
	}
}
