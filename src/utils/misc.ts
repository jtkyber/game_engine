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
