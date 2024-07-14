import { Mat4, Quat, Vec3, mat4, vec3, vec4 } from 'wgpu-matrix';
import { GLTFRenderMode, GLTFTextureFilter, GLTFTextureWrap, moveableFlag } from '../../types/enums';
import { IGLTFAccessor, IGLTFBufferView, IGLTFImage, IGLTFNode, IGLTFPrimitive } from '../../types/gltf';
import { getMoveableFlagType } from '../../types/types';
import { fromRotationTranslationScale, zUpTransformation } from '../../utils/matrix';
import GLTFAccessor from './accessor';
import { GLTFBuffer } from './buffer';
import GLTFBufferView from './bufferView';
import GLTFImage from './image';
import GLTFLight from './light';
import GLTFMaterial from './materials';
import GLTFMesh from './mesh';
import GLTFNode from './node';
import GLTFPrimitive from './primitive';
import { GLTFSampler } from './sampler';
import { GLTFTexture } from './texture';

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
	meshes: GLTFMesh[];
	nodes: GLTFNode[];
	lights: GLTFLight[];

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
		this.nodes = [];
		this.lights = [];
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

		// console.log(this.jsonChunk);

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
		this.load_meshes();

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
					metallicRoughnessTexture
				)
			);
		}
		console.log('gltf materials loaded');
	}

	load_meshes() {
		for (let mesh of this.jsonChunk.meshes) {
			let meshPrimitives = [];
			for (let i = 0; i < mesh['primitives'].length; i++) {
				const prim: IGLTFPrimitive = mesh['primitives'][i];
				let topology = prim['mode'];

				if (topology === undefined) topology = GLTFRenderMode.TRIANGLES;

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
						case 'COLOR_0':
							colors = accessor;
							break;
					}
				}

				let mat = this.materials[prim['material']];

				meshPrimitives.push(new GLTFPrimitive(mat, indices, positions, normals, colors, texcoords, topology));
			}
			this.meshes.push(new GLTFMesh(mesh['name'], meshPrimitives));
			this.primitives.push(...meshPrimitives);
		}
		console.log('gltf meshes loaded');
	}

	load_scene(scene_index: number): GLTFNode[] {
		const scene = this.jsonChunk['scenes'][scene_index];
		const baseNodeRefs: number[] = scene['nodes'];
		const allNodes: IGLTFNode[] = this.jsonChunk['nodes'];

		for (let i = 0; i < baseNodeRefs.length; i++) {
			const node = allNodes[baseNodeRefs[i]];
			let flag: moveableFlag;

			const lastIndex: number = node['name'].lastIndexOf('_');
			flag = getMoveableFlagType(node['name'].substring(lastIndex + 1));

			if (flag !== null) node['name'] = node['name'].substring(0, lastIndex);

			this.load_nodes(allNodes, baseNodeRefs[i], flag);
		}

		// this.transform_static_roots_to_zUP();

		// Pre-multiply transforms based on flag
		for (let i = 0; i < this.nodes.length; i++) {
			const modelMatrix: Mat4 = this.transform_matrices(<GLTFNode>this.nodes[i], this.nodes[i].transform);
			this.nodes[i].transform = modelMatrix;
		}

		console.log('gltf nodes loaded');
		return <GLTFNode[]>this.nodes;
	}

	load_nodes(allNodes: IGLTFNode[], n: number, flag: number, nodeNum: number = null) {
		const node: IGLTFNode = allNodes[n];
		const matrix: Mat4 = this.get_node_matrix(node);
		const name: string = node.name;

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
				new GLTFLight(
					lightName,
					lightType,
					lightIntensity,
					lightColor,
					innerConeAngle,
					outerConeAngle,
					matrix
				)
			);

			return;
		}

		this.nodes.push(new GLTFNode(name, flag, nodeNum, matrix, this.meshes[node['mesh']]));

		if (node['children']) {
			const parentNode = this.nodes.length - 1;
			for (let i = 0; i < node['children'].length; i++) {
				this.load_nodes(allNodes, node['children'][i], flag, parentNode);
			}
		}
	}

	transform_static_roots_to_zUP() {
		for (let i = 0; i < this.nodes.length; i++) {
			const node: GLTFNode = this.nodes[i];
			if (node.parent === null && node.flag === moveableFlag.STATIC) {
				node.transform = mat4.mul(zUpTransformation(), node.transform);
			}
		}
	}

	transform_matrices(node: GLTFNode, transform: Mat4): Mat4 {
		if (node.parent === null) {
			// If root node
			return transform;
		} else if (node.flag === moveableFlag.STATIC) {
			// Multiply up the parent chain, including root node
			let parentMat: Mat4 = this.nodes[node.parent].transform;
			const combinedTransform: Mat4 = mat4.mul(parentMat, transform);
			return combinedTransform;
		} else if (node.flag === moveableFlag.MOVEABLE_ROOT) {
			// Multiply up the parent chain, excluding root node
			if (this.nodes[node.parent].parent === null) {
				// If parent is root node
				return transform;
			} else {
				const combinedTransform: Mat4 = mat4.mul(this.nodes[node.parent].transform, transform);
				return this.transform_matrices(this.nodes[node.parent], combinedTransform);
			}
		} else {
			// No Pre-multiplication up the parent chain
			return transform;
		}
	}

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
