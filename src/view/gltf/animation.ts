import GLTFAnimationChannel from './animationChannel';

export default class GLTFAnimation {
	name: string;
	channels: GLTFAnimationChannel[];

	constructor(name: string, channels: GLTFAnimationChannel[]) {
		this.name = name;
		this.channels = channels;
	}

	play(speed: number = 1) {
		for (let i = 0; i < this.channels.length; i++) {
			this.channels[i].play(speed);
		}
	}
}
