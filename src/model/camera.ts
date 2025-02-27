import { Mat4, Vec2, Vec3, mat4, quat, utils, vec2, vec3 } from 'wgpu-matrix';
import { degToRad } from 'wgpu-matrix/dist/3.x/utils';
import { aspect, globalToggles } from '../control/app';
import { bilinearInterpolation, normalFromTriangle } from '../utils/math';
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
	distFromModel: number = 5;
	distFromModelTemp: number = 5;
	distFromModelMin: number = 1;
	distFromModelMax: number = 8;
	targetNode: number;
	pitch: number = utils.degToRad(-12);
	yaw: number = utils.degToRad(180);
	fov = utils.degToRad(70);
	near: number = 0.1;
	far: number = 1000;
	projection = mat4.perspectiveReverseZ(this.fov, aspect, this.near, this.far);
	cascadeCount: number = 3;
	cascadeSplits: Float32Array = new Float32Array(this.cascadeCount + 1);
	cascadeRadiusArr: Float32Array = new Float32Array(this.cascadeCount);
	previousPosition: Vec3 = vec3.create(0, 0, 0);

	constructor(targetNode: number) {
		this.targetNode = targetNode;

		this.setInitialCamDists();

		// for (let i = 0; i < this.cascadeCount; i++) {
		// 	this.cascadeSplits[i] = this.near * Math.pow(400 / this.near, i / this.cascadeCount);
		// }

		this.cascadeSplits[0] = this.near;
		this.cascadeSplits[1] = 20;
		this.cascadeSplits[2] = 80;
		this.cascadeSplits[this.cascadeSplits.length - 1] = 400;
		// this.cascadeSplits[0] = this.near;

		// console.log(this.cascadeSplits);
	}

	setFOV(angleDeg: number) {
		this.fov = utils.degToRad(angleDeg);
		this.projection = mat4.perspectiveReverseZ(this.fov, aspect, this.near, this.far);
	}

	setInitialCamDists() {
		const height: number = nodes[this.targetNode].height;

		if (globalToggles.firstPersonMode) {
			this.distAboveModel = height * 0.9;
			this.distFromModel = height * -0.15;
			this.distFromModelMin = this.distFromModel;
			this.distFromModelMax = this.distFromModel;
		} else {
			this.distAboveModel = height * 0.9;
			this.distFromModel = height * 2;
			this.distFromModelMin = height * 0.25;
			// this.distFromModelMax = height * 10;
			this.distFromModelMax = height * 1000;
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

		if (globalToggles.firstPersonMode) {
			this.position = vec3.addScaled(this.position, this.forwardMove, -this.distFromModel);
		} else {
			this.position = vec3.addScaled(this.position, this.forward, -this.distFromModel);
		}

		// Don't let camera clip through terrain
		if (terrainHeightMap && terrainNodeIndex >= 0) this.limit_height_to_terrain(terrainNodeIndex);

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

		const pLocInMapContextX: number = nFractAlongMeshX * (terrainHeightMapSize - 1);
		const pLocInMapContextY: number = nFractAlongMeshY * (terrainHeightMapSize - 1);

		const xIndex: number = Math.floor(pLocInMapContextX);
		const yIndex: number = Math.floor(pLocInMapContextY);

		const interpolationSquare: Vec2[] = [
			vec2.create(xIndex, yIndex + 1), // LT
			vec2.create(xIndex + 1, yIndex + 1), // RT
			vec2.create(xIndex, yIndex), // LB
			vec2.create(xIndex + 1, yIndex), // RB
		];

		const interpolationPoints: Vec3[] = [];
		for (let p of interpolationSquare) {
			const height = getPixel(terrainHeightMap, p[1], p[0], terrainHeightMapSize) ?? -Infinity;
			interpolationPoints.push(vec3.create(p[0], p[1], height));
		}

		let terrainHeight: number = bilinearInterpolation(
			pLocInMapContextX,
			pLocInMapContextY,
			interpolationPoints[0],
			interpolationPoints[1],
			interpolationPoints[2],
			interpolationPoints[3]
		);

		// const terrainNormal: Vec3 = normalFromTriangle(
		// 	interpolationPoints[0],
		// 	interpolationPoints[1],
		// 	interpolationPoints[2]
		// );

		// const terrainHeight = getPixel(terrainHeightMap, yIndex, xIndex, terrainHeightMapSize) ?? -Infinity;

		if (this.position[1] < terrainHeight + 0.8) this.position[1] = terrainHeight + 0.8;
	}

	move_FB(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.forwardMove, moveAmt);
	}

	strafe(sign: number, amt: number) {
		const moveAmt: number = sign * amt * window.myLib.deltaTime;

		this.position = vec3.addScaled(this.position, this.rightMove, moveAmt);
	}
}
