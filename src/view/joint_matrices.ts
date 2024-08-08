import { Mat4, mat4 } from 'wgpu-matrix';
import { IModelNodeChunks, IModelNodeIndices } from '../types/gltf';
import { nodes } from './gltf/loader';
import GLTFNode from './gltf/node';
import shader from './shaders/compute/joint_matrices.wgsl';

// For single model
export default class JointMatrices {
	device: GPUDevice;
	shaderModule: GPUShaderModule;
	jointMatricesBufferList: GPUBuffer[] = [];

	// Matrices sizes
	inverseBindMatricesSize: number;
	inverseGlobalTransformSize: number;
	globalJointTransformsSize: number;

	// Buffers
	inverseBindMatricesBuffer: GPUBuffer;
	inverseGlobalTransformBuffer: GPUBuffer;
	globalJointTransformsBuffer: GPUBuffer;
	resultBuffer: GPUBuffer;

	// Pipeline
	pipeline: GPUComputePipeline;
	bindGroupLayout: GPUBindGroupLayout;
	bindGroup: GPUBindGroup;

	constructor(device: GPUDevice) {
		this.device = device;
		this.shaderModule = <GPUShaderModule>this.device.createShaderModule({ label: 'shader', code: shader });
	}

	get_joint_matrices(modelNodeChunks: IModelNodeChunks, modelTransforms: Float32Array): GPUBuffer[] {
		const modelIndices: IModelNodeIndices[] = modelNodeChunks.opaque.concat(modelNodeChunks.transparent);
		this.jointMatricesBufferList = [];
		this.createBindGroupLayouts();

		let count: number = 0;
		for (let i = 0; i < modelIndices.length; i++) {
			const nodeIndex: number = modelIndices[i].nodeIndex;
			const node: GLTFNode = nodes[nodeIndex];
			if (!node.skin) {
				this.jointMatricesBufferList.push(null);
				continue;
			}

			this.setInverseBindMatricesForModel(node);

			this.setInverseGlobalTransformForModel(nodeIndex, modelTransforms);

			this.setGlobalJointTransformsForModel(node, modelTransforms);

			this.resultBuffer = this.device.createBuffer({
				label: 'resultBuffer',
				size: 16 * 4 * node.skin.joints.length,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
			});

			this.createBindGroup();
			this.createPipeline();
			this.compute(node.skin.inverseBindMatrices.elementCount);
			count++;
		}

		return this.jointMatricesBufferList;
	}

	setInverseBindMatricesForModel(node: GLTFNode) {
		this.inverseBindMatricesBuffer = node.skin.inverseBindMatrices.bufferView.gpuBuffer;
	}

	setInverseGlobalTransformForModel(nodeIndex: number, modelTransforms: Float32Array) {
		const globalTransform: Mat4 = modelTransforms.slice(16 * nodeIndex, 16 * nodeIndex + 16);
		const inverseGlobalTransform: Mat4 = mat4.inverse(globalTransform);

		this.inverseGlobalTransformBuffer = this.device.createBuffer({
			label: 'inverseGlobalTransformBuffer',
			size: 16 * 4,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(this.inverseGlobalTransformBuffer, 0, inverseGlobalTransform);
	}

	setGlobalJointTransformsForModel(node: GLTFNode, modelTransforms: Float32Array) {
		const globalJointTransformArr: Float32Array = new Float32Array(16 * node.skin.joints.length);
		for (let j = 0; j < node.skin.joints.length; j++) {
			const jointNodeIndex: number = node.skin.joints[j];
			const globalJointTransform: Mat4 = modelTransforms.slice(16 * jointNodeIndex, 16 * jointNodeIndex + 16);

			for (let k = 0; k < 16; k++) globalJointTransformArr[j * 16 + k] = globalJointTransform[k];
		}

		this.globalJointTransformsBuffer = this.device.createBuffer({
			label: 'globalJointTransformsBuffer',
			size: globalJointTransformArr.byteLength,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(this.globalJointTransformsBuffer, 0, globalJointTransformArr);
	}

	createBindGroupLayouts() {
		this.bindGroupLayout = this.device.createBindGroupLayout({
			label: 'Joint Matrices Bind Group Layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					},
				},
				{
					binding: 2,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'read-only-storage',
					},
				},
				{
					binding: 3,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'storage',
					},
				},
			],
		});
	}

	createBindGroup() {
		this.bindGroup = this.device.createBindGroup({
			label: 'Joint Matrices Bind Group',
			layout: this.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.inverseBindMatricesBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.inverseGlobalTransformBuffer,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.globalJointTransformsBuffer,
					},
				},
				{
					binding: 3,
					resource: {
						buffer: this.resultBuffer,
					},
				},
			],
		});
	}

	createPipeline() {
		this.pipeline = this.device.createComputePipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			compute: {
				module: this.shaderModule,
				entryPoint: 'main',
			},
		});
	}

	async compute(elementCount: number) {
		const commandEncoder = this.device.createCommandEncoder();
		const computePass = commandEncoder.beginComputePass({ label: 'jointMatricesComputePass' });
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroup);
		computePass.dispatchWorkgroups(Math.ceil(elementCount / 64), 1, 1);
		computePass.end();

		const gpuReadBuffer = this.device.createBuffer({
			size: this.resultBuffer.size,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
		});

		// const gpuReadBuffer = this.device.createBuffer({
		// 	size: this.resultBuffer.size,
		// 	usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		// });

		commandEncoder.copyBufferToBuffer(this.resultBuffer, 0, gpuReadBuffer, 0, this.resultBuffer.size);

		this.device.queue.submit([commandEncoder.finish()]);

		this.jointMatricesBufferList.push(gpuReadBuffer);

		// await gpuReadBuffer.mapAsync(GPUMapMode.READ);
		// const arrayBuffer = gpuReadBuffer.getMappedRange();
		// console.log(new Float32Array(arrayBuffer));
	}
}
