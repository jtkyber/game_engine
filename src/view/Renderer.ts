import { Mat4, mat4, utils } from 'wgpu-matrix';
import GLTFPrimitive from './gltf/primitive';
import shader from './shaders/shader.wgsl';

export default class Renderer {
	// Canvas
	canvas: HTMLCanvasElement;
	context: GPUCanvasContext;
	view: GPUTextureView;

	// Camera
	fov: number;
	aspect: number;
	projection: Mat4;

	// Device
	adapter: GPUAdapter;
	device: GPUDevice;
	format: GPUTextureFormat;
	shaderModule: GPUShaderModule;

	// Render Pass
	renderPass: GPURenderPassEncoder;
	encoder: GPUCommandEncoder;

	// Pipeline
	pipeline: GPURenderPipeline;
	frameBindGroupLayout: GPUBindGroupLayout;
	frameBindGroup: GPUBindGroup;
	materialBindGroupLayout: GPUBindGroupLayout;
	materialBindGroup: GPUBindGroup;

	// Depth buffer
	depthTexture: GPUTexture;
	depthFormat: GPUTextureFormat;
	depthStencilAttachment: GPURenderPassDepthStencilAttachment;
	depthStencilState: GPUDepthStencilState;
	depthStencilView: GPUTextureView;

	// Buffers
	vertexBuffer: GPUBuffer;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.context = <GPUCanvasContext>canvas.getContext('webgpu');
		this.fov = utils.degToRad(60);
		this.aspect = canvas.width / canvas.height;
		this.projection = mat4.perspective(this.fov, this.aspect, 0.01, 1000);
	}

	async init() {
		await this.setupDevice();
		this.createDepthTexture();
		this.createBindGroupLayouts();
		this.createPipeline();
	}

	async setupDevice() {
		this.adapter = <GPUAdapter>await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
		this.device = <GPUDevice>await this.adapter.requestDevice();
		this.format = <GPUTextureFormat>navigator.gpu.getPreferredCanvasFormat();
		this.shaderModule = <GPUShaderModule>this.device.createShaderModule({ label: 'shader', code: shader });

		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: 'premultiplied',
		});
	}

	createDepthTexture() {
		this.depthFormat = 'depth24plus';

		this.depthStencilState = {
			format: this.depthFormat,
			depthWriteEnabled: true,
			depthCompare: 'less',
		};

		this.depthTexture = this.device.createTexture({
			size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
			format: this.depthFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

		this.depthStencilView = this.depthTexture.createView({
			format: this.depthFormat,
			dimension: '2d',
			aspect: 'depth-only',
		});

		this.depthStencilAttachment = {
			view: this.depthStencilView,
			depthClearValue: 1.0,
			depthLoadOp: 'clear',
			depthStoreOp: 'store',
		};
	}

	setVertexBuffer(arr: Uint8Array, size: number) {
		this.vertexBuffer = this.device.createBuffer({
			label: 'Vertex Buffer',
			size: size,
			usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
			mappedAtCreation: true,
		});

		new Float32Array(this.vertexBuffer.getMappedRange()).set(arr);
		this.vertexBuffer.unmap();
	}

	createBindGroupLayouts() {
		this.frameBindGroupLayout = this.device.createBindGroupLayout({
			entries: [
				{
					// Model matrices
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
			],
		});

		this.materialBindGroupLayout = this.device.createBindGroupLayout({
			entries: [
				{
					// Base Color Texture
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						viewDimension: '2d',
					},
				},
				{
					// Base Color Factor
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
				{
					// Metallic Roughness Texture
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						viewDimension: '2d',
					},
				},
				{
					// Metallic Factor
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
				{
					// Roughness Factor
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
			],
		});
	}

	createBindGroups() {}

	createPipeline() {
		this.pipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.frameBindGroupLayout, this.materialBindGroupLayout],
			}),
			vertex: {
				module: this.shaderModule,
				entryPoint: 'v_main',
				buffers: [
					{
						arrayStride: 32,
						attributes: [
							{
								// position
								shaderLocation: 0,
								format: 'float32x3',
								offset: 0,
							},
							{
								// normal
								shaderLocation: 1,
								format: 'float32x3',
								offset: 12,
							},
							{
								// text coord
								shaderLocation: 2,
								format: 'float32x2',
								offset: 24,
							},
						],
					},
				],
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
				topology: 'triangle-list',
			},
			depthStencil: this.depthStencilState,
		});
	}

	render = (primitives: GLTFPrimitive[]) => {
		this.encoder = <GPUCommandEncoder>this.device.createCommandEncoder();
		this.view = <GPUTextureView>this.context.getCurrentTexture().createView();

		this.renderPass = <GPURenderPassEncoder>this.encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.view,
					loadOp: 'clear',
					clearValue: [1.0, 1.0, 1.0, 1.0],
					storeOp: 'store',
				},
			],
			depthStencilAttachment: this.depthStencilAttachment,
		});

		this.renderPass.setPipeline(this.pipeline);
		this.renderPass.setBindGroup(0, this.frameBindGroup);

		for (let i = 0; i < primitives.length; i++) {
			const p = primitives[i];
			this.renderPass.setVertexBuffer(0, this.vertexBuffer, p.positions.byteOffset, p.positions.byteLength);
		}

		this.renderPass.end();
		this.device.queue.submit([this.encoder.finish()]);
	};
}
