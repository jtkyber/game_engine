import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from 'wgpu-matrix';
import { IRenderData } from '../types/types';
import { fromRotationTranslationScale } from '../utils/gltf';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import Model from './model';

export default class Scene {
	nodes: GLTFNode[];
	models: Model[];
	modelTransforms: Float32Array;
	camera: Camera;
	zUpTransformation: Mat4;

	constructor(nodes: GLTFNode[]) {
		this.nodes = nodes;
		this.models = [];
		this.modelTransforms = new Float32Array(16 * this.nodes.length);
		this.camera = new Camera(vec3.create(0, 0, 2), 0, 0);
		this.zUpTransformation = mat4.create(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
	}

	update() {
		this.update_models();
		this.camera.update();

		for (let i = 0; i < this.nodes.length; i++) {
			// Rethink this
			this.set_model_transform(this.nodes[i], this.nodes[i].transform, i, i);
		}
	}

	update_models() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];

			model.update();
		}
	}

	set_model_transform(node: GLTFNode, transform: Mat4, nodeIndex: number, currentIndex: number) {
		if (!node.parent) {
			const model: Model = this.models.filter(m => m.nodeIndex === currentIndex)[0];
			const finalModelTransform: Mat4 = mat4.mul(model.transform, transform);

			for (let i = 0; i < 16; i++) {
				this.modelTransforms[nodeIndex * 16 + i] = finalModelTransform[i];
			}
		} else {
			const combinedTransform: Mat4 = mat4.mul(this.nodes[node.parent].transform, transform);
			this.set_model_transform(this.nodes[node.parent], combinedTransform, nodeIndex, node.parent);
		}
	}

	set_models() {
		for (let i = 0; i < this.nodes.length; i++) {
			const node: GLTFNode = this.nodes[i];
			if (!node.parent) {
				const model: Model = new Model(node.name, i, node.name === 'player');
				this.models.push(model);
				let scale: Vec3 = vec3.create(1, 1, 1);
				let rotation: Vec4 = vec4.create(0, 0, 0, 1);
				let translation: Vec3 = vec3.create(0, 0, 0);

				const m = mat4.create();
				const baseModelMatrix = fromRotationTranslationScale(m, rotation, translation, scale);
				model.transform = baseModelMatrix;
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
