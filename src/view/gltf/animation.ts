import GLTFAnimationChannel from './animationChannel';

export default class GLTFAnimation {
	name: string;
	channels: GLTFAnimationChannel[];

	constructor(name: string, channels: GLTFAnimationChannel[]) {
		this.name = name;
		this.channels = channels;
	}

	play() {
		// Loop through channels and play animation
	}
}
