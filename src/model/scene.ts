import { Mat4, Vec3, Vec4, mat4, quat, vec3, vec4 } from 'wgpu-matrix';
import { IRenderData } from '../types/types';
import { fromRotationTranslationScale, getRotation } from '../utils/matrix';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import Model from './model';

export default class Scene {
	nodes: GLTFNode[];
	models: Model[];
	modelTransforms: Float32Array;
	camera: Camera;

	constructor(nodes: GLTFNode[]) {
		this.nodes = nodes;
		this.models = [];
		this.modelTransforms = new Float32Array(16 * this.nodes.length);
		this.camera = new Camera(vec3.create(0, 0, 2), 0, 0);
	}

	update() {
		this.update_models();
		this.camera.update();

		for (let i = 0; i < this.nodes.length; i++) {
			this.set_model_transform(this.nodes[i], this.nodes[i].transform, i);
		}
	}

	update_models() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];

			model.update();
		}
	}

	set_model_transform(node: GLTFNode, transform: Mat4, nodeIndex: number) {
		if (node.parent === null) {
			// If root node, just use model transform

			const model: Model = this.models.filter(m => m.nodeIndex === nodeIndex)[0];

			for (let i = 0; i < 16; i++) {
				this.modelTransforms[nodeIndex * 16 + i] = model.transform[i];
			}
		} else if (this.nodes[node.parent].parent === null) {
			// If only one parent

			const model: Model = this.models.filter(m => m.nodeIndex === node.parent)[0];

			// Transform by updated model translation & rotation
			let finalModelTransform: Mat4 = mat4.mul(model.transform, transform);

			for (let i = 0; i < 16; i++) {
				this.modelTransforms[nodeIndex * 16 + i] = finalModelTransform[i];
			}
		} else {
			const combinedTransform: Mat4 = mat4.mul(this.nodes[node.parent].transform, transform);
			this.set_model_transform(this.nodes[node.parent], combinedTransform, nodeIndex);
		}
	}

	set_models() {
		for (let i = 0; i < this.nodes.length; i++) {
			const node: GLTFNode = this.nodes[i];
			if (node.parent === null) {
				const model: Model = new Model(node.name, i, node.name === 'Player');
				this.models.push(model);

				model.scale = vec3.getScaling(node.transform);
				model.quat = getRotation(node.transform);
				model.position = vec3.getTranslation(node.transform);
			}
		}
	}

	get_render_data(): IRenderData {
		return {
			viewTransform: this.camera.get_view(),
			modelTransforms: this.modelTransforms,
		};
	}
}
