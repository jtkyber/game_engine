import { Mat4, Vec3, mat4, quat, vec3 } from 'wgpu-matrix';
import { nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import Model from './model';

export class Camera {
	position: Vec3 = vec3.create(0, 0, 0);
	quat: Vec3 = quat.create(0, 0, 0, 1);
	view: Mat4;
	forward: Vec3 = vec3.create();
	forwardMove: Vec3 = vec3.create();
	right: Vec3 = vec3.create();
	rightMove: Vec3 = vec3.create();
	up: Vec3 = vec3.create();
	target: Vec3 = vec3.create();
	distAboveModel: number = 2;
	distFromModel: number = 15;
	distFromModelMin: number = 5;
	distFromModelMax: number = 50;
	targetModel: Model;
	pitch: number = 0;
	yaw: number = 0;

	constructor(targetModel: Model) {
		this.targetModel = targetModel;
	}

	update() {
		if (this.distFromModel < this.distFromModelMin) this.distFromModel = this.distFromModelMin;
		if (this.distFromModel > this.distFromModelMax) this.distFromModel = this.distFromModelMax;

		// Move camera to center of model
		this.position[0] = nodes[this.targetModel.rootNodeIndex].position[0];
		this.position[1] = nodes[this.targetModel.rootNodeIndex].position[1] + this.distAboveModel;
		this.position[2] = nodes[this.targetModel.rootNodeIndex].position[2];

		// Make quat from pitch and yaw
		this.quat = quat.fromEuler(this.pitch, this.yaw, 0, 'yxz');

		// Get direction vectors
		this.forward = vec3.normalize(vec3.transformQuat([0, 0, -1], this.quat));
		this.forwardMove = vec3.normalize(vec3.create(this.forward[0], 0, this.forward[2]));

		this.right = vec3.normalize(vec3.cross(this.forward, [0, 1, 0]));
		this.rightMove = vec3.normalize(vec3.create(this.right[0], 0, this.right[2]));

		this.up = vec3.normalize(vec3.cross(this.right, this.forward));

		// Move camera back out along forward vector
		this.position = vec3.addScaled(this.position, this.forward, -this.distFromModel);
		// Don't let camera clip through ground
		if (this.position[1] < 0.1) this.position[1] = 0.1;

		this.target = vec3.add(this.position, this.forward);

		this.view = mat4.lookAt(this.position, this.target, [0, 1, 0]);
	}

	move_FB(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.forwardMove, moveAmt);
	}

	strafe(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.rightMove, moveAmt);
	}

	get_view(): Mat4 {
		return this.view;
	}

	get_position(): Vec3 {
		return this.position;
	}

	get_forward(): Vec3 {
		return vec3.mulScalar(this.forward, -1);
	}
}
