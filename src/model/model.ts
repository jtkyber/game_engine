import { Mat4, Vec3, Vec4, mat4, quat, utils, vec3, vec4 } from 'wgpu-matrix';
import { degToRad } from 'wgpu-matrix/dist/3.x/utils';
import { toPrincipleRangeRadians } from '../utils/math';

export default class Model {
	name: string;
	nodeIndex: number;
	position: Vec3;
	quat: Vec4;
	scale: Vec3;
	isPlayer: boolean;
	transform: Mat4;
	zUpTransformation: Mat4;

	constructor(name: string, nodeIndex: number, isPlayer: boolean) {
		this.name = name;
		this.nodeIndex = nodeIndex;
		this.isPlayer = isPlayer;
		this.position = vec3.create(0, 0, 0);
		this.quat = vec4.create(0, 0, 0, 1);
		this.scale = vec3.create(0, 0, 0);
		this.zUpTransformation = mat4.create(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
	}

	update() {
		if (this.name === 'Player') {
			this.spin(vec3.create(0, 0, 1), 0.05);
			// this.move(vec3.create(-1, 0, 0), 0.002);
		}

		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);

		mat4.mul(this.zUpTransformation, this.transform, this.transform);
	}

	spin(rotationAxis: Vec3, angleOfRotationInc: number) {
		angleOfRotationInc *= window.myLib.deltaTime;
		let angleOfRotation = quat.toAxisAngle(this.quat).angle + utils.degToRad(angleOfRotationInc);
		angleOfRotation = utils.euclideanModulo(angleOfRotation, 2 * Math.PI);
		quat.fromAxisAngle(rotationAxis, angleOfRotation, this.quat);
		vec4.transformMat4(this.quat, this.zUpTransformation, this.quat);
	}

	move(dir: Vec3, inc: number) {
		const dirY = dir[1];
		dir[1] = dir[2];
		dir[2] = -dirY;
		inc *= window.myLib.deltaTime;
		vec3.addScaled(this.position, dir, inc, this.position);
	}
}
