import { Mat4, mat4, quat, Quat, vec3, Vec3 } from 'wgpu-matrix';
import GLTFNode from '../view/gltf/node';

const statusDiv: HTMLElement = document.getElementById('status');

export async function logGPUBufferValues(buffer: GPUBuffer) {
	await buffer.mapAsync(GPUMapMode.READ, 0, buffer.size);
	const arr = new Float32Array(buffer.getMappedRange(0, buffer.size));
	buffer.unmap();
	console.log(arr);
}

export async function getGPUBufferValues(buffer: GPUBuffer) {
	await buffer.mapAsync(GPUMapMode.READ, 0, buffer.size);
	const arr = new Float32Array(buffer.getMappedRange(0, buffer.size));
	buffer.unmap();
	return arr;
}

export function getAABBverticesFromMinMax(min: Vec3, max: Vec3): Float32Array {
	const values = new Float32Array(36 * 3);

	values.set([min[0], min[1], min[2]], 0);
	values.set([max[0], min[1], min[2]], 3);
	values.set([min[0], max[1], min[2]], 6);
	values.set([max[0], min[1], min[2]], 9);
	values.set([max[0], max[1], min[2]], 12);
	values.set([min[0], max[1], min[2]], 15);

	values.set([min[0], min[1], max[2]], 18);
	values.set([min[0], max[1], max[2]], 21);
	values.set([max[0], min[1], max[2]], 24);
	values.set([max[0], min[1], max[2]], 27);
	values.set([min[0], max[1], max[2]], 30);
	values.set([max[0], max[1], max[2]], 33);

	values.set([min[0], max[1], min[2]], 36);
	values.set([min[0], max[1], max[2]], 39);
	values.set([max[0], max[1], min[2]], 42);
	values.set([max[0], max[1], min[2]], 45);
	values.set([min[0], max[1], max[2]], 48);
	values.set([max[0], max[1], max[2]], 51);

	values.set([min[0], min[1], min[2]], 54);
	values.set([max[0], min[1], min[2]], 57);
	values.set([min[0], min[1], max[2]], 60);
	values.set([max[0], min[1], min[2]], 63);
	values.set([max[0], min[1], max[2]], 66);
	values.set([min[0], min[1], max[2]], 69);

	values.set([min[0], min[1], min[2]], 72);
	values.set([min[0], min[1], max[2]], 75);
	values.set([min[0], max[1], min[2]], 78);
	values.set([min[0], max[1], min[2]], 81);
	values.set([min[0], min[1], max[2]], 84);
	values.set([min[0], max[1], max[2]], 87);

	values.set([max[0], min[1], min[2]], 90);
	values.set([max[0], max[1], min[2]], 93);
	values.set([max[0], min[1], max[2]], 96);
	values.set([max[0], min[1], max[2]], 99);
	values.set([max[0], max[1], min[2]], 102);
	values.set([max[0], max[1], max[2]], 105);

	return values;
}

export function getPixel(data: Float32Array, row: number, col: number, textureSize: number): number {
	if (row >= 0 && row < textureSize && col >= 0 && col < textureSize) {
		const index = row * textureSize + col;
		return data[index];
	}
	return null;
}

export function timeToQuat(timeString: string): Quat {
	const [hours, minutes] = timeString.split(':').map(Number);
	let totalHours = hours + minutes / 60;

	if (totalHours >= 24) totalHours -= 24;
	if (totalHours < 0) totalHours += 24;

	let hourAngle = (totalHours / 24) * (2 * Math.PI);

	const qw = Math.cos(hourAngle / 2);
	const qz = Math.sin(hourAngle / 2);

	return quat.create(0, 0, -qw, qz);
}

export function newStatus(msg: string) {
	const newMsg: HTMLElement = document.createElement('h5');
	newMsg.innerText = msg;
	statusDiv.appendChild(newMsg);
	statusDiv.scrollTop = statusDiv.scrollHeight;
}
