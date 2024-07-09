import { ImageUsage } from '../../types/enums';
import GLTFImage from './image';
import { GLTFSampler } from './sampler';

export class GLTFTexture {
	sampler: GLTFSampler;
	image: GLTFImage;

	constructor(sampler: GLTFSampler, image: GLTFImage) {
		this.sampler = sampler;
		this.image = image;
	}

	setUsage(usage: ImageUsage) {
		this.image.setUsage(usage);
	}
}
