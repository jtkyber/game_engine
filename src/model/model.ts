import { Mat4, Vec3, Vec4, mat4, quat, utils, vec3, vec4 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { zUpTransformation } from '../utils/matrix';

export default class Model {
	name: string;
	isPlayer: boolean;
	moveableFlag: moveableFlag;
	transform: Mat4;
	parent: Model = null;
	position: Vec3;
	quat: Vec4;
	scale: Vec3;
	zUP: Mat4;
	speed: number;

	constructor(name: string, isPlayer: boolean, moveableFlag: moveableFlag, transform: Mat4) {
		this.name = name;
		this.isPlayer = isPlayer;
		this.moveableFlag = moveableFlag;
		this.transform = transform;
		this.position = vec3.create(0, 0, 0);
		this.quat = vec4.create(0, 0, 0, 1);
		this.scale = vec3.create(0, 0, 0);
		this.zUP = zUpTransformation();
		this.speed = 0.005;
	}

	update() {
		if (
			this.moveableFlag === moveableFlag.STATIC ||
			(this.moveableFlag === moveableFlag.MOVEABLE_ROOT && this.parent !== null)
		) {
			return;
		}

		// if (this.name === 'Player') {
		// 	// this.move(vec3.create(1, 0, 0), 0.0005);
		// 	this.spin(vec3.create(0, 0, 1), 0.02);
		// } else if (this.name === 'wheel fr.001' || this.name === 'wheel fl.001') {
		// 	this.spin(vec3.create(0, 0, -1), 0.1);
		// } else if (this.name === 'Sphere') {
		// 	this.spin(vec3.create(0, 0, -1), 0.01);
		// }

		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);

		// Only transform root nodes by zUp matrix
		if (this.parent === null) mat4.mul(this.zUP, this.transform, this.transform);
	}

	spin(rotationAxis: Vec3, angleOfRotationInc: number) {
		angleOfRotationInc *= window.myLib.deltaTime;
		let angleOfRotation = quat.toAxisAngle(this.quat).angle + utils.degToRad(angleOfRotationInc);
		angleOfRotation = utils.euclideanModulo(angleOfRotation, 2 * Math.PI);
		quat.fromAxisAngle(rotationAxis, angleOfRotation, this.quat);

		vec4.transformMat4(this.quat, this.zUP, this.quat);
	}

	move(dir: Vec3, amt: number) {
		const dirY = dir[1];
		dir[1] = dir[2];
		dir[2] = -dirY;

		amt *= window.myLib.deltaTime;
		vec3.addScaled(this.position, dir, amt, this.position);
	}
}
