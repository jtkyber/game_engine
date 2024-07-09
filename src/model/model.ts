import { Mat4, Vec3, mat4, utils, vec3 } from 'wgpu-matrix';

export default class Model {
	name: string;
	nodeIndex: number;
	position: Vec3;
	eulers: Vec3;
	isPlayer: boolean;
	transform: Mat4;

	constructor(name: string, nodeIndex: number, isPlayer: boolean) {
		this.name = name;
		this.nodeIndex = nodeIndex;
		this.isPlayer = isPlayer;
		this.position = vec3.create(0, 0, 0);
		this.eulers = vec3.create(0, 0, 0);
	}

	update() {
		this.transform = mat4.create();
		mat4.translate(this.position, this.transform);

		mat4.rotationX(utils.degToRad(this.eulers[0]), this.transform);
		mat4.rotationY(utils.degToRad(this.eulers[1]), this.transform);
		mat4.rotationZ(utils.degToRad(this.eulers[2]), this.transform);
	}

	set_rotation(rot: number, i: number): void {
		this.eulers[i] = rot;
	}
}
