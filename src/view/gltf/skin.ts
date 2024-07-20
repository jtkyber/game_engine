import GLTFAccessor from './accessor';

export default class GLTFSkin {
	name: string;
	inverseBindMatrices: GLTFAccessor;
	joints: number[];
	jointMatricesBuffer: GPUBuffer;
	jointBindGroupLayout: GPUBindGroupLayout;
	jointBindGroup: GPUBindGroup;

	constructor(name: string, inverseBindMatrices: GLTFAccessor, joints: number[]) {
		this.name = name;
		this.inverseBindMatrices = inverseBindMatrices;
		this.joints = joints;

		this.inverseBindMatrices.bufferView.needsUpload = true;
		this.inverseBindMatrices.bufferView.addUsage(GPUBufferUsage.STORAGE);
	}

	upload(device: GPUDevice) {
		this.jointBindGroupLayout = device.createBindGroupLayout({
			entries: [
				{
					// Joint matrices
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
					},
				},
			],
		});

		this.jointMatricesBuffer = device.createBuffer({
			label: 'jointMatricesBuffer',
			size: 4 * 16 * this.joints.length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.jointBindGroup = device.createBindGroup({
			layout: this.jointBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.jointMatricesBuffer,
					},
				},
			],
		});
	}
}
