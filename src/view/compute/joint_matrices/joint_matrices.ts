import { Mat4, mat4 } from 'wgpu-matrix';
import Model from '../../../model/model';
import { nodes } from '../../gltf/loader';
import GLTFNode from '../../gltf/node';
import shader from './joint_matrices.wgsl';

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

	get_joint_matrices(models: Model[], modelTransforms: Float32Array): GPUBuffer[] {
		this.jointMatricesBufferList = [];
		this.createBindGroupLayouts();

		for (let i = 0; i < models.length; i++) {
			const model: Model = models[i];
			const node: GLTFNode = nodes[model.nodeIndex];
			if (!node.skin) {
				this.jointMatricesBufferList.push(null);
				continue;
			}

			this.inverseBindMatricesBuffer = node.skin.inverseBindMatrices.bufferView.gpuBuffer;

			const globalTransform: Mat4 = modelTransforms.slice(16 * model.nodeIndex, 16 * model.nodeIndex + 16);
			const inverseGlobalTransform: Mat4 = mat4.inverse(globalTransform);
			this.inverseGlobalTransformBuffer = this.device.createBuffer({
				label: 'inverseGlobalTransformBuffer',
				size: 16 * 4,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			});
			this.device.queue.writeBuffer(this.inverseGlobalTransformBuffer, 0, inverseGlobalTransform);

			const globalJointTrasformArr: Float32Array = new Float32Array(16 * node.skin.joints.length);
			for (let j = 0; j < node.skin.joints.length; j++) {
				const jointNodeIndex: number = node.skin.joints[j];
				const globalJointTransform: Mat4 = modelTransforms.slice(
					16 * jointNodeIndex,
					16 * jointNodeIndex + 16
				);

				for (let k = 0; k < 16; k++) globalJointTrasformArr[j * 16 + k] = globalJointTransform[k];
			}

			this.globalJointTransformsBuffer = this.device.createBuffer({
				label: 'globalJointTransformsBuffer',
				size: globalJointTrasformArr.byteLength,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
			});
			this.device.queue.writeBuffer(this.globalJointTransformsBuffer, 0, globalJointTrasformArr);

			this.resultBuffer = this.device.createBuffer({
				label: 'resultBuffer',
				size: 16 * 4 * node.skin.joints.length,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
			});

			this.createBingGroup();
			this.createPipeline();
			this.compute();
		}

		return this.jointMatricesBufferList;
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

	createBingGroup() {
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

	async compute() {
		const commandEncoder = this.device.createCommandEncoder();
		const computePass = commandEncoder.beginComputePass();
		computePass.setPipeline(this.pipeline);
		computePass.setBindGroup(0, this.bindGroup);
		computePass.dispatchWorkgroups(64, 1, 1);
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
