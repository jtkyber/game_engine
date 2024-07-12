import { Mat4, mat4, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { IRenderData } from '../types/types';
import { getRotation } from '../utils/matrix';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import Model from './model';

export default class Scene {
	nodes: GLTFNode[];
	models: Model[];
	modelTransforms: Float32Array;
	normalTransforms: Float32Array;
	camera: Camera;
	player: Model;

	constructor(nodes: GLTFNode[]) {
		this.nodes = nodes;
		this.models = [];
		this.modelTransforms = new Float32Array(16 * this.nodes.length);
		this.normalTransforms = new Float32Array(16 * this.nodes.length);
		this.camera = new Camera(vec3.create(0, 0, 2), 0, 0);
	}

	update() {
		this.update_models();
		this.camera.update();

		for (let i = 0; i < this.models.length; i++) {
			const modelMatrix: Mat4 = this.get_model_transform(this.models[i], this.models[i].transform);
			for (let j = 0; j < 16; j++) {
				this.modelTransforms[i * 16 + j] = modelMatrix[j];
			}

			const normalMatrix: Mat4 = mat4.transpose(mat4.invert(modelMatrix));
			for (let j = 0; j < 16; j++) {
				this.normalTransforms[i * 16 + j] = normalMatrix[j];
			}
		}
	}

	update_models() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];
			model.update();
		}
	}

	get_model_transform(model: Model, transform: Mat4): Mat4 {
		if (model.parent === null) {
			// If root node
			return transform;
		} else if (model.moveableFlag === moveableFlag.STATIC) {
			// Never moves, so just return pre-multiplied matrix
			return transform;
		} else if (model.moveableFlag === moveableFlag.MOVEABLE_ROOT) {
			// Only moves as single chunk, so multiply by root
			// Non-root nodes pre-multiplied
			const parentMat: Mat4 = this.get_root_matrix(model.parent);
			return mat4.mul(parentMat, transform);
		} else {
			// Any part can move, so muliply all nodes by parent
			const combinedTransform: Mat4 = mat4.mul(model.parent.transform, transform);
			return this.get_model_transform(model.parent, combinedTransform);
		}
	}

	get_root_matrix(m: Model): Mat4 {
		if (m.parent === null) return m.transform;
		return this.get_root_matrix(m.parent);
	}

	set_models() {
		const parentRefs: number[] = [];
		for (let i = 0; i < this.nodes.length; i++) {
			const node: GLTFNode = this.nodes[i];
			const isPlayer: boolean = node.name === 'Player';
			const model: Model = new Model(node.name, isPlayer, node.flag, node.transform);
			if (isPlayer) this.player = model;
			this.models.push(model);

			model.scale = vec3.getScaling(node.transform);
			model.quat = getRotation(node.transform);
			model.position = vec3.getTranslation(node.transform);

			parentRefs.push(node.parent);
		}

		if (!this.player) throw new Error('Player model not found');

		// Set model parents
		for (let i = 0; i < parentRefs.length; i++) {
			this.models[i].parent = this.models[parentRefs[i]] ?? null;
		}

		// console.log(this.models);
	}

	get_render_data(): IRenderData {
		return {
			viewTransform: this.camera.get_view(),
			modelTransforms: this.modelTransforms,
			normalTransforms: this.normalTransforms,
		};
	}
}
