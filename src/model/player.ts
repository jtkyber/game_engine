import { Mat4, Vec3, quat, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { nodes } from '../view/gltf/loader';
import { Camera } from './camera';
import Model from './model';

export default class Player extends Model {
	name: string;
	moveableFlag: moveableFlag;
	nodeIndex: number;
	rootNodeIndex: number;
	camera: Camera;
	parent: Model = null;
	zUP: Mat4;
	turnSpeed: number = 0.008;
	forward: Vec3;
	forwardMove: Vec3;
	right: Vec3;
	rightMove: Vec3;
	up: Vec3;

	constructor(name: string, moveableFlag: moveableFlag, nodeIndex: number, rootNodeIndex: number) {
		super(name, moveableFlag, nodeIndex, rootNodeIndex);
	}

	update() {
		this.forward = vec3.normalize(vec3.transformQuat([0, 0, -1], nodes[this.rootNodeIndex].quat));
		this.forwardMove = vec3.normalize(vec3.create(this.forward[0], 0, this.forward[2]));

		this.right = vec3.normalize(vec3.cross(this.forward, [0, 1, 0]));
		this.rightMove = vec3.normalize(vec3.create(this.right[0], 0, this.right[2]));

		this.up = vec3.normalize(vec3.cross(this.right, this.forward));
	}

	spin_lerp(endDir: Vec3) {
		let spinAmt: number = this.turnSpeed * window.myLib.deltaTime;

		vec3.mulScalar(endDir, -1, endDir);

		const sign: number = -Math.sign(vec3.cross(endDir, this.forwardMove)[1]);
		const angleToTurn: number = vec3.angle(endDir, this.forwardMove);

		if (angleToTurn <= spinAmt + 1) spinAmt *= angleToTurn * 0.8;

		quat.rotateY(nodes[this.rootNodeIndex].quat, sign * spinAmt, nodes[this.rootNodeIndex].quat);
	}
}
