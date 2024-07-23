import GLTFAnimationChannel from './animationChannel';

export default class GLTFAnimation {
	name: string;
	channels: GLTFAnimationChannel[];

	constructor(name: string, channels: GLTFAnimationChannel[]) {
		this.name = name;
		this.channels = channels;
	}

	play() {
		for (let i = 0; i < this.channels.length; i++) {
			this.channels[i].play();
		}
	}

	reset() {
		// lerp translation, rotation, scale back to starting position
		for (let i = 0; i < this.channels.length; i++) {
			this.channels[i].currentTime = 0;
			this.channels[i].play();
		}
	}
}
