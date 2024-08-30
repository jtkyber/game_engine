import { Image as ImageJS } from 'image-js';
import { Mat4, mat4, Quat, Vec3, vec3, vec4 } from 'wgpu-matrix';
import Light from '../../model/light';
import {
	Flag,
	GLTFAnimationInterpolation,
	GLTFAnimationPath,
	GLTFComponentType,
	GLTFRenderMode,
	GLTFTextureFilter,
	GLTFTextureWrap,
} from '../../types/enums';
import {
	get8byteMultipleFromComponentType,
	IGLTFAccessor,
	IGLTFAnimationChannel,
	IGLTFAnimationSampler,
	IGLTFBufferView,
	IGLTFImage,
	IGLTFNode,
	IGLTFPrimitive,
	IGLTFScene,
	IModelNodeChunks,
	typedArrayFromComponentType,
} from '../../types/gltf';
import { getFlagType, TypedArray } from '../../types/types';
import { fromRotationTranslationScale } from '../../utils/matrix';
import { getPixel } from '../../utils/misc';
import GLTFAccessor from './accessor';
import GLTFAnimation from './animation';
import GLTFAnimationChannel from './animationChannel';
import GLTFAnimationSampler from './animationSampler';
import { GLTFBuffer } from './buffer';
import GLTFBufferView from './bufferView';
import GLTFImage from './image';
import GLTFMaterial from './materials';
import GLTFMesh from './mesh';
import GLTFNode from './node';
import GLTFPrimitive from './primitive';
import { GLTFSampler } from './sampler';
import GLTFSkin from './skin';
import { GLTFTexture } from './texture';

export const nodes: GLTFNode[] = [];
export let models: number[] = [];
export const animations: { [key: string]: GLTFAnimation } = {};
export let terrainHeightMap: Float32Array = null;
export let terrainHeightMapSize: number;

export default class GTLFLoader {
	device: GPUDevice;
	jsonChunk: any;
	binaryChunk: GLTFBuffer;
	bufferViews: GLTFBufferView[];
	accessors: GLTFAccessor[];
	images: GLTFImage[];
	samplers: GLTFSampler[];
	textures: GLTFTexture[];
	materials: GLTFMaterial[];
	primitives: GLTFPrimitive[];
	skins: GLTFSkin[];
	meshes: GLTFMesh[];
	lights: Light[];
	modelNodeChunks: IModelNodeChunks;
	meshNode: GLTFNode;
	player: number;
	indexSwapBoard: {
		[key: number]: number;
	};
	allJoints: Set<number>;
	terrainNodeIndex: number;

	constructor(device: GPUDevice) {
		this.device = device;
		this.bufferViews = [];
		this.accessors = [];
		this.images = [];
		this.samplers = [];
		this.textures = [];
		this.materials = [];
		this.primitives = [];
		this.meshes = [];
		this.skins = [];
		this.lights = [];
		this.modelNodeChunks = {
			opaque: [],
			transparent: [],
		};
		this.indexSwapBoard = {};
		this.allJoints = new Set();
	}

	async get_terrain_height_map(url: string) {
		const img = await ImageJS.load(url);
		if (img.width !== img.height) {
			throw new Error('Height map image must be a square');
		}
		const imgData = img.data;
		const imgChannels = img.channels;
		const maxValue = img.bitDepth === 8 ? 255 : 65535;

		const tHeightMax: number = 46;

		terrainHeightMap = new Float32Array(img.data.length / imgChannels);
		terrainHeightMapSize = img.width;

		for (let i = 0; i < terrainHeightMap.length; i++) {
			terrainHeightMap[i] = (imgData[i * imgChannels] / maxValue) * tHeightMax;
		}

		await this.load_terrain();

		console.log('terrain height map loaded');
	}

	async load_terrain() {
		const node: GLTFNode = nodes[this.terrainNodeIndex];

		for (let i = 0; i < node.mesh.primitives.length; i++) {
			const meshBufferView: GLTFBufferView = node.mesh.primitives[i].positions.bufferView;
			const componentType: GLTFComponentType = node.mesh.primitives[i].normals.componentType;
			const mesh: TypedArray = new (typedArrayFromComponentType(componentType))(
				meshBufferView.view.buffer,
				meshBufferView.view.byteOffset,
				meshBufferView.view.byteLength / get8byteMultipleFromComponentType(componentType)
			);

			this.createGridMesh(terrainHeightMap, terrainHeightMapSize, mesh);
			meshBufferView.modifyBuffer(this.device, mesh);

			this.load_terrain_normals(mesh, i);
		}
	}

	async load_terrain_normals(positionMesh: TypedArray, pIndex: number) {
		const node: GLTFNode = nodes[this.terrainNodeIndex];
		const meshNormalsBufferView: GLTFBufferView = node.mesh.primitives[pIndex].normals.bufferView;
		const normalComponentType: GLTFComponentType = node.mesh.primitives[pIndex].normals.componentType;

		const meshIndicesBufferView: GLTFBufferView = node.mesh.primitives[pIndex].indices.bufferView;
		const indexComponentType: GLTFComponentType = node.mesh.primitives[pIndex].indices.componentType;

		const meshNormals: TypedArray = new (typedArrayFromComponentType(normalComponentType))(
			meshNormalsBufferView.view.buffer,
			meshNormalsBufferView.view.byteOffset,
			meshNormalsBufferView.view.byteLength / get8byteMultipleFromComponentType(normalComponentType)
		);
		const meshIndices: TypedArray = new (typedArrayFromComponentType(indexComponentType))(
			meshIndicesBufferView.view.buffer,
			meshIndicesBufferView.view.byteOffset,
			meshIndicesBufferView.view.byteLength / get8byteMultipleFromComponentType(indexComponentType)
		);

		for (let i = 0; i < meshNormals.length; i++) meshNormals[i] = 0;

		for (let i = 0; i < meshIndices.length; i += 3) {
			const i1 = meshIndices[i] * 3;
			const i2 = meshIndices[i + 1] * 3;
			const i3 = meshIndices[i + 2] * 3;

			const p1: Vec3 = vec3.fromValues(positionMesh[i1], positionMesh[i1 + 1], positionMesh[i1 + 2]);
			const p2: Vec3 = vec3.fromValues(positionMesh[i2], positionMesh[i2 + 1], positionMesh[i2 + 2]);
			const p3: Vec3 = vec3.fromValues(positionMesh[i3], positionMesh[i3 + 1], positionMesh[i3 + 2]);

			const dir1: Vec3 = vec3.sub(p2, p1);
			const dir2: Vec3 = vec3.sub(p3, p1);

			const n: Vec3 = vec3.normalize(vec3.cross(dir1, dir2));

			for (let j = 0; j < 3; j++) {
				meshNormals[i1 + j] += n[j];
				meshNormals[i2 + j] += n[j];
				meshNormals[i3 + j] += n[j];
			}
		}

		for (let i = 0; i < meshNormals.length; i += 3) {
			const n = vec3.normalize(vec3.fromValues(meshNormals[i], meshNormals[i + 1], meshNormals[i + 2]));
			meshNormals[i] = n[0];
			meshNormals[i + 1] = n[1];
			meshNormals[i + 2] = n[2];
		}

		meshNormalsBufferView.modifyBuffer(this.device, meshNormals);
	}

	createGridMesh(heightMap: Float32Array, heightMapSize: number, gridMesh: TypedArray) {
		for (let i = 0; i < gridMesh.length; i += 3) {
			const mapSize: number = nodes[this.terrainNodeIndex].max[0] - nodes[this.terrainNodeIndex].min[0];

			const nFractAlongMeshX: number = (gridMesh[i] - nodes[this.terrainNodeIndex].min[0]) / mapSize;
			const nFractAlongMeshY: number = (gridMesh[i + 2] - nodes[this.terrainNodeIndex].min[2]) / mapSize;

			const col: number = Math.floor(nFractAlongMeshX * (heightMapSize - 1));
			const row: number = Math.floor(nFractAlongMeshY * (heightMapSize - 1));

			let terrainHeight = getPixel(heightMap, row, col, heightMapSize);
			if (col === heightMapSize - 1 || row === heightMapSize - 1 || col === 0 || row === 0) {
				terrainHeight = 0;
			}

			gridMesh[i + 1] = terrainHeight;
		}
	}

	async parse_gltf(url: string): Promise<void> {
		const glb: ArrayBuffer = await fetch(`${url}.glb`).then(res => res.arrayBuffer());
		await this.validate(glb);
	}

	async validate(buffer: ArrayBuffer): Promise<void> {
		const header = new Uint32Array(buffer, 0, 5);
		// Validate glb file contains correct magic value
		if (header[0] != 0x46546c67) {
			throw Error('Provided file is not a glB file');
		}
		if (header[1] != 2) {
			throw Error('Provided file is glTF 2.0 file');
		}
		// Validate that first chunk is JSON
		if (header[4] != 0x4e4f534a) {
			throw Error('Invalid glB: The first chunk of the glB file is not a JSON chunk!');
		}

		console.log('.glb file validated');

		await this.set_chunks(buffer, header);
	}

	async set_chunks(buffer: ArrayBuffer, header: Uint32Array): Promise<void> {
		this.jsonChunk = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(buffer, 20, header[3])));

		const binaryHeader = new Uint32Array(buffer, 20 + header[3], 2);
		if (binaryHeader[1] != 0x004e4942) {
			throw Error('Invalid glB: The second chunk of the glB file is not a binary chunk!');
		}

		this.binaryChunk = new GLTFBuffer(buffer, 28 + header[3], binaryHeader[0]);

		console.log('gltf json and binary extracted');

		await this.load_gltf_constants();
	}

	async load_gltf_constants(): Promise<void> {
		this.load_buffer_views();
		this.load_accessors();
		await this.load_images();
		this.load_samplers();
		this.load_textures();
		this.loadMaterials();
		this.load_skins();
		this.load_meshes();
		this.load_animations();

		for (let i = 0; i < this.bufferViews.length; ++i) {
			if (this.bufferViews[i].needsUpload) {
				this.bufferViews[i].upload(this.device);
			}
		}

		this.images.forEach((img: GLTFImage) => {
			img.upload(this.device);
		});
		this.samplers.forEach((s: GLTFSampler) => {
			s.create(this.device);
		});
		this.materials.forEach((mat: GLTFMaterial) => {
			mat.upload(this.device);
		});
		this.skins.forEach((skin: GLTFSkin) => {
			skin.upload(this.device);
		});
	}

	load_buffer_views() {
		for (let i = 0; i < this.jsonChunk['bufferViews'].length; i++) {
			const bufferView: IGLTFBufferView = this.jsonChunk['bufferViews'][i];
			this.bufferViews.push(new GLTFBufferView(this.binaryChunk, bufferView));
		}
		console.log('gltf buffer views loaded');
	}

	load_accessors() {
		for (let i = 0; i < this.jsonChunk['accessors'].length; i++) {
			const accessor: IGLTFAccessor = this.jsonChunk['accessors'][i];
			let viewID = accessor['bufferView'];
			this.accessors.push(new GLTFAccessor(this.bufferViews[viewID], accessor));
		}
		console.log('gltf accessors views loaded');
	}

	async load_images() {
		if (!this.jsonChunk.images) {
			this.images = [];
			return;
		}

		for (let i = 0; i < this.jsonChunk['images'].length; i++) {
			const img: IGLTFImage = this.jsonChunk['images'][i];
			const bv: GLTFBufferView = this.bufferViews[img['bufferView']];
			const blob = new Blob([bv.view], { type: img['mimeType'] });
			const bitmap = await createImageBitmap(blob);

			// const cvs = new OffscreenCanvas(bitmap.width, bitmap.height);
			// const ctx = cvs.getContext('2d');
			// ctx.drawImage(bitmap, 0, 0);
			// const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
			// const alphas = [];
			// for (let i = 3; i < data.data.length; i += 4) {
			// 	if (data.data[i] !== 255) alphas.push(data.data[i]);
			// }
			// console.log(alphas);

			this.images.push(new GLTFImage(img['name'], bitmap));
		}
		console.log('gltf images loaded');
	}

	load_samplers() {
		if (!this.jsonChunk.samplers) {
			this.samplers = [];
			return;
		}

		for (let i = 0; i < this.jsonChunk['samplers'].length; i++) {
			const s = this.jsonChunk['samplers'][i];
			this.samplers.push(
				new GLTFSampler(
					s['magFilter'] as GLTFTextureFilter,
					s['minFilter'] as GLTFTextureFilter,
					s['wrapS'] as GLTFTextureWrap,
					s['wrapT'] as GLTFTextureWrap
				)
			);
		}
		console.log('gltf samplers loaded');
	}

	load_textures() {
		const defaultSampler = new GLTFSampler(
			GLTFTextureFilter.LINEAR,
			GLTFTextureFilter.LINEAR,
			GLTFTextureWrap.REPEAT,
			GLTFTextureWrap.REPEAT
		);
		let usedDefaultSampler = false;

		if (!this?.jsonChunk['textures']?.length) {
			this.textures = [];
			return;
		}

		for (let i = 0; i < this.jsonChunk['textures'].length; i++) {
			const t = this.jsonChunk['textures'][i];
			let sampler = null;
			if ('sampler' in t) {
				sampler = this.samplers[t['sampler']];
			} else {
				sampler = defaultSampler;
				usedDefaultSampler = true;
			}
			this.textures.push(new GLTFTexture(sampler, this.images[t['source']]));
			new GLTFTexture(sampler, this.images[t['source']]);
		}

		if (usedDefaultSampler) {
			this.samplers.push(defaultSampler);
		}
		console.log('gltf textures loaded');
	}

	loadMaterials() {
		for (let m of this.jsonChunk['materials']) {
			const pbrMR = m['pbrMetallicRoughness'];
			// Default base color factor of 1, 1, 1
			const baseColorFactor = pbrMR['baseColorFactor'] ?? [1, 1, 1, 1];
			const metallicFactor = pbrMR['metallicFactor'] ?? 1;
			const roughnessFactor = pbrMR['roughnessFactor'] ?? 1;
			const alphaMode = m['alphaMode'] ?? null;
			const emissiveFactor = m['emissiveFactor'] ?? [0, 0, 0];

			let baseColorTexture: GLTFTexture | null = null;
			if ('baseColorTexture' in pbrMR) {
				baseColorTexture = this.textures[pbrMR['baseColorTexture']['index']];
			}
			let metallicRoughnessTexture: GLTFTexture | null = null;
			if ('metallicRoughnessTexture' in pbrMR) {
				metallicRoughnessTexture = this.textures[pbrMR['metallicRoughnessTexture']['index']];
			}

			this.materials.push(
				new GLTFMaterial(
					baseColorFactor,
					baseColorTexture,
					metallicFactor,
					roughnessFactor,
					metallicRoughnessTexture,
					emissiveFactor,
					alphaMode
				)
			);
		}
		console.log('gltf materials loaded');
	}

	load_skins() {
		for (let i = 0; i < this.jsonChunk?.['skins']?.length; i++) {
			const skin = this.jsonChunk['skins'][i];
			const name: string = skin.name;
			const inverseBindMatrices: GLTFAccessor = this.accessors[skin.inverseBindMatrices];
			const joints: number[] = [...skin['joints']];
			this.skins.push(new GLTFSkin(name, inverseBindMatrices, joints));
		}
	}

	load_meshes() {
		for (let mesh of this.jsonChunk.meshes) {
			let meshPrimitives = [];
			for (let i = 0; i < mesh['primitives'].length; i++) {
				const prim: IGLTFPrimitive = mesh['primitives'][i];
				let topology = prim['mode'] ?? GLTFRenderMode.TRIANGLES;

				if (topology != GLTFRenderMode.TRIANGLES && topology != GLTFRenderMode.TRIANGLE_STRIP) {
					throw Error(`Unsupported primitive mode ${prim['mode']}`);
				}

				let indices = null;
				if (this.jsonChunk['accessors'][prim['indices']] !== undefined) {
					indices = this.accessors[prim['indices']];
				}

				let positions = null;
				let texcoords = null;
				let normals = null;
				let joints = null;
				let weights = null;
				let colors = null;
				for (let attr in prim['attributes']) {
					let accessor = this.accessors[(prim['attributes'] as any)[attr]];

					switch (attr) {
						case 'POSITION':
							positions = accessor;
							break;
						case 'TEXCOORD_0':
							texcoords = accessor;
							break;
						case 'NORMAL':
							normals = accessor;
							break;
						case 'JOINTS_0':
							joints = accessor;
							break;
						case 'WEIGHTS_0':
							weights = accessor;
							break;
						case 'COLOR_0':
							colors = accessor;
							break;
					}
				}

				let mat = this.materials[prim['material']];

				meshPrimitives.push(
					new GLTFPrimitive(mat, indices, positions, normals, colors, texcoords, joints, weights, topology)
				);
			}
			this.meshes.push(new GLTFMesh(mesh['name'], meshPrimitives));
			this.primitives.push(...meshPrimitives);
		}
		console.log('gltf meshes loaded');
	}

	load_animations() {
		for (let i = 0; i < this.jsonChunk?.['animations']?.length; i++) {
			const animation = this.jsonChunk['animations'][i];
			const samplers: GLTFAnimationSampler[] = this.get_animation_samplers(animation['samplers']);
			const channels: GLTFAnimationChannel[] = this.get_animation_channels(animation['channels'], samplers);

			animations[animation['name']] = new GLTFAnimation(animation['name'], channels);
		}
	}

	get_animation_samplers(samplers: IGLTFAnimationSampler[]): GLTFAnimationSampler[] {
		const allSamplers: GLTFAnimationSampler[] = [];
		for (let s of samplers) {
			const input: GLTFAccessor = this.accessors[s['input']];
			const output: GLTFAccessor = this.accessors[s['output']];
			let interpolation: GLTFAnimationInterpolation = null;

			switch (s['interpolation']) {
				case 'STEP':
					interpolation = GLTFAnimationInterpolation.STEP;
					break;
				case 'LINEAR':
					interpolation = GLTFAnimationInterpolation.LINEAR;
					break;
				case 'CUBICSPLINE':
					interpolation = GLTFAnimationInterpolation.CUBICSPLINE;
					break;
			}

			allSamplers.push(new GLTFAnimationSampler(input, output, interpolation));
		}

		return allSamplers;
	}

	get_animation_channels(channels: IGLTFAnimationChannel[], samplers: GLTFAnimationSampler[]) {
		const allChannels: GLTFAnimationChannel[] = [];
		for (let c of channels) {
			const sampler: GLTFAnimationSampler = samplers[c['sampler']];
			const targetNode: number = c['target'].node;
			let path: GLTFAnimationPath = null;

			switch (c['target']['path']) {
				case 'translation':
					path = GLTFAnimationPath.TRANSLATION;
					break;
				case 'rotation':
					path = GLTFAnimationPath.ROTATION;
					break;
				case 'scale':
					path = GLTFAnimationPath.SCALE;
					break;
				case 'weights':
					path = GLTFAnimationPath.WEIGHTS;
					break;
			}

			allChannels.push(new GLTFAnimationChannel(sampler, targetNode, path));
		}

		return allChannels;
	}

	load_scene(scene_index: number): IGLTFScene {
		const scene = this.jsonChunk['scenes'][scene_index];
		const baseNodeRefs: number[] = scene['nodes'];
		const allNodes: IGLTFNode[] = this.jsonChunk['nodes'];

		for (let i = 0; i < baseNodeRefs.length; i++) {
			const node = allNodes[baseNodeRefs[i]];
			let flag: Flag;

			const lastIndex: number = node['name'].lastIndexOf('_');
			flag = getFlagType(node['name'].substring(lastIndex + 1));

			if (flag !== null) node['name'] = node['name'].substring(0, lastIndex);

			this.load_nodes(allNodes, baseNodeRefs[i], flag);
		}

		// Pre-multiply transforms based on flag
		// for (let i = 0; i < nodes.length; i++) {
		// 	const modelMatrix: Mat4 = this.transform_matrices(<GLTFNode>nodes[i], nodes[i].transform);
		// 	nodes[i].transform = modelMatrix;
		// }

		this.remap_joint_indices();
		this.setup_models();
		this.set_bounding_boxes();
		console.log('gltf nodes loaded');

		return <IGLTFScene>{
			player: this.player,
			lights: this.lights,
			modelNodeChunks: this.modelNodeChunks,
		};
	}

	set_bounding_boxes() {
		for (let i = 0; i < models.length; i++) {
			const model: GLTFNode = nodes[models[i]];
			let min: Vec3 = vec3.create(Infinity, Infinity, Infinity);
			let max: Vec3 = vec3.create(-Infinity, -Infinity, -Infinity);

			if (model.minValues?.length && model.maxValues?.length) {
				min = model.minValues?.reduce((acc, cur) => {
					return vec3.create(Math.min(acc[0], cur[0]), Math.min(acc[1], cur[1]), Math.min(acc[2], cur[2]));
				}, min);

				max = model.maxValues?.reduce((acc, cur) => {
					return vec3.create(Math.max(acc[0], cur[0]), Math.max(acc[1], cur[1]), Math.max(acc[2], cur[2]));
				}, max);
			}

			function set_min_max(children: number[]) {
				for (let c of children) {
					const cMins: Vec3[] = nodes[c].minValues;
					const cMaxs: Vec3[] = nodes[c].maxValues;
					if (!cMins || !cMaxs) continue;

					const cMin: Vec3 = cMins.reduce((acc, cur) => {
						return vec3.create(Math.min(acc[0], cur[0]), Math.min(acc[1], cur[1]), Math.min(acc[2], cur[2]));
					}, vec3.create(Infinity, Infinity, Infinity));

					const cMax: Vec3 = cMaxs.reduce((acc, cur) => {
						return vec3.create(Math.max(acc[0], cur[0]), Math.max(acc[1], cur[1]), Math.max(acc[2], cur[2]));
					}, vec3.create(-Infinity, -Infinity, -Infinity));

					min[0] = Math.min(min[0], cMin[0]);
					min[1] = Math.min(min[1], cMin[1]);
					min[2] = Math.min(min[2], cMin[2]);

					max[0] = Math.max(max[0], cMax[0]);
					max[1] = Math.max(max[1], cMax[1]);
					max[2] = Math.max(max[2], cMax[2]);

					if (nodes[c].children.length) set_min_max(nodes[c].children);
				}
			}

			set_min_max(model.children);

			// Center min and max values around world origin + 1/2 Y
			{
				const height: number = max[1] - min[1];
				const center: Vec3 = vec3.create((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);

				min[0] = min[0] - center[0];
				min[1] = min[1] - center[1] + height / 2;
				min[2] = min[2] - center[2];

				max[0] = max[0] - center[0];
				max[1] = max[1] - center[1] + height / 2;
				max[2] = max[2] - center[2];
			}

			// Adjust player bb widths
			if (models[i] === this.player) {
				const xLen: number = max[0] - min[0];
				const zLen: number = max[2] - min[2];
				if (xLen > zLen) {
					const ratio: number = zLen / xLen;
					const lenToCut: number = xLen * ratio;
					min[0] += lenToCut / 2;
					max[0] -= lenToCut / 2;
				} else {
					const ratio: number = xLen / zLen;
					const lenToCut: number = zLen * ratio;
					min[0] += lenToCut / 2;
					max[0] -= lenToCut / 2;
				}
			}

			model.min = min;
			model.max = max;
			model.height = max[1] - min[1];

			model.initialize_bounding_boxes();
		}
	}

	remap_joint_indices() {
		for (let i = 0; i < this.skins.length; i++) {
			for (let j = 0; j < this.skins[i].joints.length; j++) {
				this.skins[i].joints[j] = this.indexSwapBoard[this.skins[i].joints[j]];
				this.allJoints.add(this.skins[i].joints[j]);
			}
		}

		for (let a in animations) {
			for (let i = 0; i < animations[a].channels.length; i++) {
				const channel: GLTFAnimationChannel = animations[a].channels[i];
				channel.targetNode = this.indexSwapBoard[channel.targetNode];
			}
		}

		this.terrainNodeIndex = this.indexSwapBoard[this.terrainNodeIndex];
	}

	load_nodes(
		allNodes: IGLTFNode[],
		n: number,
		flag: Flag,
		parentNode: number = null,
		rootNode: number = null,
		isRoot: boolean = true
	) {
		const node: IGLTFNode = allNodes[n];
		const matrix: Mat4 = this.get_node_matrix(node);
		let scale: Vec3 = node['scale'] ?? vec3.create(1, 1, 1);
		let rotation: Quat = node['rotation'] ?? vec4.create(0, 0, 0, 1);
		let translation: Vec3 = node['translation'] ?? vec3.create(0, 0, 0);
		const children: number[] = isRoot && node['children'] ? node['children'] : [];
		const name: string = node.name;
		const mesh: GLTFMesh = this.meshes[node['mesh']] ?? null;
		const skin: GLTFSkin = this.skins[node['skin']] ?? null;
		const minValues: Vec3[] = mesh?.primitives.map(p => p.positions.min) ?? null;
		const maxValues: Vec3[] = mesh?.primitives.map(p => p.positions.max) ?? null;
		const mass: number = node?.extras?.mass ?? null;
		const speed: number = node?.extras?.speed ?? 0;
		const hasBoundingBox: boolean = node?.extras?.hasBoundingBox ?? true;
		const hasPhysics: boolean = node?.extras?.hasPhysics ?? false;

		nodes.push(
			new GLTFNode(
				this.device,
				name,
				flag,
				parentNode,
				children,
				rootNode,
				translation,
				rotation,
				scale,
				matrix,
				mesh,
				skin,
				minValues,
				maxValues,
				mass,
				speed,
				hasBoundingBox,
				hasPhysics
			)
		);
		const lastNodeIndex: number = nodes.length - 1;

		if (name === 'Terrain') this.terrainNodeIndex = lastNodeIndex;

		this.indexSwapBoard[n] = lastNodeIndex;

		const lightRef: number = node?.['extensions']?.['KHR_lights_punctual']?.['light'];
		if (lightRef !== undefined) {
			const lightDetails = this.jsonChunk['extensions']['KHR_lights_punctual']['lights'][lightRef];

			const lightName: string = lightDetails['name'];
			const lightType: string = lightDetails['type'];
			const lightIntensity: number = lightDetails['intensity'];
			const lightColor: Vec3 = lightDetails['color'];
			let innerConeAngle = null;
			let outerConeAngle = null;

			if (lightType === 'spot') {
				innerConeAngle = lightDetails['spot']['innerConeAngle'];
				outerConeAngle = lightDetails['spot']['outerConeAngle'];
			}

			this.lights.push(
				new Light(
					lightName,
					lightType,
					lightIntensity,
					lightColor,
					innerConeAngle,
					outerConeAngle,
					lastNodeIndex
				)
			);
		} else if (isRoot) {
			models.push(lastNodeIndex);
		}

		for (let i = 0; i < mesh?.primitives.length; i++) {
			const prim: GLTFPrimitive = mesh.primitives[i];
			if (prim?.material?.isTransparent) {
				this.modelNodeChunks.transparent.push({ nodeIndex: lastNodeIndex, primitiveIndex: i });
			} else this.modelNodeChunks.opaque.push({ nodeIndex: lastNodeIndex, primitiveIndex: i });
		}

		if (node['children']) {
			const pNode = nodes.length - 1;
			for (let i = 0; i < node['children'].length; i++) {
				this.load_nodes(allNodes, node['children'][i], flag, pNode, isRoot ? pNode : rootNode, false);
			}
		}
	}

	setup_models(): void {
		let playerFound: boolean = false;

		for (let i = 0; i < models.length; i++) {
			let model: GLTFNode = nodes[models[i]];
			for (let j = 0; j < model.children.length; j++) {
				model.children[j] = this.indexSwapBoard[model.children[j]];
			}
			if (model.name === 'Player' && !playerFound) {
				this.player = models[i];
				playerFound = true;
			}
		}

		for (let i = 0; i < nodes.length; i++) nodes[i].terrainNodeIndex = this.terrainNodeIndex;
	}

	// transform_matrices(node: GLTFNode, transform: Mat4): Mat4 {
	// 	if (node.parent === null) {
	// 		// If root node
	// 		return transform;
	// 	} else if (node.flag === Flag.STATIC) {
	// 		// Multiply up the parent chain, including root node
	// 		let parentMat: Mat4 = nodes[node.parent].transform;
	// 		const combinedTransform: Mat4 = mat4.mul(parentMat, transform);
	// 		return combinedTransform;
	// 	} else if (node.flag === Flag.MOVEABLE_ROOT) {
	// 		// Multiply up the parent chain, excluding root node
	// 		if (nodes[node.parent].parent === null) {
	// 			// If parent is root node
	// 			return transform;
	// 		} else {
	// 			const combinedTransform: Mat4 = mat4.mul(nodes[node.parent].transform, transform);
	// 			return this.transform_matrices(nodes[node.parent], combinedTransform);
	// 		}
	// 	} else {
	// 		// No Pre-multiplication up the parent chain
	// 		return transform;
	// 	}
	// }

	get_node_matrix(node: IGLTFNode): Mat4 {
		if (node['matrix']) {
			const m = node['matrix'];

			return mat4.set(
				m[0],
				m[1],
				m[2],
				m[3],
				m[4],
				m[5],
				m[6],
				m[7],
				m[8],
				m[9],
				m[10],
				m[11],
				m[12],
				m[13],
				m[14],
				m[15]
			);
		} else {
			let scale: Vec3 = vec3.create(1, 1, 1);
			let rotation: Quat = vec4.create(0, 0, 0, 1);
			let translation: Vec3 = vec3.create(0, 0, 0);

			if (node['scale']) {
				scale = node['scale'];
			}
			if (node['rotation']) {
				rotation = node['rotation'];
			}
			if (node['translation']) {
				translation = node['translation'];
			}

			const m = mat4.create();
			return fromRotationTranslationScale(m, rotation, translation, scale);
		}
	}
}
