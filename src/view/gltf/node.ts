import { Mat4, Quat, Vec3, mat4, quat } from 'wgpu-matrix';
import { moveableFlag } from '../../types/enums';
import GLTFMesh from './mesh';
import GLTFSkin from './skin';

export default class GLTFNode {
	name: string;
	flag: moveableFlag;
	parent: number = null;
	position: Vec3;
	quat: Quat;
	scale: Vec3;
	transform: Mat4;
	mesh: GLTFMesh = null;
	skin: GLTFSkin = null;

	constructor(
		name: string,
		flag: any,
		parent: number,
		position: Vec3,
		quat: Quat,
		scale: Vec3,
		transform: Mat4,
		mesh: GLTFMesh,
		skin: GLTFSkin
	) {
		this.name = name;
		this.flag = flag;
		this.parent = parent;
		this.position = position;
		this.quat = quat;
		this.scale = scale;
		this.transform = transform;
		this.mesh = mesh;
		this.skin = skin;
	}

	update() {
		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);
	}
}
