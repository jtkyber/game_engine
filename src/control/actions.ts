import { Mat4, mat4, Quat, quat, utils, vec2, Vec2, vec3, Vec3 } from 'wgpu-matrix';
import { eulerFromQuat } from '../utils/math';
import GLTFAnimation from '../view/gltf/animation';
import GLTFNode from '../view/gltf/node';

export default class Actions {
	birdStates: {
		[key: string]: string;
	} = {};
	birdTimeStamps: {
		[key: string]: number;
	} = {};
	birdStateDurations: {
		[key: string]: number;
	} = {};
	birdFlapStates: {
		[key: string]: boolean;
	} = {};
	birdFlapTimeStamps: {
		[key: string]: number;
	} = {};
	birdFlapDurations: {
		[key: string]: number;
	} = {};

	constructor() {}

	dist2d(pos1: Vec3, pos2: Vec3): number {
		const pos2d1: Vec2 = vec3.create(pos1[0], pos1[2]);
		const pos2d2: Vec2 = vec3.create(pos2[0], pos2[2]);

		return vec2.dist(pos2d1, pos2d2);
	}

	choosePoint(maxRadius: number, origin: Vec3, height: number): Vec3 {
		const theta: number = 2 * Math.PI * Math.random();

		const r: number = maxRadius * Math.sqrt(Math.random());

		let x: number = r * Math.cos(theta);
		let y: number = r * Math.sin(theta);

		x += origin[0];
		y += origin[2];

		return vec3.fromValues(x, height, y);
	}

	swim(node: GLTFNode) {
		if (this.dist2d(node.position, node.targetPosition) < 0.5) {
			node.targetPosition = this.choosePoint(node.maxRadius, node.initialPosition, node.position[1]);
		}

		const targetDirection: Vec3 = vec3.normalize(vec3.sub(node.targetPosition, node.position));

		node.spin_lerp(targetDirection);

		node.move_forward();
	}

	fly(
		node: GLTFNode,
		maxRadius: number = 10,
		flapAnimation: GLTFAnimation,
		glideAnimation: GLTFAnimation,
		perchedAnimation: GLTFAnimation
	) {
		let distFromOrigin: number = vec3.dist(node.position, node.initialPosition);
		let speedMult: number = 1;
		if (distFromOrigin < 10) speedMult = Math.max(Math.sqrt(distFromOrigin / 10), 0.2);

		const travel = () => {
			const center: Vec3 = vec3.create(0, 0, 0);
			// don't use y component
			if (this.dist2d(node.position, node.targetPosition) < 0.5) {
				let point: Vec3 = this.choosePoint(maxRadius, center, node.position[1]);
				// while (this.dist2d(point, node.position) < 30) {
				// 	point = this.choosePoint(maxRadius, center, node.position[1]);
				// }

				node.targetPosition = point;
			}

			const targetDirection: Vec3 = vec3.normalize(vec3.sub(node.targetPosition, node.position));

			node.spin_lerp(targetDirection);

			node.move_forward(speedMult);
		};

		const climb = () => {
			node.position[1] += 0.002 * window.myLib.deltaTime * speedMult;
		};

		const returnToPerch = () => {
			const targetDir: Vec3 = vec3.sub(node.initialPosition, node.position);
			node.rotate_lerp(targetDir);
			node.move_forward(speedMult);
		};

		const determineGlideAnimation = () => {
			const delta: number = (performance.now() - this.birdFlapTimeStamps[node.name]) / 1000;

			switch (this.birdFlapStates[node.name]) {
				case true:
					flapAnimation.play(3);
					break;
				default:
					glideAnimation.play(3);
			}

			if (delta > this.birdFlapDurations[node.name]) {
				this.birdFlapStates[node.name] = !this.birdFlapStates[node.name];
				this.birdFlapTimeStamps[node.name] = performance.now();

				switch (this.birdFlapStates[node.name]) {
					case true:
						this.birdFlapDurations[node.name] = Math.random() * (6 - 2) + 2;
						break;
					default:
						this.birdFlapDurations[node.name] = Math.random() * (15 - 5) + 5;
				}
			} else if (!this.birdFlapTimeStamps[node.name]) {
				this.birdFlapTimeStamps[node.name] = performance.now();
				this.birdFlapStates[node.name] = false;
				this.birdFlapDurations[node.name] = Math.random() * (20 - 5) + 5;
			}
		};

		switch (this.birdStates[node.name]) {
			case 'perched':
				perchedAnimation.play();
				break;
			case 'climbing':
				flapAnimation.play(3);
				travel();
				climb();
				break;
			case 'gliding':
				determineGlideAnimation();
				travel();
				break;
			case 'returning':
				determineGlideAnimation();
				returnToPerch();
				break;
		}

		const tiltUp = () => {
			const euler: Vec3 = eulerFromQuat(node.quat);
			node.quat = quat.fromEuler(utils.degToRad(-15), euler[1], 0, 'xyz');
		};

		const removeTilt = () => {
			const euler: Vec3 = eulerFromQuat(node.quat);
			node.quat = quat.fromEuler(0, euler[1], 0, 'xyz');
		};

		const timeSinceStateChange: number = (performance.now() - this.birdTimeStamps[node.name] || 0) / 1000;

		if (!this.birdStates[node.name]) {
			this.birdStates[node.name] = 'perched';
			this.birdStateDurations[node.name] = Math.random() * (60 - 20) + 20;
			// this.birdStateDurations[node.name] = 3;
			this.birdTimeStamps[node.name] = performance.now();
		} else if (timeSinceStateChange > this.birdStateDurations[node.name]) {
			switch (this.birdStates[node.name]) {
				case 'perched':
					this.birdStates[node.name] = 'climbing';
					this.birdStateDurations[node.name] = Math.random() * (18 - 10) + 10;
					tiltUp();
					break;
				case 'climbing':
					this.birdStates[node.name] = 'gliding';
					// this.birdStateDurations[node.name] = 5;
					this.birdStateDurations[node.name] = Math.random() * (120 - 60) + 60;
					removeTilt();
					break;
				case 'gliding':
					this.birdStates[node.name] = 'returning';
					this.birdStateDurations[node.name] = Infinity;
					break;
			}

			this.birdTimeStamps[node.name] = performance.now();
		} else if (
			this.birdStates[node.name] === 'returning' &&
			distFromOrigin < 0.005 * window.myLib.deltaTime
		) {
			node.position = node.initialPosition;
			this.birdStates[node.name] = 'perched';
			this.birdStateDurations[node.name] = Math.random() * (60 - 20) + 20;
			// this.birdStateDurations[node.name] = 3;
			this.birdTimeStamps[node.name] = performance.now();
		}
	}
}
