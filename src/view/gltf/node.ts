import { Mat4, Quat, Vec3, Vec4, mat4, quat, vec3 } from 'wgpu-matrix';
import { debugging } from '../../control/app';
import { Flag } from '../../types/enums';
import { typedArrayFromComponentType } from '../../types/gltf';
import { IAABB, IOBB, TypedArray } from '../../types/types';
import { transformPosition } from '../../utils/matrix';
import { getAABBverticesFromMinMax, getPixel } from '../../utils/misc';
import GLTFAccessor from './accessor';
import { nodes, terrainHeightMap, terrainHeightMapSize } from './loader';
import GLTFMesh from './mesh';
import GLTFSkin from './skin';

export default class GLTFNode {
	device: GPUDevice;
	name: string;
	flag: Flag;
	parent: number = null;
	rootNode: number;
	position: Vec3;
	quat: Quat;
	scale: Vec3;
	transform: Mat4;
	globalTransform: Mat4;
	mesh: GLTFMesh = null;
	skin: GLTFSkin = null;
	minValues: Vec3[];
	maxValues: Vec3[];
	_mass: number = null;
	_speed: number = null;
	hasBoundingBox: boolean = true;
	_currentSpeed: number = 0;
	_currentVelocity: Vec3 = vec3.create(0, 0, 0);
	turnSpeed: number = 0.012;
	initialOBBs: IOBB[] = null;
	OBBs: IOBB[] = null;
	AABBs: IAABB[] = null;
	height: number;
	previousPosition: Vec3;
	preTransformed: boolean[];
	terrainNodeIndex: number = null;

	// For debug
	initialOBBMeshes: Float32Array[] = null;
	OBBBufferArray: GPUBuffer[] = null;
	AABBBufferArray: GPUBuffer[] = null;

	gravitySpeedStart: number = 0;
	gravitySpeed: number = 0;
	gravityAcc: number = 0.01;

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
		hasBoundingBox: boolean
	) {
		this.device = device;
		this.name = name;
		this.flag = flag;
		this.parent = parent;
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
		this.previousPosition = vec3.fromValues(...this.position);

		if (hasBoundingBox && minValues?.length && maxValues?.length) {
			this.initialOBBMeshes = new Array(minValues.length);
			this.OBBBufferArray = new Array(minValues.length);
			this.initialOBBs = new Array(minValues.length);
			this.OBBs = new Array(minValues.length);
			this.AABBs = new Array(minValues.length);
			this.AABBBufferArray = new Array(minValues.length);
			this.preTransformed = new Array(minValues.length);

			for (let i = 0; i < minValues.length; i++) {
				const min = minValues[i];
				const max = maxValues[i];

				if (debugging.showOBBs) {
					this.OBBBufferArray[i] = device.createBuffer({
						label: `${name} node OBBBuffer`,
						size: 4 * 36 * 3,
						usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
					});

					this.initialOBBMeshes[i] = getAABBverticesFromMinMax(min, max);
				}

				if (debugging.showAABBs) {
					this.AABBBufferArray[i] = device.createBuffer({
						label: `${name} node AABBBuffer`,
						size: 4 * 36 * 3,
						usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
					});
				}

				this.initialOBBs[i] = {
					vertices: new Array(8),
					normals: new Array(6),
				};

				this.OBBs[i] = {
					vertices: new Array(8),
					normals: new Array(6),
				};

				this.setInitialOOB(i, min, max);

				this.OBBs[i].vertices = [...this.initialOBBs[i].vertices];
				this.OBBs[i].normals = [...this.initialOBBs[i].normals];

				this.AABBs[i] = {
					min: null,
					max: null,
				};

				this.preTransformed[i] = false;
			}

			this.height = this.getHeight(minValues, maxValues);
		}
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

	move(dir: Vec3) {
		const amt = this.speed * window.myLib.deltaTime;
		this.position = vec3.addScaled(this.position, dir, amt);
	}

	spin_lerp(endDir: Vec3) {
		let spinAmt: number = this.turnSpeed * window.myLib.deltaTime;

		vec3.mulScalar(endDir, -1, endDir);

		const sign: number = -Math.sign(vec3.cross(endDir, this.forwardMove)[1]);
		const angleToTurn: number = vec3.angle(endDir, this.forwardMove);

		if (angleToTurn <= spinAmt + 1) spinAmt *= angleToTurn * 0.8;

		quat.rotateY(this.quat, sign * spinAmt, this.quat);
	}

	getHeight(minValues: Vec3[], maxValues: Vec3[]): number {
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < minValues.length; i++) {
			if (minValues[i][1] < minY) minY = minValues[i][1];
			if (maxValues[i][1] > maxY) maxY = maxValues[i][1];
		}
		return maxY - minY;
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
		if (this.name === 'Terrain') return;

		if (this.rootNode === null) {
			const posTemp: Vec3 = vec3.fromValues(...this.position);
			this.gravitySpeed += this.gravityAcc;
			this.position[1] -= this.gravitySpeed;
			this.limit_height_to_terrain();
			const dropVeocity: Vec3 = vec3.sub(this.position, posTemp);
			this._currentVelocity = vec3.add(this._currentVelocity, dropVeocity);
		}
	}

	limit_height_to_terrain(): void {
		if (this.name === 'Terrain') return;

		const mapLength: number =
			nodes[this.terrainNodeIndex].maxValues[0][0] - nodes[this.terrainNodeIndex].minValues[0][0];
		const mapWidth: number =
			nodes[this.terrainNodeIndex].maxValues[0][2] - nodes[this.terrainNodeIndex].minValues[0][2];

		const nFractAlongMeshX: number =
			(this.position[0] - nodes[this.terrainNodeIndex].minValues[0][0]) / mapLength;
		const nFractAlongMeshY: number =
			(this.position[2] - nodes[this.terrainNodeIndex].minValues[0][2]) / mapWidth;

		const col: number = Math.floor(nFractAlongMeshX * (terrainHeightMapSize - 1));
		const row: number = Math.floor(nFractAlongMeshY * (terrainHeightMapSize - 1));

		const terrainHeight = getPixel(terrainHeightMap, row, col, terrainHeightMapSize) ?? -Infinity;
		const terrainHeightAbovePlayer: number = terrainHeight - this.position[1];

		if (terrainHeightAbovePlayer > 0) {
			if (terrainHeightAbovePlayer < 0.25) this.position[1] = terrainHeight;
			else this.position = this.previousPosition;
			this.reset_gravity();
		}
	}

	offset_root_position(offset: Vec3) {
		if (this.rootNode === null) {
			vec3.add(this.position, offset, this.position);
		} else {
			vec3.add(nodes[this.rootNode].position, offset, nodes[this.rootNode].position);
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

	setInitialOOB(i: number, min: Vec3, max: Vec3) {
		this.initialOBBs[i].vertices[0] = vec3.create(min[0], min[1], min[2]);
		this.initialOBBs[i].vertices[1] = vec3.create(max[0], min[1], min[2]);
		this.initialOBBs[i].vertices[2] = vec3.create(max[0], max[1], min[2]);
		this.initialOBBs[i].vertices[3] = vec3.create(min[0], max[1], min[2]);
		this.initialOBBs[i].vertices[4] = vec3.create(min[0], min[1], max[2]);
		this.initialOBBs[i].vertices[5] = vec3.create(max[0], min[1], max[2]);
		this.initialOBBs[i].vertices[6] = vec3.create(max[0], max[1], max[2]);
		this.initialOBBs[i].vertices[7] = vec3.create(min[0], max[1], max[2]);

		this.initialOBBs[i].normals[0] = vec3.create(-1, 0, 0);
		this.initialOBBs[i].normals[1] = vec3.create(1, 0, 0);
		this.initialOBBs[i].normals[2] = vec3.create(0, -1, 0);
		this.initialOBBs[i].normals[3] = vec3.create(0, 1, 0);
		this.initialOBBs[i].normals[4] = vec3.create(0, 0, -1);
		this.initialOBBs[i].normals[5] = vec3.create(0, 0, 1);
	}

	async setBoundingBoxes(transform: Mat4, normalTransform: Mat4) {
		if (!this.initialOBBs) return;

		for (let i = 0; i < this.initialOBBs.length; i++) {
			if (!this.preTransformed[i] && this.parent !== null) this.transform_to_local_space(transform, i);

			this.transformOBB(transform, [...this.initialOBBs[i].vertices], i, true);
			this.transformOBB(normalTransform, [...this.initialOBBs[i].normals], i, false);

			const minMax = this.getMinMax([...this.OBBs[i].vertices]);

			this.AABBs[i].min = minMax.min;
			this.AABBs[i].max = minMax.max;

			// Only if debugging
			if (debugging.showOBBs) {
				const obbMesh = this.getTransformedOBBMesh(transform, [...this.initialOBBMeshes[i]]);
				await this.updateOBBBuffer(obbMesh, i);
			}

			if (debugging.showAABBs) {
				const AABBMesh = getAABBverticesFromMinMax(minMax.min, minMax.max);
				await this.updateAABBBuffer(AABBMesh, i);
			}
		}
	}

	transformOBB(transform: Mat4, OBB: Vec3[], index: number, areVertices: boolean) {
		for (let i = 0; i < OBB.length; i++) {
			const v: Vec3 = OBB[i];
			const newV: Vec3 = transformPosition(v, transform);
			if (areVertices) this.OBBs[index].vertices[i] = newV;
			else this.OBBs[index].normals[i] = vec3.normalize(newV);
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

	getTransformedOBBMesh(transform: Mat4, OBBMesh: number[]): Float32Array {
		const newOBBMesh = new Float32Array(36 * 3);
		for (let i = 0; i < OBBMesh.length / 3; i++) {
			const pos: number[] = OBBMesh.slice(i * 3, i * 3 + 3);
			const newPos: Vec3 = transformPosition(pos, transform);
			newOBBMesh[i * 3] = newPos[0];
			newOBBMesh[i * 3 + 1] = newPos[1];
			newOBBMesh[i * 3 + 2] = newPos[2];
		}

		return newOBBMesh;
	}

	async updateOBBBuffer(data: Float32Array, i: number) {
		const stagingBuffer = this.device.createBuffer({
			size: 4 * 36 * 3,
			usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
		});

		await stagingBuffer.mapAsync(GPUMapMode.WRITE);
		new Float32Array(stagingBuffer.getMappedRange()).set(data);
		stagingBuffer.unmap();

		const commandEncoder = this.device.createCommandEncoder();
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.OBBBufferArray[i], 0, stagingBuffer.size);
		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);
	}

	async updateAABBBuffer(data: Float32Array, i: number) {
		const stagingBuffer = this.device.createBuffer({
			size: 4 * 36 * 3,
			usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
		});

		await stagingBuffer.mapAsync(GPUMapMode.WRITE);
		new Float32Array(stagingBuffer.getMappedRange()).set(data);
		stagingBuffer.unmap();

		const commandEncoder = this.device.createCommandEncoder();
		commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.AABBBufferArray[i], 0, stagingBuffer.size);
		const commandBuffer = commandEncoder.finish();
		this.device.queue.submit([commandBuffer]);
	}

	transform_to_local_space(transform: Mat4, i: number) {
		const t: Mat4 = mat4.inverse(transform);

		for (let j = 0; j < this.initialOBBs[i].vertices.length; j++) {
			this.initialOBBs[i].vertices[j] = transformPosition(this.initialOBBs[i].vertices[j], t);
		}

		if (debugging.showOBBs) {
			for (let j = 0; j < this.initialOBBMeshes[i].length / 3; j++) {
				const v: Vec3 = this.initialOBBMeshes[i].slice(j * 3, j * 3 + 3);
				const newPos: Vec3 = transformPosition(v, t);
				this.initialOBBMeshes[i][j * 3] = newPos[0];
				this.initialOBBMeshes[i][j * 3 + 1] = newPos[1];
				this.initialOBBMeshes[i][j * 3 + 2] = newPos[2];
			}
		}

		this.preTransformed[i] = true;
	}
}
