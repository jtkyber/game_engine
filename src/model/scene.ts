import { Mat4, mat4, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { IModelNodeChunks } from '../types/gltf';
import { IRenderData } from '../types/types';
import { nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import Model from './model';
import Player from './player';

export default class Scene {
	nodes: GLTFNode[];
	modelNodeChunks: IModelNodeChunks;
	models: Model[];
	modelTransforms: Float32Array;
	normalTransforms: Float32Array;
	camera: Camera;
	player: Player;

	constructor(nodes: GLTFNode[], modelNodeChunks: IModelNodeChunks) {
		this.nodes = nodes;
		this.modelNodeChunks = modelNodeChunks;
		this.models = [];
		this.modelTransforms = new Float32Array(16 * this.nodes.length);
		this.normalTransforms = new Float32Array(16 * this.nodes.length);
	}

	update() {
		this.camera.update();
		this.update_models();

		for (let i = 0; i < nodes.length; i++) {
			const node: GLTFNode = nodes[i];

			const modelMatrix: Mat4 = this.get_model_transform(node, node.transform);
			for (let j = 0; j < 16; j++) {
				this.modelTransforms[i * 16 + j] = modelMatrix[j];
			}

			const normalMatrix: Mat4 = mat4.transpose(mat4.invert(modelMatrix));
			for (let j = 0; j < 16; j++) {
				this.normalTransforms[i * 16 + j] = normalMatrix[j];
			}
		}

		this.sortTransparent();
	}

	update_models() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];
			model.update();
		}
	}

	get_model_transform(node: GLTFNode, transform: Mat4): Mat4 {
		const parent: GLTFNode = nodes[node?.parent] ?? null;
		if (parent === null) {
			// If root node
			return transform;
		} else if (node.flag === moveableFlag.STATIC) {
			// Never moves, so just return pre-multiplied matrix
			return transform;
		} else if (node.flag === moveableFlag.MOVEABLE_ROOT) {
			// Only moves as single chunk, so multiply by root
			// Non-root nodes pre-multiplied
			const parentMat: Mat4 = this.get_root_matrix(node.parent);
			return mat4.mul(parentMat, transform);
		} else {
			// Any part can move, so muliply all nodes by parent
			const combinedTransform: Mat4 = mat4.mul(parent.transform, transform);
			return this.get_model_transform(parent, combinedTransform);
		}
	}

	get_root_matrix(nodeIndex: number): Mat4 {
		const n: GLTFNode = nodes[nodeIndex];
		if (n.parent === null) return n.transform;
		return this.get_root_matrix(n.parent);
	}

	sortTransparent() {
		this.modelNodeChunks.transparent = this.modelNodeChunks.transparent.sort((a, b) => {
			const nodeAdist: number = vec3.dist(this.camera.position, this.models[a.nodeIndex].position);
			const nodeBdist: number = vec3.dist(this.camera.position, this.models[b.nodeIndex].position);
			return nodeBdist - nodeAdist;
		});
	}

	set_models(models: Model[], player: Player) {
		this.models = models;
		this.player = player;
		this.camera = new Camera(this.player);
	}

	get_render_data(): IRenderData {
		return {
			viewTransform: this.camera.get_view(),
			modelTransforms: this.modelTransforms,
			normalTransforms: this.normalTransforms,
		};
	}
}
