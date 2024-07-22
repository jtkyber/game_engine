import { Mat4, mat4, utils } from 'wgpu-matrix';
import Model from '../model/model';
import { IModelNodeChunks, IModelNodeIndices } from '../types/gltf';
import { IRenderData } from '../types/types';
import { nodes } from './gltf/loader';
import GLTFNode from './gltf/node';
import GLTFPrimitive from './gltf/primitive';
import colorFragShader from './shaders/color_frag.wgsl';
import colorVertShader from './shaders/color_vert.wgsl';
import colorVertShaderSkinned from './shaders/color_vert_skinned.wgsl';

export default class Renderer {
	// Canvas
	canvas: HTMLCanvasElement;
	context: GPUCanvasContext;
	view: GPUTextureView;
	identity: Mat4 = mat4.identity();

	// Nodes
	modelNodeChunks: IModelNodeChunks;

	// Camera
	fov: number;
	aspect: number;
	projection: Mat4;

	// Device
	adapter: GPUAdapter;
	device: GPUDevice;
	format: GPUTextureFormat;
	colorVertShaderModule: GPUShaderModule;
	colorVertShaderModuleSkinned: GPUShaderModule;
	colorFragShaderModule: GPUShaderModule;

	// Render Pass
	renderPass: GPURenderPassEncoder;
	encoder: GPUCommandEncoder;

	// Pipeline
	pipelineOpaque: GPURenderPipeline;
	pipelineTransparent: GPURenderPipeline;
	pipelineOpaqueSkinned: GPURenderPipeline;
	pipelineTransparentSkinned: GPURenderPipeline;

	frameBindGroupLayout: GPUBindGroupLayout;
	frameBindGroup: GPUBindGroup;
	materialBindGroupLayout: GPUBindGroupLayout;
	materialBindGroup: GPUBindGroup;
	jointBindGroupLayout: GPUBindGroupLayout;

	// Depth buffer
	depthTexture: GPUTexture;
	depthFormat: GPUTextureFormat;
	depthStencilAttachment: GPURenderPassDepthStencilAttachment;
	depthStencilState: GPUDepthStencilState;
	depthStencilView: GPUTextureView;

	// Buffers
	vertexBuffer: GPUBuffer;
	modelTransformsBuffer: GPUBuffer;
	normalTransformBuffer: GPUBuffer;
	projViewTransformBuffer: GPUBuffer;
	jointMatricesBuffers: GPUBuffer[];

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
		this.colorVertShaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'colorVertShaderModule', code: colorVertShader })
		);
		this.colorVertShaderModuleSkinned = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'colorVertShaderModuleSkinned', code: colorVertShaderSkinned })
		);
		this.colorFragShaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'colorFragShaderModule', code: colorFragShader })
		);

		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: 'premultiplied',
		});
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
			size: 4 * 16 * nodes.length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		this.normalTransformBuffer = this.device.createBuffer({
			label: 'Normal Transform Buffer',
			size: 4 * 16 * nodes.length,
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
					// Normal matrices
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					// Proj-View matrix
					binding: 2,
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
					// Material Params
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
					},
				},
				{
					// Base Color Sampler
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {},
				},
				{
					// Base Color Texture
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {},
				},
				{
					// Metallic Roughness Sampler
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {},
				},
				{
					// Metallic Roughness Texture
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {},
				},
			],
		});

		this.jointBindGroupLayout = this.device.createBindGroupLayout({
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
						buffer: this.normalTransformBuffer,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.projViewTransformBuffer,
					},
				},
			],
		});
	}

	createPipeline() {
		const bindGroupLayouts: GPUBindGroupLayout[] = [this.frameBindGroupLayout, this.materialBindGroupLayout];

		const bindGroupLayoutsSkinned: GPUBindGroupLayout[] = bindGroupLayouts.concat(this.jointBindGroupLayout);

		const vertexBuffers: GPUVertexBufferLayout[] = [
			{
				arrayStride: 12,
				attributes: [
					{
						// position
						shaderLocation: 0,
						format: 'float32x3',
						offset: 0,
					},
				],
			},
			{
				arrayStride: 12,
				attributes: [
					{
						// normal
						shaderLocation: 1,
						format: 'float32x3',
						offset: 0,
					},
				],
			},
			{
				arrayStride: 8,
				attributes: [
					{
						// text coord
						shaderLocation: 2,
						format: 'float32x2',
						offset: 0,
					},
				],
			},
		];

		const vertexBuffersSkinned: GPUVertexBufferLayout[] = vertexBuffers.concat(
			{
				arrayStride: 8,
				attributes: [
					{
						// joint
						shaderLocation: 3,
						format: 'uint8x4',
						offset: 0,
					},
				],
			},
			{
				arrayStride: 16,
				attributes: [
					{
						// weight
						shaderLocation: 4,
						format: 'float32x4',
						offset: 0,
					},
				],
			}
		);

		const targets: GPUColorTargetState[] = [
			{
				format: this.format,
				blend: {
					color: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha',
					},
					alpha: {
						srcFactor: 'one',
						dstFactor: 'one-minus-src-alpha',
					},
				},
			},
		];

		this.pipelineOpaque = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayouts,
			}),
			vertex: {
				module: this.colorVertShaderModule,
				entryPoint: 'v_main',
				buffers: vertexBuffers,
			},
			fragment: {
				module: this.colorFragShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: this.depthStencilState,
		});

		this.pipelineOpaqueSkinned = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayoutsSkinned,
			}),
			vertex: {
				module: this.colorVertShaderModuleSkinned,
				entryPoint: 'v_main',
				buffers: vertexBuffersSkinned,
			},
			fragment: {
				module: this.colorFragShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: this.depthStencilState,
		});

		this.pipelineTransparent = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayouts,
			}),
			vertex: {
				module: this.colorVertShaderModule,
				entryPoint: 'v_main',
				buffers: vertexBuffers,
			},
			fragment: {
				module: this.colorFragShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'less',
			},
		});

		this.pipelineTransparentSkinned = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: bindGroupLayoutsSkinned,
			}),
			vertex: {
				module: this.colorVertShaderModuleSkinned,
				entryPoint: 'v_main',
				buffers: vertexBuffersSkinned,
			},
			fragment: {
				module: this.colorFragShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'less',
			},
		});
	}

	set_joint_buffers(jointMatricesBufferList: GPUBuffer[], models: Model[]) {
		for (let i = 0; i < models.length; i++) {
			const node: GLTFNode = nodes[models[i].nodeIndex];
			if (!node.skin) continue;

			this.encoder.copyBufferToBuffer(
				jointMatricesBufferList[i],
				0,
				node.skin.jointMatricesBuffer,
				0,
				node.skin.jointMatricesBuffer.size
			);
		}
	}

	renderChunk(chunkType: string, chunk: IModelNodeIndices[]) {
		for (let i = 0; i < chunk.length; i++) {
			const nodeIndex: number = chunk[i].nodeIndex;
			const primIndex: number = chunk[i].primitiveIndex;
			const node: GLTFNode = nodes[nodeIndex];
			if (!node.mesh) continue;

			const p: GLTFPrimitive = node.mesh.primitives[primIndex];

			if (node.skin) {
				if (chunkType === 'transparent') {
					this.renderPass.setPipeline(this.pipelineTransparentSkinned);
				} else {
					this.renderPass.setPipeline(this.pipelineOpaqueSkinned);
				}

				this.renderPass.setBindGroup(2, node.skin.jointBindGroup);

				this.renderPass.setVertexBuffer(
					3,
					p.joints.bufferView.gpuBuffer,
					p.joints.byteOffset,
					p.joints.byteLength
				);

				this.renderPass.setVertexBuffer(
					4,
					p.weights.bufferView.gpuBuffer,
					p.weights.byteOffset,
					p.weights.byteLength
				);
			} else {
				if (chunkType === 'transparent') {
					this.renderPass.setPipeline(this.pipelineTransparent);
				} else {
					this.renderPass.setPipeline(this.pipelineOpaque);
				}
			}

			this.renderPass.setBindGroup(0, this.frameBindGroup);
			this.renderPass.setBindGroup(1, p.material.bindGroup);

			this.renderPass.setVertexBuffer(
				0,
				p.positions.bufferView.gpuBuffer,
				p.positions.byteOffset,
				p.positions.byteLength
			);

			this.renderPass.setVertexBuffer(
				1,
				p.normals.bufferView.gpuBuffer,
				p.normals.byteOffset,
				p.normals.byteLength
			);

			this.renderPass.setVertexBuffer(
				2,
				p.texCoords.bufferView.gpuBuffer,
				p.texCoords.byteOffset,
				p.texCoords.byteLength
			);

			if (p.indices) {
				this.renderPass.setIndexBuffer(
					<GPUBuffer>p.indices.bufferView.gpuBuffer,
					<GPUIndexFormat>p.indices.elementType,
					p.indices.byteOffset,
					p.indices.byteLength
				);

				this.renderPass.drawIndexed(p.indices.count, 1, 0, 0, nodeIndex);
			} else {
				this.renderPass.draw(p.positions.count, 1, 0, nodeIndex);
			}
		}
	}

	render = (renderables: IRenderData, modelNodeChunks: IModelNodeChunks, models: Model[]) => {
		const projView = mat4.mul(this.projection, renderables.viewTransform);

		this.encoder = <GPUCommandEncoder>this.device.createCommandEncoder();
		this.view = <GPUTextureView>this.context.getCurrentTexture().createView();

		this.set_joint_buffers(renderables.jointMatricesBufferList, models);

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

		this.device.queue.writeBuffer(this.modelTransformsBuffer, 0, renderables.nodeTransforms);
		this.device.queue.writeBuffer(this.normalTransformBuffer, 0, renderables.normalTransforms);
		this.device.queue.writeBuffer(this.projViewTransformBuffer, 0, projView);

		this.renderChunk('opaque', modelNodeChunks.opaque);
		if (modelNodeChunks.transparent.length) {
			this.renderChunk('transparent', modelNodeChunks.transparent);
		}

		this.renderPass.end();
		this.device.queue.submit([this.encoder.finish()]);
	};
}
