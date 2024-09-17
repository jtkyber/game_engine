import { ImageUsage } from '../../types/enums';

export default class GLTFImage {
	name: string;
	bitmap: ImageBitmap;
	usage: ImageUsage;
	image: GPUTexture;
	view: GPUTextureView;

	constructor(name: string, bitmap: ImageBitmap) {
		this.name = name;
		this.bitmap = bitmap;
	}

	setUsage(usage: ImageUsage) {
		this.usage = usage;
	}

	upload(device: GPUDevice) {
		let format: GPUTextureFormat = 'rgba8unorm-srgb';
		switch (this.usage) {
			case ImageUsage.BASE_COLOR:
				format = 'rgba8unorm-srgb';
				break;
			case ImageUsage.METALLIC_ROUGHNESS:
				format = 'rgba8unorm';
				break;
			case ImageUsage.EMISSION:
				format = 'rgba8unorm';
				break;
			case ImageUsage.NORMAL:
			case ImageUsage.OCCLUSION:
				throw new Error('Unhandled image format for now, TODO!');
		}

		const imgSize = [this.bitmap.width, this.bitmap.height, 1];
		this.image = device.createTexture({
			label: 'Image Texture',
			size: imgSize,
			format: format,
			usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
		});

		device.queue.copyExternalImageToTexture(
			{ source: this.bitmap },
			{ texture: this.image, premultipliedAlpha: true },
			imgSize
		);

		this.view = this.image.createView();
	}
}
