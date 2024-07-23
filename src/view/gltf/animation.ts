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
}
