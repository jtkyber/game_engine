import { Mat4, Vec3, mat4, utils, vec3 } from 'wgpu-matrix';

export class Camera {
	position: Vec3 = vec3.create(0, 0, 0);
	eulers: Vec3 = vec3.create(0, 0, 0);
	view: Mat4;
	forwards: Vec3 = vec3.create();
	forwardMove: Vec3 = vec3.create();
	right: Vec3 = vec3.create();
	rightMove: Vec3 = vec3.create();
	up: Vec3 = vec3.create();
	target: Vec3 = vec3.create();
	distAbovePlayer: number = 2;
	distFromPlayerStart: number = 8;
	distFromPlayer: number = 8;
	distFromPlayerMin: number = 1;
	distFromPlayerMax: number = 20;
	camDistLerpInc: number = 0;

	update() {
		if (this.position[1] < 0.1) this.position[1] = 0.1;

		this.forwards[0] = Math.cos(utils.degToRad(this.eulers[1])) * Math.cos(utils.degToRad(this.eulers[2]));
		this.forwards[1] = Math.sin(utils.degToRad(this.eulers[2]));
		this.forwards[2] = Math.sin(utils.degToRad(this.eulers[1])) * Math.cos(utils.degToRad(this.eulers[2]));

		this.forwardMove[0] = Math.cos(utils.degToRad(this.eulers[1]));
		this.forwardMove[1] = 0;
		this.forwardMove[2] = Math.sin(utils.degToRad(this.eulers[1]));

		this.right = vec3.cross(this.forwards, [0, 1, 0]);
		this.rightMove = vec3.cross(this.forwardMove, [0, 1, 0]);
		vec3.normalize(this.right, this.right);

		this.up = vec3.cross(this.right, this.forwards);
		vec3.normalize(this.up, this.up);

		this.target = vec3.add(this.position, this.forwards);

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
		this.position[1] = target[1] + this.distAbovePlayer;
		this.position[2] = target[2];

		// Apply rotations
		this.eulers[1] += dX;
		this.eulers[1] %= 360;

		this.eulers[2] = Math.min(89, Math.max(-89, this.eulers[2] + dY));

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

	lerp_cam_dist(lerpVal: number) {
		const lerpAmt: number = lerpVal * window.myLib.deltaTime * 0.5;
		if (lerpAmt >= 1 || lerpAmt <= -1) return;
		this.distFromPlayer = this.distFromPlayerStart + lerpAmt * this.camDistLerpInc;

		if (this.distFromPlayer < this.distFromPlayerMin) this.distFromPlayer = this.distFromPlayerMin;
		if (this.distFromPlayer > this.distFromPlayerMax) this.distFromPlayer = this.distFromPlayerMax;
	}
}
