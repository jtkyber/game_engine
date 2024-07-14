import { Mat4, mat4, vec3 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { IRenderData } from '../types/types';
import { getRotation } from '../utils/matrix';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import Model from './model';
import Player from './player';

export default class Scene {
	nodes: GLTFNode[];
	models: Model[];
	modelTransforms: Float32Array;
	normalTransforms: Float32Array;
	camera: Camera;
	player: Player;

	constructor(nodes: GLTFNode[]) {
		this.nodes = nodes;
		this.models = [];
		this.modelTransforms = new Float32Array(16 * this.nodes.length);
		this.normalTransforms = new Float32Array(16 * this.nodes.length);
	}

	update() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];
			model.update();

			const modelMatrix: Mat4 = this.get_model_transform(model, model.transform);
			for (let j = 0; j < 16; j++) {
				this.modelTransforms[i * 16 + j] = modelMatrix[j];
			}

			const normalMatrix: Mat4 = mat4.transpose(mat4.invert(modelMatrix));
			for (let j = 0; j < 16; j++) {
				this.normalTransforms[i * 16 + j] = normalMatrix[j];
			}
		}

		this.camera.update();
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
		let isPlayer: boolean = false;
		let playerFound: boolean = false;
		let firstRoot: number = null;

		for (let i = 0; i < this.nodes.length; i++) {
			const node: GLTFNode = this.nodes[i];
			if (node.parent === null && !firstRoot) firstRoot = i;
			isPlayer = node.name === 'Player' && !isPlayer;
			if (isPlayer) playerFound = true;

			let model: Model | Player;
			if (isPlayer) {
				model = new Player(node.name, node.flag, node.transform);
				this.player = <Player>model;
			} else {
				model = new Model(node.name, node.flag, node.transform);
			}

			this.models.push(model);

			model.scale = vec3.getScaling(node.transform);
			model.quat = getRotation(node.transform);
			model.position = vec3.getTranslation(node.transform);

			parentRefs.push(node.parent);
		}

		if (!playerFound) {
			this.player = new Player(
				this.nodes[firstRoot].name,
				this.nodes[firstRoot].flag,
				this.nodes[firstRoot].transform
			);
			this.models.splice(firstRoot, 1, this.player);
		}

		// Set model parents
		for (let i = 0; i < parentRefs.length; i++) {
			this.models[i].parent = this.models[parentRefs[i]] ?? null;
		}

		this.camera = new Camera();
	}

	get_render_data(): IRenderData {
		return {
			viewTransform: this.camera.get_view(),
			modelTransforms: this.modelTransforms,
			normalTransforms: this.normalTransforms,
		};
	}
}
