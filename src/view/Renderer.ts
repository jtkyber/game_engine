import { Mat4, mat4, utils } from 'wgpu-matrix';
import { IRenderData } from '../types/types';
import GLTFNode from './gltf/node';
import GLTFPrimitive from './gltf/primitive';
import shader from './shaders/shader.wgsl';

export default class Renderer {
	// Canvas
	canvas: HTMLCanvasElement;
	context: GPUCanvasContext;
	view: GPUTextureView;

	// Nodes
	nodes: GLTFNode[];

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
	modelTransformsBuffer: GPUBuffer;
	projViewTransformBuffer: GPUBuffer;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.context = <GPUCanvasContext>canvas.getContext('webgpu');
		this.fov = utils.degToRad(60);
		this.aspect = canvas.width / canvas.height;
		this.projection = mat4.perspective(this.fov, this.aspect, 0.01, 1000);
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

	set_nodes(nodes: GLTFNode[]) {
		this.nodes = nodes;
	}

	async init() {
		this.createBuffers();
		this.createDepthTexture();
		this.createBindGroupLayouts();
		this.createBindGroups();
		this.createPipeline();
	}

	createBuffers() {
		this.modelTransformsBuffer = this.device.createBuffer({
			label: 'Model Transform Buffer',
			size: 4 * 16 * this.nodes.length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.projViewTransformBuffer = this.device.createBuffer({
			label: 'Proj-View Transform Buffer',
			size: 4 * 16,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
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

	alignTo(val: number, align: number) {
		return Math.floor((val + align - 1) / align) * align;
	}

	setVertexBuffer(arr: Uint8Array, size: number) {
		// console.log(arr, size);
		// this.vertexBuffer = this.device.createBuffer({
		// 	label: 'Vertex Buffer',
		// 	size: size,
		// 	usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
		// 	mappedAtCreation: true,
		// });
		// new Float32Array(this.vertexBuffer.getMappedRange()).set(arr);
		// this.vertexBuffer.unmap();
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
				{
					// Proj-View matrix
					binding: 1,
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
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
				{
					// Metallic Roughness Texture
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						viewDimension: '2d',
					},
				},
				{
					// Metallic Factor
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
				{
					// Roughness Factor
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {},
				},
			],
		});
	}

	createBindGroups() {
		this.frameBindGroup = this.device.createBindGroup({
			layout: this.frameBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.modelTransformsBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.projViewTransformBuffer,
					},
				},
			],
		});
	}

	createPipeline() {
		this.pipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.frameBindGroupLayout],
			}),
			vertex: {
				module: this.shaderModule,
				entryPoint: 'v_main',
				buffers: [
					{
						arrayStride: 12,
						attributes: [
							{
								// position
								shaderLocation: 0,
								format: 'float32x3',
								offset: 0,
							},
							// {
							// 	// normal
							// 	shaderLocation: 1,
							// 	format: 'float32x3',
							// 	offset: 12,
							// },
							// {
							// 	// text coord
							// 	shaderLocation: 2,
							// 	format: 'float32x2',
							// 	offset: 24,
							// },
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

	render = (nodes: GLTFNode[], renderables: IRenderData) => {
		const projView = mat4.mul(this.projection, renderables.viewTransform);

		this.encoder = <GPUCommandEncoder>this.device.createCommandEncoder();
		this.view = <GPUTextureView>this.context.getCurrentTexture().createView();

		this.renderPass = <GPURenderPassEncoder>this.encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.view,
					loadOp: 'clear',
					clearValue: [0.0, 0.0, 0.0, 1.0],
					storeOp: 'store',
				},
			],
			depthStencilAttachment: this.depthStencilAttachment,
		});

		this.device.queue.writeBuffer(this.modelTransformsBuffer, 0, renderables.modelTransforms);
		this.device.queue.writeBuffer(this.projViewTransformBuffer, 0, projView);

		this.renderPass.setPipeline(this.pipeline);
		this.renderPass.setBindGroup(0, this.frameBindGroup);

		for (let i = 0; i < nodes.length; i++) {
			const node: GLTFNode = nodes[i];
			if (!node.mesh) continue;

			for (let j = 0; j < node.mesh.primitives.length; j++) {
				const p: GLTFPrimitive = node.mesh.primitives[j];

				this.renderPass.setVertexBuffer(
					0,
					p.positions.bufferView.gpuBuffer,
					p.positions.byteOffset,
					p.positions.byteLength
				);

				if (p.indices) {
					this.renderPass.setIndexBuffer(
						<GPUBuffer>p.indices.bufferView.gpuBuffer,
						<GPUIndexFormat>p.indices.elementType,
						p.indices.byteOffset,
						p.indices.byteLength
					);

					this.renderPass.drawIndexed(p.indices.count, 1, 0, 0, i);
				} else {
					this.renderPass.draw(p.positions.count, 1, 0, i);
				}
			}
		}

		this.renderPass.end();
		this.device.queue.submit([this.encoder.finish()]);
	};
}
