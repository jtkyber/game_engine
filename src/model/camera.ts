import { Mat4, Vec3, mat4, quat, utils, vec3 } from 'wgpu-matrix';
import { aspect } from '../control/app';
import { getPixel } from '../utils/misc';
import { nodes, terrainHeightMap, terrainHeightMapSize } from '../view/gltf/loader';

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
	distFromModel: number = 4;
	distFromModelTemp: number = 4;
	distFromModelMin: number = 1;
	distFromModelMax: number = 8;
	targetNode: number;
	pitch: number = 0;
	yaw: number = 0;
	fov = utils.degToRad(60);
	near: number = 0.01;
	far: number = 1000;
	shadowNear: number = 3;
	shadowFar: number = 400;
	projection = mat4.perspectiveReverseZ(this.fov, aspect, this.near, this.far);
	cascadeCount: number = 3;
	cascadeSplits: Float32Array = new Float32Array(this.cascadeCount);

	constructor(targetNode: number) {
		this.targetNode = targetNode;

		const height: number = nodes[targetNode].height;
		this.distAboveModel = height * 0.9;
		this.distFromModel = height * 4;
		this.distFromModelMin = height * 1;
		this.distFromModelMax = height * 400;

		for (let i = 0; i < this.cascadeCount; i++) {
			this.cascadeSplits[i] =
				this.shadowNear * Math.pow(this.shadowFar / this.shadowNear, (i + 1) / this.cascadeCount);
		}
	}

	update(terrainNodeIndex: number) {
		this.distFromModel = this.clamp_dist_from_model(this.distFromModel);

		// Move camera to center of model
		this.position[0] = nodes[this.targetNode].position[0];
		this.position[1] = nodes[this.targetNode].position[1] + this.distAboveModel;
		this.position[2] = nodes[this.targetNode].position[2];

		this.pitch = Math.max(Math.min(this.pitch, Math.PI / 2 - 0.001), -Math.PI / 2 + 0.001);
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
		// Don't let camera clip through terrain
		this.limit_height_to_terrain(terrainNodeIndex);

		this.target = vec3.add(this.position, this.forward);

		this.view = mat4.lookAt(this.position, this.target, [0, 1, 0]);
	}

	clamp_dist_from_model(dist: number): number {
		if (dist < this.distFromModelMin) return this.distFromModelMin;
		if (dist > this.distFromModelMax) return this.distFromModelMax;
		return dist;
	}

	limit_height_to_terrain(terrainNodeIndex: number): void {
		const mapLength: number = nodes[terrainNodeIndex].maxValues[0][0] - nodes[terrainNodeIndex].min[0];
		const mapWidth: number = nodes[terrainNodeIndex].maxValues[0][2] - nodes[terrainNodeIndex].min[2];

		const nFractAlongMeshX: number = (this.position[0] - nodes[terrainNodeIndex].min[0]) / mapLength;
		const nFractAlongMeshY: number = (this.position[2] - nodes[terrainNodeIndex].min[2]) / mapWidth;

		const col: number = Math.floor(nFractAlongMeshX * (terrainHeightMapSize - 1));
		const row: number = Math.floor(nFractAlongMeshY * (terrainHeightMapSize - 1));

		const terrainHeight = getPixel(terrainHeightMap, row, col, terrainHeightMapSize) ?? -Infinity;

		if (this.position[1] < terrainHeight + 0.2) this.position[1] = terrainHeight + 0.2;
		// if (this.position[1] < terrainHeight + 0.2) {
		// 	this.distFromModelTemp = this.clamp_dist_from_model(this.distFromModelTemp - 0.3);
		// }
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
