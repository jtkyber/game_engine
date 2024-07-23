import { IGLTFBufferView } from '../../types/gltf';
import { GLTFBuffer } from './buffer';

export default class GLTFBufferView {
	buffer: GLTFBuffer;
	view: Uint8Array;
	byteLength: number;
	byteStride: number;
	viewOffset: number;
	needsUpload: boolean;
	gpuBuffer: GPUBuffer;
	usage: number;

	constructor(buffer: GLTFBuffer, view: IGLTFBufferView) {
		this.buffer = buffer;
		this.byteLength = view['byteLength'];
		this.byteStride = 0;
		if (view['byteStride'] !== undefined) {
			this.byteStride = view['byteStride'];
		}

		if (view['byteOffset'] !== undefined) {
			this.viewOffset = view['byteOffset'];
		}
		this.view = buffer.buffer.subarray(this.viewOffset, this.viewOffset + this.byteLength);

		this.needsUpload = false;
		this.gpuBuffer = null;
		this.usage = 0;
	}

	addUsage(usage: number) {
		this.usage = this.usage | usage;
	}

	alignTo(val: number, align: number) {
		return Math.floor((val + align - 1) / align) * align;
	}

	upload(device: GPUDevice) {
		const buf: GPUBuffer = device.createBuffer({
			label: 'Buffer View Buffer',
			size: this.alignTo(this.view.byteLength, 4),
			usage: this.usage,
			mappedAtCreation: true,
		});

		new (<any>this.view.constructor)(buf.getMappedRange()).set(this.view);
		buf.unmap();
		this.gpuBuffer = buf;
		this.needsUpload = false;
	}
}
