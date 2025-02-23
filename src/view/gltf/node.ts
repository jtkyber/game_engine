import { Mat4, Quat, Vec2, Vec3, Vec4, mat4, quat, vec2, vec3, vec4 } from 'wgpu-matrix';
import { globalToggles } from '../../control/app';
import { Flag } from '../../types/enums';
import { IAABB, IOBB } from '../../types/types';
import { bilinearInterpolation, computeTargetQuat } from '../../utils/math';
import { getAABBverticesFromMinMax, getPixel } from '../../utils/misc';
import { nodes, terrainHeightMap, terrainHeightMapSize } from './loader';
import GLTFMesh from './mesh';
import GLTFSkin from './skin';

export default class GLTFNode {
	device: GPUDevice;
	name: string;
	flag: Flag;
	parent: number = null;
	children: number[] = [];
	rootNode: number;
	position: Vec3;
	adjustedPosition: Vec3 = null;
	initialPosition: Vec3;
	quat: Quat;
	scale: Vec3;
	transform: Mat4;
	globalTransform: Mat4;
	normalTransform: Mat4;
	mesh: GLTFMesh = null;
	skin: GLTFSkin = null;
	minValues: Vec3[];
	maxValues: Vec3[];
	min: Vec3;
	max: Vec3;
	_mass: number = null;
	_speed: number = null;
	hasBoundingBox: boolean = true;
	isBB: boolean = false;
	hasPhysics: boolean = false;
	hidden: boolean = false;
	hideShadow: boolean = false;
	objectClass: string = null;
	_currentSpeed: number = 0;
	_currentVelocity: Vec3 = vec3.create(0, 0, 0);
	turnSpeed: number;
	initialOBB: IOBB = null;
	OBB: IOBB = null;
	AABB: IAABB = null;
	height: number;
	previousPosition: Vec3;
	preTransformed: boolean;
	terrainNodeIndex: number = null;
	targetPosition: Vec3;
	maxRadius: number;

	// For debug
	initialOBBMesh: Float32Array = null;
	OBBBuffer: GPUBuffer = null;
	AABBBuffer: GPUBuffer = null;

	gravitySpeedStart: number = 0;
	gravitySpeed: number = 0;
	gravityAcc: number = 0.000016;

	terrainStepAmt: number = 100;

	inAir: boolean = true;

	forward: Vec3;
	forwardMove: Vec3;
	right: Vec3;
	rightMove: Vec3;
	up: Vec3;

	constructor(
		device: GPUDevice,
		name: string,
		flag: Flag,
		parent: number,
		children: number[],
		rootNode: number,
		position: Vec3,
		quat: Quat,
		scale: Vec3,
		transform: Mat4,
		mesh: GLTFMesh,
		skin: GLTFSkin,
		minValues: Vec3[],
		maxValues: Vec3[],
		mass: number,
		speed: number,
		hasBoundingBox: boolean,
		isBB: boolean,
		hasPhysics: boolean,
		hidden: boolean,
		hideShadow: boolean,
		objectClass: string,
		maxRadius: number,
		turnSpeed: number
	) {
		this.device = device;
		this.name = name;
		this.flag = flag;
		this.parent = parent;
		this.children = children;
		this.rootNode = rootNode;
		this.position = position;
		this.initialPosition = position;
		this.quat = quat;
		this.scale = scale;
		this.transform = transform;
		this.mesh = mesh;
		this.skin = skin;
		this.minValues = minValues;
		this.maxValues = maxValues;
		this._mass = mass;
		this._speed = speed;
		this.hasBoundingBox = hasBoundingBox;
		this.isBB = isBB;
		this.hasPhysics = hasPhysics;
		this.hidden = hidden;
		this.hideShadow = hideShadow;
		this.objectClass = objectClass;
		this.maxRadius = maxRadius;
		this.turnSpeed = turnSpeed;
		this.previousPosition = vec3.fromValues(...this.position);
		this.targetPosition = position;
	}

	update(position: Vec3) {
		this.transform = mat4.create();

		mat4.translation(position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);
	}

	set_direction_vectors() {
		this.forward = vec3.normalize(vec3.transformQuat([0, 0, -1], this.quat));
		this.forwardMove = vec3.normalize(vec3.create(this.forward[0], 0, this.forward[2]));

		this.right = vec3.normalize(vec3.cross(this.forward, [0, 1, 0]));
		this.rightMove = vec3.normalize(vec3.create(this.right[0], 0, this.right[2]));

		this.up = vec3.normalize(vec3.cross(this.right, this.forward));
	}

	move(dir: Vec3, mult: number = 1) {
		const amt = this.speed * window.myLib.deltaTime * 0.01 * mult;
		this.position = vec3.addScaled(this.position, dir, amt);
	}

	move_forward(speedMult: number = 1) {
		const amt = this.speed * window.myLib.deltaTime * 0.01 * speedMult;
		this.position = vec3.addScaled(this.position, vec3.negate(this.forward), amt);
	}

	spin_to(yaw: number) {
		this.quat = quat.fromEuler(0, yaw + Math.PI, 0, 'yxz');
	}

	spin_lerp(endDir: Vec3) {
		let spinAmt: number = this.turnSpeed * window.myLib.deltaTime;

		vec3.mulScalar(endDir, -1, endDir);

		const sign: number = -Math.sign(vec3.cross(endDir, this.forwardMove)[1]);
		const angleToTurn: number = vec3.angle(endDir, this.forwardMove);

		if (angleToTurn <= spinAmt + 1) spinAmt *= angleToTurn * 0.8;

		// quat.rotateY(this.quat, sign * spinAmt, this.quat);

		const rotationQuat: Quat = quat.fromAxisAngle([0, 1, 0], sign * spinAmt);
		this.quat = quat.normalize(quat.mul(rotationQuat, this.quat));
	}

	rotate_lerp(endDir: Vec3) {
		const currentQuat = this.quat;
		const targetQuat = computeTargetQuat(endDir);

		// Compute the angle between current and target quaternions
		const dot = quat.dot(currentQuat, targetQuat);
		const totalAngle = 2 * Math.acos(Math.min(Math.abs(dot), 1));

		// If already aligned, snap to target and exit
		if (totalAngle < 1e-6) {
			this.quat = targetQuat;
			return;
		}

		// Calculate the rotation amount per frame
		let spinAmt = this.turnSpeed * window.myLib.deltaTime;

		// Prevent overshooting, similar to the original yaw-only logic
		if (totalAngle <= spinAmt + 1) {
			spinAmt *= totalAngle * 0.8;
		}

		// Compute interpolation parameter
		const t = spinAmt / totalAngle;

		// Interpolate between current and target quaternions
		this.quat = quat.slerp(currentQuat, targetQuat, t);
	}

	rotateAroundPoint(angleRad: number, axis: Vec3, pivot: Vec3) {
		const translateToOrigin: Mat4 = mat4.translation(vec3.negate(pivot));
		const translatedPosition: Vec3 = vec3.transformMat4(this.position, translateToOrigin);
		const rotationMatrix: Mat4 = mat4.rotation(axis, angleRad);
		const rotatedPosition: Vec3 = vec3.transformMat4(translatedPosition, rotationMatrix);
		const translateBack: Mat4 = mat4.translation(pivot);
		const rotationQuat: Quat = quat.fromAxisAngle(axis, angleRad);

		this.position = vec3.transformMat4(rotatedPosition, translateBack);
		this.quat = quat.mul(rotationQuat, this.quat);
	}

	get currentVelocity() {
		if (this.rootNode === null) return this._currentVelocity;
		else return nodes[this.rootNode]._currentVelocity;
	}

	get currentSpeed() {
		if (this.rootNode === null) return this._currentSpeed;
		else return nodes[this.rootNode]._currentSpeed;
	}

	get mass() {
		if (this.rootNode === null) return this._mass;
		else return nodes[this.rootNode]._mass;
	}

	get speed() {
		if (this.rootNode === null) return this._speed;
		else return nodes[this.rootNode]._speed;
	}

	set_current_velocity() {
		if (this.rootNode === null) {
			const moveDir: Vec3 = vec3.normalize(vec3.sub(this.position, this.previousPosition));
			this._currentVelocity = vec3.scale(moveDir, this.speed);
			this._currentSpeed = Math.abs(vec3.dist(this.position, this.previousPosition));
		}
	}

	apply_gravity() {
		if (this.rootNode === null && this.name !== 'Terrain' && this.hasPhysics) {
			const posTemp: Vec3 = vec3.fromValues(...this.position);
			this.gravitySpeed += this.gravityAcc * window.myLib.deltaTime;
			this.position[1] -= this.gravitySpeed * window.myLib.deltaTime;

			if (terrainHeightMap && this.terrainNodeIndex >= 0) this.limit_height_to_terrain();

			if (this.position[1] < 0) {
				this.position[1] = 0;
				this.inAir = false;
			}

			const dropVeocity: Vec3 = vec3.sub(this.position, posTemp);
			this._currentVelocity = vec3.add(this._currentVelocity, dropVeocity);
		}
	}

	jump() {
		if (!this.inAir) {
			this.gravitySpeed = -0.007;
			this.inAir = true;
		}
	}

	limit_height_to_terrain(): void {
		if (this.name === 'Terrain' && !this.hidden) return;

		const mapLength: number = nodes[this.terrainNodeIndex].max[0] - nodes[this.terrainNodeIndex].min[0];
		const mapWidth: number = nodes[this.terrainNodeIndex].max[2] - nodes[this.terrainNodeIndex].min[2];

		const nFractAlongMeshX: number = (this.position[0] - nodes[this.terrainNodeIndex].min[0]) / mapLength;
		const nFractAlongMeshY: number = (this.position[2] - nodes[this.terrainNodeIndex].min[2]) / mapWidth;

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

		const terrainHeight: number = bilinearInterpolation(
			pLocInMapContextX,
			pLocInMapContextY,
			interpolationPoints[0],
			interpolationPoints[1],
			interpolationPoints[2],
			interpolationPoints[3]
		);

		// const terrainHeight2 = getPixel(terrainHeightMap, yIndex, xIndex, terrainHeightMapSize) ?? -Infinity;

		const terrainHeightAbovePlayer: number = terrainHeight - this.position[1];

		if (terrainHeightAbovePlayer >= -0.15 && this.gravitySpeed >= 0) {
			// If node has intersected with terrain

			// if (terrainHeightAbovePlayer < this.terrainStepAmt || this._currentSpeed === 0) {
			// 	// If player-terrain deltaY is less than stepAmt
			// 	this.position[1] = terrainHeight;
			// } else {
			// 	this.position = this.previousPosition;
			// }

			this.position[1] = terrainHeight;

			this.inAir = false;
		} else this.inAir = true;
	}

	reset_gravity() {
		if (this.rootNode === null) {
			this.gravitySpeed = 0;
		} else {
			nodes[this.rootNode].gravitySpeed = 0;
		}
	}

	set_previous_position() {
		if (this.rootNode === null) this.previousPosition = vec3.fromValues(...this.position);
	}

	initialize_bounding_boxes() {
		if (!this.hasBoundingBox || !this.min?.length || !this.max?.length) return;

		if (globalToggles.showOBBs) {
			this.OBBBuffer = this.device.createBuffer({
				label: `${this.name} node OBBBuffer`,
				size: 4 * 36 * 3,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});

			this.initialOBBMesh = getAABBverticesFromMinMax(this.min, this.max);
		}

		if (globalToggles.showAABBs) {
			this.AABBBuffer = this.device.createBuffer({
				label: `${this.name} node AABBBuffer`,
				size: 4 * 36 * 3,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});
		}

		this.initialOBB = {
			vertices: new Array(8),
			normals: new Array(6),
		};

		this.OBB = {
			vertices: new Array(8),
			normals: new Array(6),
		};

		this.setInitialOOB();

		this.OBB.vertices = [...this.initialOBB.vertices];
		this.OBB.normals = [...this.initialOBB.normals];

		this.AABB = {
			min: null,
			max: null,
		};

		this.preTransformed = false;
	}

	setInitialOOB() {
		this.initialOBB.vertices[0] = vec3.create(this.min[0], this.min[1], this.min[2]);
		this.initialOBB.vertices[1] = vec3.create(this.max[0], this.min[1], this.min[2]);
		this.initialOBB.vertices[2] = vec3.create(this.max[0], this.max[1], this.min[2]);
		this.initialOBB.vertices[3] = vec3.create(this.min[0], this.max[1], this.min[2]);
		this.initialOBB.vertices[4] = vec3.create(this.min[0], this.min[1], this.max[2]);
		this.initialOBB.vertices[5] = vec3.create(this.max[0], this.min[1], this.max[2]);
		this.initialOBB.vertices[6] = vec3.create(this.max[0], this.max[1], this.max[2]);
		this.initialOBB.vertices[7] = vec3.create(this.min[0], this.max[1], this.max[2]);

		this.initialOBB.normals[0] = vec3.create(-1, 0, 0);
		this.initialOBB.normals[1] = vec3.create(1, 0, 0);
		this.initialOBB.normals[2] = vec3.create(0, -1, 0);
		this.initialOBB.normals[3] = vec3.create(0, 1, 0);
		this.initialOBB.normals[4] = vec3.create(0, 0, -1);
		this.initialOBB.normals[5] = vec3.create(0, 0, 1);
	}

	async setBoundingBoxes() {
		if (!this.initialOBB) return;

		// if (!this.preTransformed && this.parent !== null) this.transform_to_local_space();

		this.transformOBB(this.globalTransform, [...this.initialOBB.vertices], true);
		this.transformOBB(this.normalTransform, [...this.initialOBB.normals], false);

		const minMax = this.getMinMax([...this.OBB.vertices]);

		this.AABB.min = minMax.min;
		this.AABB.max = minMax.max;

		// Only if debugging
		if (globalToggles.showOBBs) {
			const obbMesh = this.getTransformedOBBMesh([...this.initialOBBMesh]);
			await this.updateOBBBuffer(obbMesh);
		}

		if (globalToggles.showAABBs) {
			const AABBMesh = getAABBverticesFromMinMax(minMax.min, minMax.max);
			await this.updateAABBBuffer(AABBMesh);
		}
	}

	transformOBB(transform: Mat4, vertices: Vec3[], arePositions: boolean) {
		for (let i = 0; i < vertices.length; i++) {
			const v: Vec3 = vertices[i];
			const newV: Vec3 = vec3.transformMat4(v, transform);
			if (arePositions) this.OBB.vertices[i] = newV;
			else this.OBB.normals[i] = vec3.normalize(newV);
		}
	}

	getMinMax(values: Vec3[]): { min: Vec3; max: Vec3 } {
		let minX: number = Infinity;
		let minY: number = Infinity;
		let minZ: number = Infinity;

		let maxX: number = -Infinity;
		let maxY: number = -Infinity;
		let maxZ: number = -Infinity;

		for (let i = 0; i < values.length; i++) {
			const x: number = values[i][0];
			const y: number = values[i][1];
			const z: number = values[i][2];

			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (z < minZ) minZ = z;

			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;
			if (z > maxZ) maxZ = z;
		}

		return {
			min: vec3.create(minX, minY, minZ),
			max: vec3.create(maxX, maxY, maxZ),
		};
	}

	getTransformedOBBMesh(OBBMesh: number[]): Float32Array {
		const newOBBMesh = new Float32Array(36 * 3);
		for (let i = 0; i < OBBMesh.length / 3; i++) {
			const pos: number[] = OBBMesh.slice(i * 3, i * 3 + 3);
			const newPos: Vec3 = vec3.transformMat4(pos, this.globalTransform);
			newOBBMesh[i * 3] = newPos[0];
			newOBBMesh[i * 3 + 1] = newPos[1];
			newOBBMesh[i * 3 + 2] = newPos[2];
		}

		return newOBBMesh;
	}

	async updateOBBBuffer(data: Float32Array) {
		const stagingBuffer = this.device.createBuffer({
			size: 4 * 36 * 3,
			usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
		});

		await stagingBuffer.mapAsync(GPUMapMode.WRITE);
		new Float32Array(stagingBuffer.getMappedRange()).set(data);
		stagingBuffer.unmap();

		const commandEncoder = this.device.createCommandEncoder();
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.OBBBuffer, 0, stagingBuffer.size);
		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);
	}

	async updateAABBBuffer(data: Float32Array) {
		const stagingBuffer = this.device.createBuffer({
			size: 4 * 36 * 3,
			usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
		});

		await stagingBuffer.mapAsync(GPUMapMode.WRITE);
		new Float32Array(stagingBuffer.getMappedRange()).set(data);
		stagingBuffer.unmap();

		const commandEncoder = this.device.createCommandEncoder();
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.AABBBuffer, 0, stagingBuffer.size);
		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);
	}

	transform_to_local_space() {
		const t: Mat4 = mat4.inverse(this.globalTransform);

		for (let j = 0; j < this.initialOBB.vertices.length; j++) {
			this.initialOBB.vertices[j] = vec3.transformMat4(this.initialOBB.vertices[j], t);
		}

		if (globalToggles.showOBBs) {
			for (let j = 0; j < this.initialOBBMesh.length / 3; j++) {
				const v: Vec3 = this.initialOBBMesh.slice(j * 3, j * 3 + 3);
				const newPos: Vec3 = vec3.transformMat4(v, t);
				this.initialOBBMesh[j * 3] = newPos[0];
				this.initialOBBMesh[j * 3 + 1] = newPos[1];
				this.initialOBBMesh[j * 3 + 2] = newPos[2];
			}
		}

		this.preTransformed = true;
	}
}
