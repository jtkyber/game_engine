export class GLTFBuffer {
	buffer: Uint8Array;
	offset: number;
	size: number;

	constructor(buffer: ArrayBuffer, offset: number, size: number) {
		this.buffer = new Uint8Array(buffer, offset, size);
		this.offset = offset;
		this.size = size;
	}
}
