import { Mat4, mat4, Vec3, vec3, vec4 } from 'wgpu-matrix';
import { moveableFlag } from '../types/enums';
import { IModelNodeChunks } from '../types/gltf';
import { IRenderData } from '../types/types';
import JointMatrices from '../view/compute/joint_matrices/joint_matrices';
import { nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import { Camera } from './camera';
import { broad_phase } from './collisionDetection/broadPhase';
import { narrow_phase } from './collisionDetection/narrowPhase';
import Light from './light';
import Model from './model';
import Player from './player';

export default class Scene {
	nodes: GLTFNode[];
	modelNodeChunks: IModelNodeChunks;
	device: GPUDevice;
	allJoints: Set<number>;
	lights: Light[];
	models: Model[];
	nodeTransforms: Float32Array;
	normalTransforms: Float32Array;
	jointMatricesBufferList: GPUBuffer[];
	camera: Camera;
	player: Player;
	jointMatrixCompute: JointMatrices;
	lightTypes: Float32Array;
	lightPositions: Float32Array;
	lightColors: Float32Array;
	lightIntensities: Float32Array;
	lightDirections: Float32Array;
	lightAngleScales: Float32Array;
	lightAngleOffsets: Float32Array;
	lightViewProjMatrices: Float32Array;

	constructor(
		nodes: GLTFNode[],
		modelNodeChunks: IModelNodeChunks,
		device: GPUDevice,
		allJoints: Set<number>,
		lights: Light[]
	) {
		this.nodes = nodes;
		this.modelNodeChunks = modelNodeChunks;
		this.device = device;
		this.allJoints = allJoints;
		this.lights = lights;
		this.models = [];
		this.nodeTransforms = new Float32Array(16 * nodes.length);
		this.normalTransforms = new Float32Array(16 * nodes.length);
		this.jointMatricesBufferList = [];
		this.jointMatrixCompute = new JointMatrices(device);

		this.lightTypes = new Float32Array(lights.length);
		this.lightPositions = new Float32Array(lights.length * 4);
		this.lightColors = new Float32Array(lights.length * 4);
		this.lightIntensities = new Float32Array(lights.length);
		this.lightDirections = new Float32Array(lights.length * 4);
		this.lightAngleScales = new Float32Array(lights.length);
		this.lightAngleOffsets = new Float32Array(lights.length);
		this.lightViewProjMatrices = new Float32Array(lights.length * 16);
	}

	update() {
		this.camera.update();
		this.update_models();

		for (let i = 0; i < nodes.length; i++) {
			const node: GLTFNode = nodes[i];
			node.update();

			node.globalTransform = this.get_node_transform(i, node.transform);
			for (let j = 0; j < 16; j++) {
				this.nodeTransforms[i * 16 + j] = node.globalTransform[j];
			}

			const normalMatrix: Mat4 = mat4.transpose(mat4.invert(node.globalTransform));
			for (let j = 0; j < 16; j++) {
				this.normalTransforms[i * 16 + j] = normalMatrix[j];
			}

			node.setBoundingBoxes(node.globalTransform, normalMatrix);
		}

		for (let i = 0; i < this.lights.length; i++) this.set_light_data(i);

		this.jointMatricesBufferList = this.jointMatrixCompute.get_joint_matrices(
			this.models,
			this.nodeTransforms
		);
		this.sortTransparent();

		const broadPhaseIndices = broad_phase(this.modelNodeChunks);
		narrow_phase(broadPhaseIndices);
	}

	update_models() {
		for (let i = 0; i < this.models.length; i++) {
			const model: Model = this.models[i];
			model.update();
			nodes[model.nodeIndex].set_current_velocity();
			nodes[model.nodeIndex].apply_gravity();
			nodes[model.nodeIndex].set_previous_position();
		}
	}

	set_light_data(i: number) {
		const light: Light = this.lights[i];
		light.update();

		this.lightViewProjMatrices.set(light.lightViewProj, i * 16);
		this.lightTypes[i] = light.type;
		this.lightPositions.set([...light.position, 0], i * 4);
		this.lightColors.set([...light.color, 0], i * 4);
		this.lightIntensities[i] = light.intensity;
		this.lightDirections.set([...light.forward, 0], i * 4);
		this.lightAngleScales[i] = light.angleScale;
		this.lightAngleOffsets[i] = light.angleOffset;
	}

	get_node_transform(nodeIndex: number, transform: Mat4): Mat4 {
		const node: GLTFNode = nodes[nodeIndex];
		const parent: number = node?.parent ?? null;
		const isJoint: boolean = this.allJoints.has(nodeIndex);
		const parentIsJoint: boolean = this.allJoints.has(parent);

		if (isJoint && !parentIsJoint) {
			return transform;
		} else if (parent === null) {
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
			const combinedTransform: Mat4 = mat4.mul(nodes[parent].transform, transform);
			return this.get_node_transform(parent, combinedTransform);
		}
	}

	get_root_matrix(nodeIndex: number): Mat4 {
		const n: GLTFNode = nodes[nodeIndex];
		if (n.parent === null) return n.transform;
		return this.get_root_matrix(n.parent);
	}

	sortTransparent() {
		this.modelNodeChunks.transparent = this.modelNodeChunks.transparent.sort((a, b) => {
			const nodeAdist: number = vec3.dist(
				this.camera.position,
				nodes[this.models[a.nodeIndex].nodeIndex].position
			);
			const nodeBdist: number = vec3.dist(
				this.camera.position,
				nodes[this.models[b.nodeIndex].nodeIndex].position
			);
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
			nodeTransforms: this.nodeTransforms,
			normalTransforms: this.normalTransforms,
			jointMatricesBufferList: this.jointMatricesBufferList,
			lightTypes: this.lightTypes,
			lightPositions: this.lightPositions,
			lightColors: this.lightColors,
			lightIntensities: this.lightIntensities,
			lightDirections: this.lightDirections,
			lightAngleScales: this.lightAngleScales,
			lightAngleOffsets: this.lightAngleOffsets,
			lightViewProjMatrices: this.lightViewProjMatrices,
			cameraPosition: vec4.create(...this.camera.position, 0),
		};
	}
}
