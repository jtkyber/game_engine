import { Mat4, mat4, vec3, Vec3, vec4 } from 'wgpu-matrix';
import { aspect, debugging } from '../control/app';
import { LightType } from '../types/enums';
import { IModelNodeChunks, IModelNodeIndices } from '../types/gltf';
import { IRenderData } from '../types/types';
import BindGroupLayouts from './bindGroupLayouts';
import GLTFImage from './gltf/image';
import { models, nodes } from './gltf/loader';
import GLTFNode from './gltf/node';
import GLTFPrimitive from './gltf/primitive';
import GLTFTerrainMaterial from './gltf/splat_materials';
import { LightFrustums } from './light_frustums';
import aabbShader from './shaders/aabb_shader.wgsl';
import { colorFragShader } from './shaders/color_frag';
import colorVertShader from './shaders/color_vert.wgsl';
import colorVertShaderSkinned from './shaders/color_vert_skinned.wgsl';
import cullingShader from './shaders/compute/culling.wgsl';
import obbShader from './shaders/obb_shader.wgsl';
import { Shadow } from './shadow';
import { Skybox } from './skybox';

export default class Renderer {
	// Canvas
	canvas: HTMLCanvasElement;
	context: GPUCanvasContext;
	view: GPUTextureView;
	identity: Mat4 = mat4.identity();

	// Nodes
	modelNodeChunks: IModelNodeChunks;
	culledModels: Float32Array = new Float32Array([]);

	// Skybox
	skybox: Skybox;

	shadow: Shadow;

	lightFrustums: LightFrustums;

	splatMap: GLTFImage;
	terrainMaterialIndex: number;
	terrainNodeIndex: number;
	terrainMaterial: GLTFTerrainMaterial;

	// Device
	adapter: GPUAdapter;
	device: GPUDevice;
	format: GPUTextureFormat;

	// Shader Modules
	colorVertShaderModule: GPUShaderModule;
	colorVertShaderModuleSkinned: GPUShaderModule;
	// colorFragShaderModule: GPUShaderModule;
	obbShaderModule: GPUShaderModule;
	aabbShaderModule: GPUShaderModule;
	terrainShaderModule: GPUShaderModule;
	cullingShaderModule: GPUShaderModule;

	// Render Pass
	renderPass: GPURenderPassEncoder;
	encoder: GPUCommandEncoder;

	// Pipeline
	pipelineOpaque: GPURenderPipeline;
	pipelineTransparent: GPURenderPipeline;
	pipelineOpaqueSkinned: GPURenderPipeline;
	pipelineTransparentSkinned: GPURenderPipeline;
	pipelineTerrainBlend: GPURenderPipeline;
	OBBPipeline: GPURenderPipeline;
	AABBPipeline: GPURenderPipeline;
	terrainPipeline: GPURenderPipeline;
	skyboxPipeline: GPURenderPipeline;
	cullingPipeline: GPUComputePipeline;

	frameBindGroup: GPUBindGroup;
	materialBindGroup: GPUBindGroup;
	boundingBoxBindGroup: GPUBindGroup;
	lightingBindGroup: GPUBindGroup;
	terrainBindGroup: GPUBindGroup;
	cullingBindGroup: GPUBindGroup;

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
	projectionViewBuffer: GPUBuffer;

	lightTypeBuffer: GPUBuffer;
	lightPositionBuffer: GPUBuffer;
	lightColorBuffer: GPUBuffer;
	lightIntensityBuffer: GPUBuffer;
	lightDirectionBuffer: GPUBuffer;
	lightAngleScaleBuffer: GPUBuffer;
	lightAngleOffsetBuffer: GPUBuffer;
	lightViewProjBuffer: GPUBuffer;
	lightViewBuffer: GPUBuffer;
	lightAngleDataBuffer: GPUBuffer;
	lightCascadeSplitsBuffer: GPUBuffer;
	cameraPositionBuffer: GPUBuffer;
	inverseLightViewProjBuffer: GPUBuffer;
	terrainMinMaxBuffer: GPUBuffer;

	boundingBoxBuffer: GPUBuffer;
	cullResultBuffer: GPUBuffer;
	cullReadBuffers: {
		buffer: GPUBuffer;
		pending: boolean;
		available: boolean;
	}[];

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.context = <GPUCanvasContext>canvas.getContext('webgpu');
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
		// this.colorFragShaderModule = <GPUShaderModule>(
		// 	this.device.createShaderModule({ label: 'colorFragShaderModule', code: colorFragShader })
		// );
		this.obbShaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'obbShaderModule', code: obbShader })
		);
		this.aabbShaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'aabbShaderModule', code: aabbShader })
		);
		this.cullingShaderModule = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'cullingShaderModule', code: cullingShader })
		);

		this.context.configure({
			device: this.device,
			format: this.format,
			alphaMode: 'premultiplied',
		});
	}

	async init(
		lightNum: number,
		splatMap: GLTFImage,
		terrainMaterialIndex: number,
		terrainNodeIndex: number,
		bindGroupLayouts: BindGroupLayouts,
		terrainMaterial: GLTFTerrainMaterial
	) {
		this.splatMap = splatMap;
		this.terrainMaterialIndex = terrainMaterialIndex;
		this.terrainNodeIndex = terrainNodeIndex;
		this.terrainMaterial = terrainMaterial;

		this.createBuffers(lightNum);
		this.createDepthTexture();

		this.shadow = new Shadow(this.device, this.modelTransformsBuffer, this.lightViewProjBuffer, lightNum);
		await this.shadow.init();

		this.lightFrustums = new LightFrustums(
			this.device,
			this.format,
			this.depthFormat,
			this.inverseLightViewProjBuffer,
			this.projectionViewBuffer
		);
		this.lightFrustums.init();

		this.createBindGroups(bindGroupLayouts);
		this.createPipeline(bindGroupLayouts);
	}

	createBuffers(lightNum: number) {
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

		this.projectionViewBuffer = this.device.createBuffer({
			label: 'projectionViewBuffer',
			size: 4 * 16 * 2,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.lightTypeBuffer = this.device.createBuffer({
			label: 'lightTypeBuffer',
			size: 4 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightIntensityBuffer = this.device.createBuffer({
			label: 'lightIntensityBuffer',
			size: 4 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightAngleDataBuffer = this.device.createBuffer({
			label: 'lightAngleDataBuffer',
			size: 4 * 2 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightPositionBuffer = this.device.createBuffer({
			label: 'lightPositionBuffer',
			size: 4 * 4 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightColorBuffer = this.device.createBuffer({
			label: 'lightColorBuffer',
			size: 4 * 4 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightDirectionBuffer = this.device.createBuffer({
			label: 'lightDirectionBuffer',
			size: 4 * 4 * lightNum,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightViewProjBuffer = this.device.createBuffer({
			label: 'lightViewProjBuffer',
			size: 4 * 16 * lightNum * 6,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.inverseLightViewProjBuffer = this.device.createBuffer({
			label: 'inverseLightViewProjBuffer',
			size: 4 * 16 * lightNum * 6,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightViewBuffer = this.device.createBuffer({
			label: 'lightViewBuffer',
			size: 4 * 16 * lightNum * 6,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.lightCascadeSplitsBuffer = this.device.createBuffer({
			label: 'lightCascadeSplits',
			size: 4 * 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.cameraPositionBuffer = this.device.createBuffer({
			label: 'cameraPositionBuffer',
			size: 4 * 4,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.terrainMinMaxBuffer = this.device.createBuffer({
			label: 'terrainMinMaxBuffer',
			size: 4 * 4 * 2,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
		this.device.queue.writeBuffer(
			this.terrainMinMaxBuffer,
			0,
			nodes?.[this.terrainNodeIndex]?.min ?? vec4.create(0, 0, 0, 0)
		);
		this.device.queue.writeBuffer(
			this.terrainMinMaxBuffer,
			16,
			nodes?.[this.terrainNodeIndex]?.max ?? vec4.create(0, 0, 0, 0)
		);

		this.boundingBoxBuffer = this.device.createBuffer({
			label: 'boundingBoxBuffer',
			size: 4 * 4 * 2 * models.length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});
		this.cullResultBuffer = this.device.createBuffer({
			label: 'cullResultBuffer',
			size: 4 * models.length,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
		});
		const cullReadBuffer1 = this.device.createBuffer({
			label: 'cullReadBuffer1',
			size: this.cullResultBuffer.size,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		});
		const cullReadBuffer2 = this.device.createBuffer({
			label: 'cullReadBuffer2',
			size: this.cullResultBuffer.size,
			usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
		});

		this.cullReadBuffers = [
			{
				buffer: cullReadBuffer1,
				pending: false,
				available: false,
			},
			{
				buffer: cullReadBuffer2,
				pending: false,
				available: false,
			},
		];
	}

	createDepthTexture() {
		this.depthFormat = 'depth24plus';

		this.depthStencilState = {
			format: this.depthFormat,
			depthWriteEnabled: true,
			depthCompare: 'greater-equal',
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
			depthClearValue: 0.0,
			depthLoadOp: 'clear',
			depthStoreOp: 'store',
		};
	}

	createBindGroups(bindGroupLayouts: BindGroupLayouts) {
		this.frameBindGroup = this.device.createBindGroup({
			label: 'frameBindGroup',
			layout: bindGroupLayouts.frameBindGroupLayout,
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
						buffer: this.projectionViewBuffer,
					},
				},
				{
					binding: 3,
					resource: this.shadow.depthTextureView,
				},
				{
					binding: 4,
					resource: this.shadow.depthSampler,
				},
				{
					binding: 5,
					resource: {
						buffer: this.lightViewProjBuffer,
					},
				},
				{
					binding: 6,
					resource: this.splatMap.view,
				},
				{
					binding: 7,
					resource: {
						buffer: this.terrainMinMaxBuffer,
					},
				},
			],
		});

		this.boundingBoxBindGroup = this.device.createBindGroup({
			label: 'boundingBoxBindGroup',
			layout: bindGroupLayouts.boundingBoxBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.projectionViewBuffer,
					},
				},
			],
		});

		this.lightingBindGroup = this.device.createBindGroup({
			label: 'lightingBindGroup',
			layout: bindGroupLayouts.lightingBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.lightTypeBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.lightPositionBuffer,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.lightColorBuffer,
					},
				},
				{
					binding: 3,
					resource: {
						buffer: this.lightIntensityBuffer,
					},
				},
				{
					binding: 4,
					resource: {
						buffer: this.lightDirectionBuffer,
					},
				},
				{
					binding: 5,
					resource: {
						buffer: this.lightAngleDataBuffer,
					},
				},
				{
					binding: 6,
					resource: {
						buffer: this.cameraPositionBuffer,
					},
				},
				{
					binding: 7,
					resource: {
						buffer: this.lightCascadeSplitsBuffer,
					},
				},
			],
		});

		this.cullingBindGroup = this.device.createBindGroup({
			label: 'cullingBindGroup',
			layout: bindGroupLayouts.cullingBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.projectionViewBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.boundingBoxBuffer,
					},
				},
				{
					binding: 2,
					resource: {
						buffer: this.cullResultBuffer,
					},
				},
			],
		});
	}

	createPipeline(bindGroupLayouts: BindGroupLayouts) {
		const bindGroupLayoutArray: GPUBindGroupLayout[] = [
			bindGroupLayouts.frameBindGroupLayout,
			bindGroupLayouts.materialBindGroupLayout,
			bindGroupLayouts.lightingBindGroupLayout,
		];

		const bindGroupLayoutArraySplat: GPUBindGroupLayout[] = [
			bindGroupLayouts.frameBindGroupLayout,
			bindGroupLayouts.splatMaterialBindGroupLayout,
			bindGroupLayouts.lightingBindGroupLayout,
		];

		const bindGroupLayoutsSkinned: GPUBindGroupLayout[] = bindGroupLayoutArray.concat(
			bindGroupLayouts.jointBindGroupLayout
		);

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
				arrayStride: 16,
				attributes: [
					{
						// tangent
						shaderLocation: 2,
						format: 'float32x4',
						offset: 0,
					},
				],
			},
			{
				arrayStride: 8,
				attributes: [
					{
						// text coord
						shaderLocation: 3,
						format: 'float32x2',
						offset: 0,
					},
				],
			},
		];

		const vertexBuffersSkinned: GPUVertexBufferLayout[] = vertexBuffers.concat(
			{
				arrayStride: 4,
				attributes: [
					{
						// joint
						shaderLocation: 4,
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
						shaderLocation: 5,
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
				label: 'pipelineOpaque',
				bindGroupLayouts: bindGroupLayoutArray,
			}),
			vertex: {
				module: this.colorVertShaderModule,
				entryPoint: 'v_main',
				buffers: vertexBuffers,
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'colorFragShaderModule',
					code: colorFragShader(false),
				}),
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
				label: 'pipelineOpaqueSkinned',
				bindGroupLayouts: bindGroupLayoutsSkinned,
			}),
			vertex: {
				module: this.colorVertShaderModuleSkinned,
				entryPoint: 'v_main',
				buffers: vertexBuffersSkinned,
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'colorFragShaderModule',
					code: colorFragShader(false),
				}),
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
				label: 'pipelineTransparent',
				bindGroupLayouts: bindGroupLayoutArray,
			}),
			vertex: {
				module: this.colorVertShaderModule,
				entryPoint: 'v_main',
				buffers: vertexBuffers,
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'colorFragShaderModule',
					code: colorFragShader(false),
				}),
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'greater-equal',
			},
		});

		this.pipelineTransparentSkinned = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				label: 'pipelineTransparentSkinned',
				bindGroupLayouts: bindGroupLayoutsSkinned,
			}),
			vertex: {
				module: this.colorVertShaderModuleSkinned,
				entryPoint: 'v_main',
				buffers: vertexBuffersSkinned,
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'colorFragShaderModule',
					code: colorFragShader(false),
				}),
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'greater-equal',
			},
		});

		this.pipelineTerrainBlend = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				label: 'pipelineTerrainBlend',
				bindGroupLayouts: bindGroupLayoutArraySplat,
			}),
			vertex: {
				module: this.colorVertShaderModule,
				entryPoint: 'v_main',
				buffers: vertexBuffers,
			},
			fragment: {
				module: this.device.createShaderModule({
					label: 'splatColorFragShaderModule',
					code: colorFragShader(true),
				}),
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: true,
				depthCompare: 'greater-equal',
			},
		});

		this.OBBPipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				label: 'OBBPipeline',
				bindGroupLayouts: [bindGroupLayouts.boundingBoxBindGroupLayout],
			}),
			vertex: {
				module: this.obbShaderModule,
				entryPoint: 'v_main',
				buffers: [
					{
						arrayStride: 12,
						attributes: [
							{
								shaderLocation: 0,
								format: 'float32x3',
								offset: 0,
							},
						],
					},
				],
			},
			fragment: {
				module: this.obbShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'greater-equal',
			},
		});

		this.AABBPipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({
				label: 'AABBPipeline',
				bindGroupLayouts: [bindGroupLayouts.boundingBoxBindGroupLayout],
			}),
			vertex: {
				module: this.aabbShaderModule,
				entryPoint: 'v_main',
				buffers: [
					{
						arrayStride: 12,
						attributes: [
							{
								shaderLocation: 0,
								format: 'float32x3',
								offset: 0,
							},
						],
					},
				],
			},
			fragment: {
				module: this.aabbShaderModule,
				entryPoint: 'f_main',
				targets: targets,
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: this.depthFormat,
				depthWriteEnabled: false,
				depthCompare: 'greater-equal',
			},
		});

		this.cullingPipeline = this.device.createComputePipeline({
			layout: this.device.createPipelineLayout({
				label: 'cullingPipeline',
				bindGroupLayouts: [bindGroupLayouts.cullingBindGroupLayout],
			}),
			compute: {
				module: this.cullingShaderModule,
				entryPoint: 'main',
			},
		});
	}

	set_joint_buffers(jointMatricesBufferList: GPUBuffer[], modelNodeChunks: IModelNodeChunks) {
		const modelIndices: IModelNodeIndices[] = modelNodeChunks.opaque.concat(modelNodeChunks.transparent);

		for (let i = 0; i < modelIndices.length; i++) {
			const node: GLTFNode = nodes[modelIndices[i].nodeIndex];
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

	renderTerrain(p: GLTFPrimitive, nodeIndex: number) {
		// const terrainMaterialMesh: GLTFMesh = nodes?.[this.terrainMaterialIndex]?.mesh;
		// const count: number = terrainMaterialMesh ? terrainMaterialMesh.primitives.length : 1;

		if (this.terrainNodeIndex >= 0 && this.terrainMaterialIndex >= 0) {
			this.renderPass.setPipeline(this.pipelineTerrainBlend);
			this.renderPass.setBindGroup(1, this.terrainMaterial.bindGroup);
		} else {
			this.renderPass.setPipeline(this.pipelineOpaque);
			this.renderPass.setBindGroup(1, p.material.bindGroup);
		}

		this.renderPass.setBindGroup(0, this.frameBindGroup);
		this.renderPass.setBindGroup(2, this.lightingBindGroup);

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

		if (p.tangents) {
			this.renderPass.setVertexBuffer(
				2,
				p.tangents.bufferView.gpuBuffer,
				p.tangents.byteOffset,
				p.tangents.byteLength
			);
		}

		this.renderPass.setVertexBuffer(
			3,
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

	renderChunk(chunkType: string, chunk: IModelNodeIndices[]) {
		for (let i = 0; i < chunk.length; i++) {
			const nodeIndex: number = chunk[i].nodeIndex;
			const primIndex: number = chunk[i].primitiveIndex;
			const node: GLTFNode = nodes[nodeIndex];
			if (!node.mesh || this.culledModels.includes(node.rootNode ?? nodeIndex) || node.hidden) {
				continue;
			}

			const p: GLTFPrimitive = node.mesh.primitives[primIndex];

			if (node.name === 'Terrain') {
				this.renderTerrain(p, nodeIndex);
				continue;
			}

			if (node.skin !== null) {
				if (chunkType === 'transparent') {
					this.renderPass.setPipeline(this.pipelineTransparentSkinned);
				} else {
					this.renderPass.setPipeline(this.pipelineOpaqueSkinned);
				}

				this.renderPass.setBindGroup(3, node.skin.jointBindGroup);

				this.renderPass.setVertexBuffer(
					4,
					p.joints.bufferView.gpuBuffer,
					p.joints.byteOffset,
					p.joints.byteLength
				);

				this.renderPass.setVertexBuffer(
					5,
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
			this.renderPass.setBindGroup(2, this.lightingBindGroup);

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

			if (p.tangents) {
				this.renderPass.setVertexBuffer(
					2,
					p.tangents.bufferView.gpuBuffer,
					p.tangents.byteOffset,
					p.tangents.byteLength
				);
			}

			this.renderPass.setVertexBuffer(
				3,
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

	renderBoundingBoxes(isAxisAligned: boolean) {
		for (let i = 0; i < models.length; i++) {
			const node: GLTFNode = nodes[models[i]];
			if (node.hasBoundingBox) {
				this.renderPass.setVertexBuffer(0, isAxisAligned ? node.AABBBuffer : node.OBBBuffer);
				this.renderPass.draw(36);
			}
		}
	}

	shadowPass(modelNodeChunks: IModelNodeChunks, renderables: IRenderData) {
		const modelIndices = modelNodeChunks.opaque.concat(modelNodeChunks.transparent);

		loop: for (let i: number = 0; i < renderables.lightTypes.length * 6; i++) {
			const lightIndex: number = ~~(i / 6);
			const layer: number = i % 6;

			if (renderables.lightIntensities[lightIndex] === 0) {
				continue loop;
			}

			switch (renderables.lightTypes[lightIndex]) {
				case LightType.SPOT:
					if (layer > 0) continue loop;
					break;
				case LightType.DIRECTIONAL:
					if (layer >= renderables.camera.cascadeCount) continue loop;
					break;
				case LightType.POINT:
					break;
			}

			const shadowPass = <GPURenderPassEncoder>this.encoder.beginRenderPass({
				colorAttachments: [],
				depthStencilAttachment: {
					view: this.shadow.depthTextureViewArray[i],
					depthClearValue: 0.0,
					depthLoadOp: 'clear',
					depthStoreOp: 'store',
				},
			});

			for (let j = 0; j < modelIndices.length; j++) {
				const modelIndexChunk = modelIndices[j];
				const nodeIndex: number = modelIndexChunk.nodeIndex;
				const primIndex: number = modelIndexChunk.primitiveIndex;
				const node: GLTFNode = nodes[nodeIndex];
				if (!node.mesh || node.hidden) continue;

				const p: GLTFPrimitive = node.mesh.primitives[primIndex];

				if (node.skin !== null) {
					shadowPass.setPipeline(this.shadow.pipelineSkinned);
					shadowPass.setBindGroup(0, this.shadow.bindGroup);
					shadowPass.setBindGroup(1, node.skin.jointBindGroup);

					shadowPass.setVertexBuffer(
						1,
						p.joints.bufferView.gpuBuffer,
						p.joints.byteOffset,
						p.joints.byteLength
					);

					shadowPass.setVertexBuffer(
						2,
						p.weights.bufferView.gpuBuffer,
						p.weights.byteOffset,
						p.weights.byteLength
					);
				} else {
					shadowPass.setPipeline(this.shadow.pipeline);
					shadowPass.setBindGroup(0, this.shadow.bindGroup);
				}

				shadowPass.setVertexBuffer(
					0,
					p.positions.bufferView.gpuBuffer,
					p.positions.byteOffset,
					p.positions.byteLength
				);

				if (p.indices) {
					shadowPass.setIndexBuffer(
						<GPUBuffer>p.indices.bufferView.gpuBuffer,
						<GPUIndexFormat>p.indices.elementType,
						p.indices.byteOffset,
						p.indices.byteLength
					);

					shadowPass.drawIndexed(p.indices.count, 1, 0, 0, (i << 16) | nodeIndex);
				} else {
					shadowPass.draw(p.positions.count, 1, 0, (i << 16) | nodeIndex);
				}
			}

			shadowPass.end();
		}
	}

	setCulledModels() {
		const boundingBoxes: Float32Array = new Float32Array(this.boundingBoxBuffer.size / 4);

		for (let i = 0; i < models.length; i++) {
			const min: Vec3 = nodes[models[i]].AABB?.min ?? vec3.create(-10000, -10000, -10000);
			const max: Vec3 = nodes[models[i]].AABB?.max ?? vec3.create(10000, 10000, 10000);

			boundingBoxes.set([...min, 0], i * 4 * 2);
			boundingBoxes.set([...max, 0], i * 4 * 2 + 4);
		}

		this.device.queue.writeBuffer(this.boundingBoxBuffer, 0, boundingBoxes);

		const commandEncoder = this.device.createCommandEncoder();
		const computePass = commandEncoder.beginComputePass({ label: 'cullingComputePass' });
		computePass.setPipeline(this.cullingPipeline);
		computePass.setBindGroup(0, this.cullingBindGroup);
		computePass.dispatchWorkgroups(Math.ceil(models.length / 64), 1, 1);
		computePass.end();

		for (let i = 0; i < this.cullReadBuffers.length; i++) {
			const cullReadBufferObj = this.cullReadBuffers[i];

			if (!cullReadBufferObj.pending && !cullReadBufferObj.available) {
				commandEncoder.copyBufferToBuffer(
					this.cullResultBuffer,
					0,
					cullReadBufferObj.buffer,
					0,
					this.cullResultBuffer.size
				);

				cullReadBufferObj.pending = true;
				cullReadBufferObj.buffer.unmap();
				this.device.queue.submit([commandEncoder.finish()]);
				cullReadBufferObj.buffer.mapAsync(GPUMapMode.READ).then(() => {
					cullReadBufferObj.pending = false;
					cullReadBufferObj.available = true;
				});

				break;
			}
		}

		for (let i = 0; i < this.cullReadBuffers.length; i++) {
			const cullReadBufferObj = this.cullReadBuffers[i];

			if (cullReadBufferObj.available) {
				const arrayBuffer = cullReadBufferObj.buffer.getMappedRange();
				this.culledModels = new Float32Array(arrayBuffer)
					.map((x, i) => (x === 0 ? models[i] : -1))
					.filter(x => x >= 0);

				cullReadBufferObj.available = false;
				cullReadBufferObj.buffer.unmap();
			}
		}
	}

	render = (renderables: IRenderData, modelNodeChunks: IModelNodeChunks) => {
		// this.setCulledModels();

		this.encoder = <GPUCommandEncoder>this.device.createCommandEncoder();
		this.view = <GPUTextureView>this.context.getCurrentTexture().createView();

		const dy = Math.tan(renderables.camera.fov / 2);
		const dx = dy * aspect;

		this.device.queue.writeBuffer(
			this.skybox.camDirectionBuffer,
			0,
			new Float32Array([
				renderables.camera.forward[0],
				renderables.camera.forward[1],
				renderables.camera.forward[2],
				0.0,
				dx * renderables.camera.right[0],
				dx * renderables.camera.right[1],
				dx * renderables.camera.right[2],
				0.0,
				dy * renderables.camera.up[0],
				dy * renderables.camera.up[1],
				dy * renderables.camera.up[2],
				0.0,
			])
		);

		this.device.queue.writeBuffer(this.modelTransformsBuffer, 0, renderables.nodeTransforms);
		this.device.queue.writeBuffer(this.normalTransformBuffer, 0, renderables.normalTransforms);
		this.device.queue.writeBuffer(this.projectionViewBuffer, 0, renderables.camera.view);
		this.device.queue.writeBuffer(this.projectionViewBuffer, 64, renderables.camera.projection);

		this.device.queue.writeBuffer(this.lightTypeBuffer, 0, renderables.lightTypes);
		this.device.queue.writeBuffer(this.lightPositionBuffer, 0, renderables.lightPositions);
		this.device.queue.writeBuffer(this.lightColorBuffer, 0, renderables.lightColors);
		this.device.queue.writeBuffer(this.lightIntensityBuffer, 0, renderables.lightIntensities);
		this.device.queue.writeBuffer(this.lightDirectionBuffer, 0, renderables.lightDirections);
		this.device.queue.writeBuffer(this.lightAngleDataBuffer, 0, renderables.lightAngleData);
		this.device.queue.writeBuffer(this.lightViewProjBuffer, 0, renderables.lightViewProjMatrices);

		this.device.queue.writeBuffer(this.lightCascadeSplitsBuffer, 0, renderables.camera.cascadeRadiusArr);
		this.device.queue.writeBuffer(this.cameraPositionBuffer, 0, renderables.camera.position);

		if (debugging.visualizeLightFrustums) {
			this.device.queue.writeBuffer(
				this.inverseLightViewProjBuffer,
				0,
				renderables.inverseLightViewProjMatrices
			);
		}

		this.shadowPass(modelNodeChunks, renderables);

		this.set_joint_buffers(renderables.jointMatricesBufferList, modelNodeChunks);

		this.renderPass = <GPURenderPassEncoder>this.encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.view,
					loadOp: 'clear',
					clearValue: [0.0, 0.0, 0.0, 0.0],
					storeOp: 'store',
				},
			],
			depthStencilAttachment: this.depthStencilAttachment,
		});

		this.renderPass.setPipeline(this.skybox.pipeline);
		this.renderPass.setBindGroup(0, this.skybox.bindGroup);
		this.renderPass.draw(6, 1, 0, 0);

		this.renderChunk('opaque', modelNodeChunks.opaque);
		if (modelNodeChunks.transparent.length) {
			this.renderChunk('transparent', modelNodeChunks.transparent);
		}

		if (debugging.showAABBs) {
			this.renderPass.setPipeline(this.AABBPipeline);
			this.renderPass.setBindGroup(0, this.boundingBoxBindGroup);
			this.renderBoundingBoxes(true);
		}
		if (debugging.showOBBs) {
			this.renderPass.setPipeline(this.OBBPipeline);
			this.renderPass.setBindGroup(0, this.boundingBoxBindGroup);
			this.renderBoundingBoxes(false);
		}

		if (debugging.visualizeLightFrustums) {
			this.renderPass.setPipeline(this.lightFrustums.pipeline);
			this.renderPass.setBindGroup(0, this.lightFrustums.bindGroup);

			loop: for (let i: number = 0; i < renderables.lightTypes.length * 6; i++) {
				const lightIndex: number = ~~(i / 6);
				const layer: number = i % 6;

				switch (renderables.lightTypes[lightIndex]) {
					case LightType.SPOT:
						if (layer > 0) continue loop;
						break;
					case LightType.DIRECTIONAL:
						if (layer >= renderables.camera.cascadeCount) continue loop;
						break;
					case LightType.POINT:
						break;
				}

				this.renderPass.draw(24, 1, 0, i);
			}
		}

		this.renderPass.end();
		this.device.queue.submit([this.encoder.finish()]);
	};
}
