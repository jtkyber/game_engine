import { Mat4, Vec3, Vec4, mat4, quat, utils, vec3, vec4 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';

export default class Model {
	name: string;
	moveableFlag: moveableFlag;
	transform: Mat4;
	parent: Model = null;
	position: Vec3 = vec3.create(0, 0, 0);
	quat: Vec4 = vec4.create(0, 0, 0, 1);
	scale: Vec3 = vec3.create(0, 0, 0);
	speed: number = 0.005;
	turnSpeed: number = 0;
	forward: Vec3;
	forwardMove: Vec3;
	right: Vec3;
	rightMove: Vec3;
	up: Vec3;
	OBBMin: number;
	OBBMax: number;

	constructor(name: string, moveableFlag: moveableFlag, transform: Mat4) {
		this.name = name;
		this.moveableFlag = moveableFlag;
		this.transform = transform;
	}

	update() {
		if (
			this.moveableFlag === moveableFlag.STATIC ||
			(this.moveableFlag === moveableFlag.MOVEABLE_ROOT && this.parent !== null)
		) {
			return;
		}

		this.forward = vec3.normalize(vec3.transformQuat([0, 0, -1], this.quat));
		this.forwardMove = vec3.normalize(vec3.create(this.forward[0], 0, this.forward[2]));

		this.right = vec3.normalize(vec3.cross(this.forward, [0, 1, 0]));
		this.rightMove = vec3.normalize(vec3.create(this.right[0], 0, this.right[2]));

		this.up = vec3.normalize(vec3.cross(this.right, this.forward));

		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);
	}

	spin(rotationAxis: Vec3, angleOfRotationInc: number) {
		angleOfRotationInc *= window.myLib.deltaTime;
		let angleOfRotation = quat.toAxisAngle(this.quat).angle + utils.degToRad(angleOfRotationInc);
		angleOfRotation = utils.euclideanModulo(angleOfRotation, 2 * Math.PI);
		quat.fromAxisAngle(rotationAxis, angleOfRotation, this.quat);
	}

	move(dir: Vec3, amt: number) {
		amt *= window.myLib.deltaTime;
		this.position = vec3.addScaled(this.position, dir, amt);
	}

	get_forward(): Vec3 {
		return vec3.mulScalar(this.forward, -1);
	}
}
