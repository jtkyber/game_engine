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
	speed: number = 0.01;
	turnSpeed: number = 0.005;
	forward: Vec3;
	forwardMove: Vec3;
	right: Vec3;
	rightMove: Vec3;
	up: Vec3;

	constructor(name: string, moveableFlag: moveableFlag, nodeIndex: number, rootNodeIndex: number) {
		super(name, moveableFlag, nodeIndex, rootNodeIndex);
	}

	spin_lerp(endDir: Vec3) {
		let spinAmt: number = this.turnSpeed * window.myLib.deltaTime;

		vec3.mulScalar(endDir, -1, endDir);

		const sign: number = -Math.sign(vec3.cross(endDir, this.forwardMove)[1]);
		const angleToTurn: number = vec3.angle(endDir, this.forwardMove);

		if (angleToTurn <= spinAmt + 1) spinAmt *= angleToTurn * 0.8;

		quat.rotateY(nodes[this.nodeIndex].quat, sign * spinAmt, nodes[this.nodeIndex].quat);
	}
}
