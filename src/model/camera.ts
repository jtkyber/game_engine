import { Mat4, Quat, Vec3, mat4, quat, utils, vec3 } from 'wgpu-matrix';
import Model from './model';

export class Camera {
	position: Vec3 = vec3.create(0, 0, 0);
	// eulers: Vec3 = vec3.create(0, 0, 0);
	quat: Vec3 = quat.create(0, 0, 0, 1);
	view: Mat4;
	forwards: Vec3 = vec3.create();
	forwardMove: Vec3 = vec3.create();
	right: Vec3 = vec3.create();
	rightMove: Vec3 = vec3.create();
	up: Vec3 = vec3.create();
	target: Vec3 = vec3.create();
	distAboveModel: number = 2;
	distFromModelStart: number = 8;
	distFromModel: number = 8;
	distFromModelMin: number = 1.5;
	distFromModelMax: number = 20;
	camDistLerpInc: number = 0;
	targetModel: Model;
	pitch: number = 0;
	yaw: number = 0;

	constructor(targetModel: Model) {
		this.targetModel = targetModel;
	}

	update() {
		// Move camera to center of model
		this.position[0] = this.targetModel.position[0];
		this.position[1] = this.targetModel.position[1] + this.distAboveModel;
		this.position[2] = this.targetModel.position[2];

		// Make quat from pitch and yaw
		this.quat = quat.fromEuler(this.pitch, this.yaw, 0, 'xyz');

		// Get direction vectors
		this.forwards = this.get_forward_direction(this.quat);
		this.forwardMove = vec3.create(this.forwards[0], 0, this.forwards[2]);

		this.right = vec3.cross(this.forwards, [0, 1, 0]);
		this.rightMove = vec3.create(this.right[0], 0, this.right[2]);

		this.up = vec3.cross(this.right, this.forwards);

		// Move camera back out along forward vector
		this.position = vec3.addScaled(this.position, this.forwards, -this.distFromModel);
		// Don't let camera clip through ground
		if (this.position[1] < 0.1) this.position[1] = 0.1;

		// Get position to look at
		this.target = vec3.add(this.position, this.forwards);

		// Create view matrix
		this.view = mat4.lookAt(this.position, this.target, [0, 1, 0]);
	}

	spin_on_target() {
		// Translate to center eye level of player
		this.position[0] = this.targetModel.position[0];
		this.position[1] = this.targetModel.position[1] + this.distAboveModel;
		this.position[2] = this.targetModel.position[2];

		// Apply rotations
		// this.eulers[1] += dX;
		// this.eulers[1] %= 360;
		// dX = utils.degToRad(dX);
		// dY = utils.degToRad(dY);

		// this.eulers[2] = Math.min(89, Math.max(-89, this.eulers[2] + dY));
		// quat.rotateX(this.quat, dY, this.quat);
		// quat.rotateY(this.quat, dX, this.quat);

		let quatTemp: Quat = quat.create(0, 0, 0, 1);

		const yaw: Quat = quat.rotateY(quat.create(0, 0, 0, 1), this.yaw);
		const pitch: Quat = quat.rotateX(quat.create(0, 0, 0, 1), this.pitch);

		quat.mul(pitch, quatTemp, quatTemp);
		quat.mul(quatTemp, yaw, quatTemp);

		this.quat = quatTemp;

		// Translate straight back along the forwards vector to the camera
		this.position = vec3.addScaled(this.position, this.forwards, -this.distFromModel);
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
		this.distFromModel = this.distFromModelStart + lerpAmt * this.camDistLerpInc;

		if (this.distFromModel < this.distFromModelMin) this.distFromModel = this.distFromModelMin;
		if (this.distFromModel > this.distFromModelMax) this.distFromModel = this.distFromModelMax;
	}

	get_forward_direction(q: Quat) {
		const forward: Vec3 = vec3.fromValues(0, 0, -1);

		return vec3.transformQuat(forward, q);
	}

	get_view(): Mat4 {
		return this.view;
	}

	get_position(): Vec3 {
		return this.position;
	}
}
