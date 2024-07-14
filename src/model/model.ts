import { Mat4, Vec3, Vec4, mat4, quat, utils, vec3, vec4 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';

export default class Model {
	name: string;
	moveableFlag: moveableFlag;
	transform: Mat4;
	parent: Model = null;
	position: Vec3;
	quat: Vec4;
	scale: Vec3;
	speed: number;

	constructor(name: string, moveableFlag: moveableFlag, transform: Mat4) {
		this.name = name;
		this.moveableFlag = moveableFlag;
		this.transform = transform;
		this.position = vec3.create(0, 0, 0);
		this.quat = vec4.create(0, 0, 0, 1);
		this.scale = vec3.create(0, 0, 0);
		this.speed = 0.005;
	}

	update() {
		if (
			this.moveableFlag === moveableFlag.STATIC ||
			(this.moveableFlag === moveableFlag.MOVEABLE_ROOT && this.parent !== null)
		) {
			return;
		}

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
		vec3.addScaled(this.position, dir, amt, this.position);
	}
}
