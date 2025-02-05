import { globalToggles } from '../control/app';
import shader from './shaders/frustum.wgsl';

export class LightFrustums {
	device: GPUDevice;
	format: GPUTextureFormat;
	depthFormat: GPUTextureFormat;
	inverseLightViewProjBuffer: GPUBuffer;
	uniformBuffer: GPUBuffer;
	shaderModule: GPUShaderModule;
	bindGroup: GPUBindGroup;
	pipeline: GPURenderPipeline;
	bindGroupLayout: GPUBindGroupLayout;

	constructor(
		device: GPUDevice,
		format: GPUTextureFormat,
		depthFormat: GPUTextureFormat,
		inverseLightViewProjBuffer: GPUBuffer,
		uniformBuffer: GPUBuffer
	) {
		this.device = device;
		this.format = format;
		this.depthFormat = depthFormat;
		this.inverseLightViewProjBuffer = inverseLightViewProjBuffer;
		this.uniformBuffer = uniformBuffer;
	}

	async init() {
		this.shaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'Light Frustum Shader', code: shader })
		);

		this.bindGroupLayout = this.device.createBindGroupLayout({
			label: 'Light Frustum BGL',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {},
				},
			],
		});

		this.bindGroup = this.device.createBindGroup({
			label: 'Light Frustum Bind Group',
			layout: this.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.inverseLightViewProjBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.uniformBuffer,
					},
				},
			],
		});

		this.createPipeline();
	}

	createPipeline() {
		this.pipeline = this.device.createRenderPipeline({
			label: 'Light Frustum Layout',
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			vertex: {
				module: this.shaderModule,
				entryPoint: 'v_main',
			},
			fragment: {
				module: this.shaderModule,
				entryPoint: 'f_main',
				targets: [
					{
						format: this.format,
					},
				],
			},
			primitive: {
				topology: 'line-list',
			},
			multisample: {
				count: globalToggles.antialiasing ? 4 : 1,
			},
			depthStencil: { format: this.depthFormat, depthWriteEnabled: true, depthCompare: 'greater-equal' },
		});
	}
}
