import skyboxShader from './shaders/skybox_shader.wgsl';

export class Skybox {
	texture: GPUTexture;
	view: GPUTextureView;
	sampler: GPUSampler;
	bindGroup: GPUBindGroup;
	camDirectionBuffer: GPUBuffer;
	pipeline: GPURenderPipeline;
	skyboxShaderModule: GPUShaderModule;

	async initialize(device: GPUDevice, url: string) {
		const response: Response = await fetch(url);
		const blob: Blob = await response.blob();
		const fullImage = await createImageBitmap(blob);

		const sw: number = fullImage.width / 4;
		const sh: number = fullImage.height / 3;

		const back = await this.get_rotated(fullImage, sw * 3, sh, sw, sh, 0); // -z
		const front = await this.get_rotated(fullImage, sw, sh, sw, sh, 0); // z
		const left = await this.get_rotated(fullImage, 0, sh, sw, sh, 0); // x
		const right = await this.get_rotated(fullImage, sw * 2, sh, sw, sh, 0); // -x
		const top = await this.get_rotated(fullImage, sw, 0, sw, sh, 2); // y
		const bottom = await this.get_rotated(fullImage, sw, sh * 2, sw, sh, 2); // -y

		const imageData: ImageBitmap[] = [left, right, top, bottom, back, front];

		await this.loadImageBitmaps(device, imageData);

		this.view = this.texture.createView({
			format: 'rgba8unorm',
			dimension: 'cube',
			aspect: 'all',
			baseMipLevel: 0,
			mipLevelCount: 1,
			baseArrayLayer: 0,
			arrayLayerCount: 6,
		});

		this.sampler = device.createSampler({
			addressModeU: 'repeat',
			addressModeV: 'repeat',
			magFilter: 'linear',
			minFilter: 'nearest',
			mipmapFilter: 'nearest',
			maxAnisotropy: 1,
		});

		this.camDirectionBuffer = device.createBuffer({
			label: 'camDirectionBuffer',
			size: 4 * 4 * 3,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		const bindGroupLayout = device.createBindGroupLayout({
			label: 'skyboxBindGroupLayout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'uniform',
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {
						viewDimension: 'cube',
					},
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {},
				},
			],
		});

		this.skyboxShaderModule = <GPUShaderModule>(
			device.createShaderModule({ label: 'skyboxShaderModule', code: skyboxShader })
		);

		this.bindGroup = device.createBindGroup({
			label: 'skyboxBindGroup',
			layout: bindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.camDirectionBuffer,
					},
				},
				{
					binding: 1,
					resource: this.view,
				},
				{
					binding: 2,
					resource: this.sampler,
				},
			],
		});

		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({
				bindGroupLayouts: [bindGroupLayout],
			}),
			vertex: {
				module: this.skyboxShaderModule,
				entryPoint: 'v_main',
			},
			fragment: {
				module: this.skyboxShaderModule,
				entryPoint: 'f_main',
				targets: [
					{
						format: navigator.gpu.getPreferredCanvasFormat(),
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
			},
			depthStencil: {
				format: 'depth24plus',
				depthWriteEnabled: true,
				depthCompare: 'greater-equal',
			},
		});
	}

	async get_rotated(
		fullImage: ImageBitmap,
		dx: number,
		dy: number,
		sw: number,
		sh: number,
		rotMultiplier: number
	) {
		let canvas = new OffscreenCanvas(sw, sh);
		let ctx = canvas.getContext('2d');

		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate((Math.PI / 2) * rotMultiplier);
		ctx.translate(-canvas.width / 2, -canvas.height / 2);
		ctx.drawImage(fullImage, dx, dy, sw, sh, 0, 0, sw, sh);
		const blob = await canvas.convertToBlob();
		const imageBitmap = await createImageBitmap(blob);

		return imageBitmap;
	}

	async loadImageBitmaps(device: GPUDevice, imageData: ImageBitmap[]) {
		const textureDescriptor: GPUTextureDescriptor = {
			dimension: '2d',
			size: {
				width: imageData[0].width,
				height: imageData[0].height,
				depthOrArrayLayers: 6,
			},
			format: 'rgba8unorm',
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		};

		this.texture = device.createTexture(textureDescriptor);

		for (let i = 0; i < 6; i++) {
			device.queue.copyExternalImageToTexture(
				{ source: imageData[i] },
				{ texture: this.texture, origin: [0, 0, i] },
				[imageData[i].width, imageData[i].height]
			);
		}
	}
}
