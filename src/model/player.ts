import { Mat4, Quat, Vec3, Vec4, mat4, quat, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { Lerp } from '../types/types';
import Model from './model';

export default class Player extends Model {
	name: string;
	moveableFlag: moveableFlag;
	transform: Mat4;
	parent: Model = null;
	position: Vec3;
	quat: Vec4;
	scale: Vec3;
	zUP: Mat4;
	speed: number = 0.01;

	constructor(name: string, moveableFlag: moveableFlag, transform: Mat4) {
		super(name, moveableFlag, transform);
	}

	spin_lerp(endDir: Vec3, lerpVal: Lerp) {
		const endPos: Vec3 = vec3.add(this.position, [-endDir[0], endDir[1], endDir[2]]);
		const lookAt: Mat4 = mat4.lookAt(this.position, endPos, [0, 1, 0]);
		const endQuat: Quat = quat.fromMat(lookAt);
		this.quat = quat.slerp(this.quat, endQuat, lerpVal);
	}

	// get_forward_direction(): Vec3 {
	// 	return quat.mul(this.quat, [0, 0, 1, 0]);
	// }
}
