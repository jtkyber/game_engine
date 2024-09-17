export default class BindGroupLayouts {
	device: GPUDevice;
	frameBindGroupLayout: GPUBindGroupLayout;
	materialBindGroupLayout: GPUBindGroupLayout;
	splatMaterialBindGroupLayout: GPUBindGroupLayout;
	jointBindGroupLayout: GPUBindGroupLayout;
	boundingBoxBindGroupLayout: GPUBindGroupLayout;
	lightingBindGroupLayout: GPUBindGroupLayout;
	terrainBindGroupLayout: GPUBindGroupLayout;
	cullingBindGroupLayout: GPUBindGroupLayout;

	constructor(device: GPUDevice) {
		this.device = device;
	}

	createBindGroupLayouts() {
		this.frameBindGroupLayout = this.device.createBindGroupLayout({
			label: 'frameBindGroupLayout',
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
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
						hasDynamicOffset: false,
					},
				},
				{
					// shadow depth texture
					binding: 3,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					texture: {
						sampleType: 'depth',
						viewDimension: '2d-array',
						multisampled: false,
					},
				},
				{
					// shadow depth sampler
					binding: 4,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					sampler: {
						type: 'comparison',
					},
				},
				{
					// light-view-proj matrix
					binding: 5,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					// SplatMapTexture
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {},
				},
				{
					// Terrain min-max
					binding: 7,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
						hasDynamicOffset: false,
					},
				},
			],
		});

		this.materialBindGroupLayout = this.device.createBindGroupLayout({
			label: 'materialBindGroupLayout',
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

		this.splatMaterialBindGroupLayout = this.device.createBindGroupLayout({
			label: 'splatMaterialBindGroupLayout',
			entries: [
				{
					// Material Params
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
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
					texture: {
						viewDimension: '2d-array',
					},
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
					texture: {
						viewDimension: '2d-array',
					},
				},
				{
					// Material Indices (rgba sorted)
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
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

		this.boundingBoxBindGroupLayout = this.device.createBindGroupLayout({
			label: 'boundingBoxBindGroupLayout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
					buffer: {
						type: 'uniform',
						hasDynamicOffset: false,
					},
				},
			],
		});

		this.lightingBindGroupLayout = this.device.createBindGroupLayout({
			label: 'lightingBindGroupLayout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 3,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 4,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 5,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'read-only-storage',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 6,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
						hasDynamicOffset: false,
					},
				},
				{
					binding: 7,
					visibility: GPUShaderStage.FRAGMENT,
					buffer: {
						type: 'uniform',
						hasDynamicOffset: false,
					},
				},
			],
		});

		this.cullingBindGroupLayout = this.device.createBindGroupLayout({
			label: 'cullingBindGroupLayout',
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.COMPUTE,
					buffer: {
						type: 'uniform',
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
						type: 'storage',
					},
				},
			],
		});
	}
}
