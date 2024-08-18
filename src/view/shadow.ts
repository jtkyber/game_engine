import vertexShadowShader from './shaders/shadowVert.wgsl';
import vertexShadowShaderSkinned from './shaders/shadowVert_skinned.wgsl';

export class Shadow {
	device: GPUDevice;
	shadowVertShader: GPUShaderModule;
	shadowVertShaderSkinned: GPUShaderModule;
	depthTexture: GPUTexture;
	depthSampler: GPUSampler;
	depthTextureSize: number;
	depthTextureView: GPUTextureView;
	depthTextureViewArray: GPUTextureView[];

	pipeline: GPURenderPipeline;
	bindGroupLayout: GPUBindGroupLayout;
	bindGroup: GPUBindGroup;

	pipelineSkinned: GPURenderPipeline;
	jointBindGroupLayout: GPUBindGroupLayout;
	jointBindGroup: GPUBindGroup;

	modelMatrixBuffer: GPUBuffer;
	lightViewProjBuffer: GPUBuffer;
	lightNum: number;

	constructor(
		device: GPUDevice,
		modelMatrixBuffer: GPUBuffer,
		lightViewProjBuffer: GPUBuffer,
		lightNum: number
	) {
		this.device = device;
		this.depthTextureSize = 1024;
		this.depthTextureViewArray = [];
		this.lightNum = lightNum;
		this.modelMatrixBuffer = modelMatrixBuffer;
		this.lightViewProjBuffer = lightViewProjBuffer;
	}

	async init() {
		this.shadowVertShader = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'shadowVertShader', code: vertexShadowShader })
		);
		this.shadowVertShaderSkinned = <GPUShaderModule>(
			this.device.createShaderModule({ label: 'shadowVertShaderSkinned', code: vertexShadowShaderSkinned })
		);
		this.createTexture();
		this.createSampler();
		this.createBindGroupLayout();
		this.createBindGroup();
		this.createPipeline();
	}

	createTexture() {
		this.depthTexture = this.device.createTexture({
			label: 'shadow depth texture',
			size: [this.depthTextureSize, this.depthTextureSize, this.lightNum * 6],
			usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
			format: 'depth24plus',
		});

		this.depthTextureView = this.depthTexture.createView({
			format: 'depth24plus',
			dimension: '2d-array',
			aspect: 'all',
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: this.lightNum * 6,
		});

		for (let i: number = 0; i < this.lightNum * 6; i++) {
			this.depthTextureViewArray[i] = this.depthTexture.createView({
				format: 'depth24plus',
				dimension: '2d',
				aspect: 'all',
				baseMipLevel: 0,
				mipLevelCount: 1,
				baseArrayLayer: i,
				arrayLayerCount: 1,
			});
		}

		this.fill_depth_textures();
	}

	fill_depth_textures() {
		const encoder = this.device.createCommandEncoder();

		for (let i: number = 0; i < this.lightNum * 6; i++) {
			const pass = encoder.beginRenderPass({
				colorAttachments: [],
				depthStencilAttachment: {
					view: this.depthTextureViewArray[i],
					depthClearValue: 0.0,
					depthLoadOp: 'clear',
					depthStoreOp: 'store',
				},
			});

			pass.end();
		}

		this.device.queue.submit([encoder.finish()]);
	}

	createSampler() {
		this.depthSampler = this.device.createSampler({
			compare: 'greater-equal',
			addressModeU: 'clamp-to-edge',
			addressModeV: 'clamp-to-edge',
			magFilter: 'linear',
			minFilter: 'linear',
		});
	}

	createBindGroupLayout() {
		this.bindGroupLayout = this.device.createBindGroupLayout({
			label: 'shadow bind group layout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'read-only-storage',
					},
				},
			],
		});

		this.jointBindGroupLayout = this.device.createBindGroupLayout({
			label: 'jointBindGroupLayout',
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

	createBindGroup() {
		this.bindGroup = this.device.createBindGroup({
			label: 'shadow bind group',
			layout: this.bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.modelMatrixBuffer,
					},
				},
				{
					binding: 1,
					resource: {
						buffer: this.lightViewProjBuffer,
					},
				},
			],
		});
	}

	createPipeline() {
		this.pipeline = this.device.createRenderPipeline({
			label: 'shadow pipeline',
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout],
			}),
			vertex: {
				module: this.shadowVertShader,
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
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'greater-equal',
				format: 'depth24plus',
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
		});

		this.pipelineSkinned = this.device.createRenderPipeline({
			label: 'shadow pipeline skinned',
			layout: this.device.createPipelineLayout({
				bindGroupLayouts: [this.bindGroupLayout, this.jointBindGroupLayout],
			}),
			vertex: {
				module: this.shadowVertShaderSkinned,
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
					{
						arrayStride: 4,
						attributes: [
							{
								// joint
								shaderLocation: 1,
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
								shaderLocation: 2,
								format: 'float32x4',
								offset: 0,
							},
						],
					},
				],
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'greater-equal',
				format: 'depth24plus',
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
		});
	}
}
