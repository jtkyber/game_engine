import { Mat4, Quat, Vec3, mat4, quat, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../../types/enums';
import { transformPosition } from '../../utils/matrix';
import { getAABBverticesFromMinMax } from '../../utils/misc';
import GLTFMesh from './mesh';
import GLTFSkin from './skin';

export default class GLTFNode {
	device: GPUDevice;
	name: string;
	flag: moveableFlag;
	parent: number = null;
	position: Vec3;
	quat: Quat;
	scale: Vec3;
	transform: Mat4;
	mesh: GLTFMesh = null;
	skin: GLTFSkin = null;
	initialOBBs: Float32Array[] = null;
	OBBs: Float32Array[] = null;
	AABBs: Float32Array[] = null;

	// For debug
	initialOBBMeshes: Float32Array[] = null;
	OBBBufferArray: GPUBuffer[] = null;
	AABBBufferArray: GPUBuffer[] = null;

	constructor(
		device: GPUDevice,
		name: string,
		flag: any,
		parent: number,
		position: Vec3,
		quat: Quat,
		scale: Vec3,
		transform: Mat4,
		mesh: GLTFMesh,
		skin: GLTFSkin,
		minValues: Vec3[],
		maxValues: Vec3[]
	) {
		this.device = device;
		this.name = name;
		this.flag = flag;
		this.parent = parent;
		this.position = position;
		this.quat = quat;
		this.scale = scale;
		this.transform = transform;
		this.mesh = mesh;
		this.skin = skin;

		if (minValues?.length && maxValues?.length) {
			this.initialOBBMeshes = new Array(minValues.length);
			this.OBBBufferArray = new Array(minValues.length);
			this.initialOBBs = new Array(minValues.length);
			this.OBBs = new Array(minValues.length);
			this.AABBs = new Array(minValues.length);
			this.AABBBufferArray = new Array(minValues.length);

			for (let i = 0; i < minValues.length; i++) {
				this.OBBBufferArray[i] = device.createBuffer({
					label: `${name} node OBBBuffer`,
					size: 4 * 36 * 3,
					usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				});
				this.AABBBufferArray[i] = device.createBuffer({
					label: `${name} node AABBBuffer`,
					size: 4 * 36 * 3,
					usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
				});
				const min: Vec3 = minValues[i];
				const max: Vec3 = maxValues[i];

				this.initialOBBs[i] = new Float32Array(8 * 3);
				this.initialOBBMeshes[i] = getAABBverticesFromMinMax(min, max);

				this.OBBs[i] = new Float32Array(8 * 3);
				this.AABBs[i] = new Float32Array(8 * 3);

				this.initialOBBs[i].set([min[0], min[1], min[2]], 0);
				this.initialOBBs[i].set([min[0], min[1], max[2]], 3);
				this.initialOBBs[i].set([min[0], max[1], min[2]], 6);
				this.initialOBBs[i].set([min[0], max[1], max[2]], 9);
				this.initialOBBs[i].set([max[0], min[1], min[2]], 12);
				this.initialOBBs[i].set([max[0], min[1], max[2]], 15);
				this.initialOBBs[i].set([max[0], max[1], min[2]], 18);
				this.initialOBBs[i].set([max[0], max[1], max[2]], 21);
			}
		}
	}

	update() {
		this.transform = mat4.create();

		mat4.translation(this.position, this.transform);

		const rotFromQuat = quat.toAxisAngle(this.quat);
		mat4.rotate(this.transform, rotFromQuat.axis, rotFromQuat.angle, this.transform);

		mat4.scale(this.transform, this.scale, this.transform);
	}

	async setBoundingBoxes(transform: Mat4) {
		if (!this.initialOBBMeshes) return;

		for (let i = 0; i < this.initialOBBMeshes.length; i++) {
			this.transformOBB(transform, [...this.initialOBBs[i]], i);

			const minMax = this.getMinMax([...this.OBBs[i]]);
			const min: Vec3 = minMax.min;
			const max: Vec3 = minMax.max;

			this.AABBs[i].set([min[0], min[1], min[2]], 0);
			this.AABBs[i].set([min[0], min[1], max[2]], 3);
			this.AABBs[i].set([min[0], max[1], min[2]], 6);
			this.AABBs[i].set([min[0], max[1], max[2]], 9);
			this.AABBs[i].set([max[0], min[1], min[2]], 12);
			this.AABBs[i].set([max[0], min[1], max[2]], 15);
			this.AABBs[i].set([max[0], max[1], min[2]], 18);
			this.AABBs[i].set([max[0], max[1], max[2]], 21);

			// Only if debugging
			const obbMesh = this.getTransformedOBBMesh(transform, [...this.initialOBBMeshes[i]]);
			await this.updateOBBBuffer(obbMesh, i);

			const AABBMesh = getAABBverticesFromMinMax(minMax.min, minMax.max);
			await this.updateAABBBuffer(AABBMesh, i);
		}
	}

	transformOBB(transform: Mat4, OBB: number[], index: number) {
		for (let i = 0; i < OBB.length / 3; i++) {
			const pos: number[] = OBB.slice(i * 3, i * 3 + 3);
			const newPos: Vec3 = transformPosition(pos, transform);
			this.OBBs[index][i * 3] = newPos[0];
			this.OBBs[index][i * 3 + 1] = newPos[1];
			this.OBBs[index][i * 3 + 2] = newPos[2];
		}
	}

	getMinMax(values: number[]): { min: Vec3; max: Vec3 } {
		let minX: number = Infinity;
		let minY: number = Infinity;
		let minZ: number = Infinity;

		let maxX: number = -Infinity;
		let maxY: number = -Infinity;
		let maxZ: number = -Infinity;

		for (let i = 0; i < values.length / 3; i++) {
			const x: number = values[i * 3];
			const y: number = values[i * 3 + 1];
			const z: number = values[i * 3 + 2];

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
}
