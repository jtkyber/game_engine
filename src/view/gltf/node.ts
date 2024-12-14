import { Mat4, Quat, Vec3, mat4, quat, vec3 } from 'wgpu-matrix';
import { debugging } from '../../control/app';
import { Flag } from '../../types/enums';
import { IAABB, IOBB } from '../../types/types';
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
	_currentSpeed: number = 0;
	_currentVelocity: Vec3 = vec3.create(0, 0, 0);
	turnSpeed: number = 0.008;
	initialOBB: IOBB = null;
	OBB: IOBB = null;
	AABB: IAABB = null;
	height: number;
	previousPosition: Vec3;
	preTransformed: boolean;
	terrainNodeIndex: number = null;

	// For debug
	initialOBBMesh: Float32Array = null;
	OBBBuffer: GPUBuffer = null;
	AABBBuffer: GPUBuffer = null;

	gravitySpeedStart: number = 0;
	gravitySpeed: number = 0;
	gravityAcc: number = 0.0006;

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
		hidden: boolean
	) {
		this.device = device;
		this.name = name;
		this.flag = flag;
		this.parent = parent;
		this.children = children;
		this.rootNode = rootNode;
		this.position = position;
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
		this.previousPosition = vec3.fromValues(...this.position);
	}

	update() {
		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

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

	move(dir: Vec3, mult: number) {
		const amt = this.speed * window.myLib.deltaTime * 0.01 * mult;
		this.position = vec3.addScaled(this.position, dir, amt);
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

		quat.rotateY(this.quat, sign * spinAmt, this.quat);
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
			this.gravitySpeed += this.gravityAcc;
			this.position[1] -= this.gravitySpeed * window.myLib.deltaTime;
			if (terrainHeightMap && this.terrainNodeIndex >= 0) this.limit_height_to_terrain();
			if (this.position[1] < 0) this.position[1] = 0;
			const dropVeocity: Vec3 = vec3.sub(this.position, posTemp);
			this._currentVelocity = vec3.add(this._currentVelocity, dropVeocity);
		}
	}

	limit_height_to_terrain(): void {
		if (this.name === 'Terrain' && !this.hidden) return;

		const mapLength: number = nodes[this.terrainNodeIndex].max[0] - nodes[this.terrainNodeIndex].min[0];
		const mapWidth: number = nodes[this.terrainNodeIndex].max[2] - nodes[this.terrainNodeIndex].min[2];

		const nFractAlongMeshX: number = (this.position[0] - nodes[this.terrainNodeIndex].min[0]) / mapLength;
		const nFractAlongMeshY: number = (this.position[2] - nodes[this.terrainNodeIndex].min[2]) / mapWidth;

		const col: number = Math.floor(nFractAlongMeshX * (terrainHeightMapSize - 1));
		const row: number = Math.floor(nFractAlongMeshY * (terrainHeightMapSize - 1));

		const terrainHeight = getPixel(terrainHeightMap, row, col, terrainHeightMapSize) ?? -Infinity;

		const terrainHeightAbovePlayer: number = terrainHeight - this.position[1];

		if (terrainHeightAbovePlayer > 0) {
			if (terrainHeightAbovePlayer < 0.4) this.position[1] = terrainHeight;
			else this.position = this.previousPosition;
			this.reset_gravity();
		}
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

		if (debugging.showOBBs) {
			this.OBBBuffer = this.device.createBuffer({
				label: `${this.name} node OBBBuffer`,
				size: 4 * 36 * 3,
				usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			});

			this.initialOBBMesh = getAABBverticesFromMinMax(this.min, this.max);
		}

		if (debugging.showAABBs) {
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
		if (debugging.showOBBs) {
			const obbMesh = this.getTransformedOBBMesh([...this.initialOBBMesh]);
			await this.updateOBBBuffer(obbMesh);
		}

		if (debugging.showAABBs) {
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

		if (debugging.showOBBs) {
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
