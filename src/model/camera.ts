import { Mat4, Vec3, mat4, utils, vec3 } from 'wgpu-matrix';

export class Camera {
	position: Vec3;
	eulers: Vec3;
	view: Mat4;
	forwards: Vec3;
	forwardMove: Vec3;
	right: Vec3;
	rightMove: Vec3;
	up: Vec3;
	target: Vec3;
	distAbovePlayer: number;
	distFromPlayer: number;

	constructor(position: Vec3, theta: number, phi: number) {
		this.position = position;
		this.eulers = vec3.create(0, phi, theta);
		this.forwards = vec3.create();
		this.forwardMove = vec3.create();
		this.right = vec3.create();
		this.rightMove = vec3.create();
		this.up = vec3.create();
		this.distAbovePlayer = 0.5;
		this.distFromPlayer = 2.5;
	}

	update() {
		if (this.position[2] < 0.1) this.position[2] = 0.1;

		this.forwards[0] = Math.cos(utils.degToRad(this.eulers[2])) * Math.cos(utils.degToRad(this.eulers[1]));
		this.forwards[1] = Math.sin(utils.degToRad(this.eulers[2])) * Math.cos(utils.degToRad(this.eulers[1]));
		this.forwards[2] = Math.sin(utils.degToRad(this.eulers[1]));

		this.forwardMove[0] = Math.cos(utils.degToRad(this.eulers[2]));
		this.forwardMove[1] = Math.sin(utils.degToRad(this.eulers[2]));
		this.forwardMove[2] = 0;

		this.right = vec3.cross(this.forwards, [0, 0, 1]);
		this.rightMove = vec3.cross(this.forwardMove, [0, 0, 1]);
		vec3.normalize(this.right, this.right);

		this.up = vec3.cross(this.right, this.forwards);
		vec3.normalize(this.up, this.up);

		this.target = vec3.add(this.position, this.forwards);

		// this.view = mat4.lookAt([2, -6, 1], [-1, 0, 0], [0, 0, 1]);
		this.view = mat4.lookAt(this.position, this.target, this.up);
	}

	get_view(): Mat4 {
		return this.view;
	}

	get_position(): Vec3 {
		return this.position;
	}

	spin_on_target(dX: number, dY: number, target: Vec3) {
		// Translate to center eye level of player
		this.position[0] = target[0];
		this.position[1] = target[1];
		this.position[2] = target[2] + this.distAbovePlayer;

		// Apply rotations
		this.eulers[2] += dX;
		this.eulers[2] %= 360;

		this.eulers[1] = Math.min(89, Math.max(-89, this.eulers[1] + dY));

		// Translate straight back along the forwards vector to the camera
		this.position = vec3.addScaled(this.position, this.forwards, -this.distFromPlayer);
	}

	move_FB(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.forwardMove, moveAmt);
	}

	strafe(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.rightMove, moveAmt);
	}
}
