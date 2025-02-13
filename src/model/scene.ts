import { Mat4, mat4, quat, Vec3, vec3 } from 'wgpu-matrix';
import Actions from '../control/actions';
import { globalToggles } from '../control/app';
import { Flag, LightType } from '../types/enums';
import { IModelNodeChunks } from '../types/gltf';
import { IRenderData } from '../types/types';
import { quatToEuler } from '../utils/math';
import { timeToQuat } from '../utils/misc';
import { models, nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import JointMatrices from '../view/joint_matrices';
import { Camera } from './camera';
import { broad_phase } from './collisionDetection/broadPhase';
import { narrow_phase } from './collisionDetection/narrowPhase';
import Light from './light';

export default class Scene {
	modelNodeChunks: IModelNodeChunks;
	device: GPUDevice;
	allJoints: Set<number>;
	lights: Light[];
	terrainNodeIndex: number;
	actions: Actions;
	nodeTransforms: Float32Array;
	normalTransforms: Float32Array;
	jointMatricesBufferList: GPUBuffer[];
	camera: Camera;
	player: number;
	jointMatrixCompute: JointMatrices;
	lightTypes: Float32Array;
	lightPositions: Float32Array;
	lightColors: Float32Array;
	lightIntensities: Float32Array;
	lightDirections: Float32Array;
	lightAngleData: Float32Array; // [scale, offset]
	lightViewProjMatrices: Float32Array;
	lightViewMatrices: Float32Array;
	inverseLightViewProjMatrices: Float32Array;
	sunAboveHorizon: Float32Array;
	todElement = <HTMLInputElement>document.getElementById('tod');

	constructor(
		modelNodeChunks: IModelNodeChunks,
		device: GPUDevice,
		allJoints: Set<number>,
		lights: Light[],
		terrainNodeIndex: number,
		actions: Actions
	) {
		this.modelNodeChunks = modelNodeChunks;
		this.device = device;
		this.allJoints = allJoints;
		this.lights = lights;
		this.terrainNodeIndex = terrainNodeIndex;
		this.actions = actions;
		this.nodeTransforms = new Float32Array(16 * nodes.length);
		this.normalTransforms = new Float32Array(16 * nodes.length);
		this.jointMatricesBufferList = [];
		this.jointMatrixCompute = new JointMatrices(device);

		this.lightTypes = new Float32Array(lights.length);
		this.lightPositions = new Float32Array(lights.length * 4);
		this.lightColors = new Float32Array(lights.length * 4);
		this.lightIntensities = new Float32Array(lights.length);
		this.lightDirections = new Float32Array(lights.length * 4);
		this.lightAngleData = new Float32Array(lights.length * 2);
		this.lightViewProjMatrices = new Float32Array(lights.length * 16 * 6);
		this.lightViewMatrices = new Float32Array(lights.length * 16 * 6);
		this.inverseLightViewProjMatrices = new Float32Array(lights.length * 16 * 6);

		this.sunAboveHorizon = new Float32Array(1);
	}

	update() {
		this.camera.update(this.terrainNodeIndex);
		this.update_models();

		for (let i = 0; i < nodes.length; i++) {
			const node: GLTFNode = nodes[i];
			if (node.adjustedPosition) node.update(node.adjustedPosition);
			else node.update(node.position);

			node.globalTransform = this.get_node_transform(i, node.transform, i);
			for (let j = 0; j < 16; j++) {
				this.nodeTransforms[i * 16 + j] = node.globalTransform[j];
			}

			node.normalTransform = mat4.transpose(mat4.invert(node.globalTransform));
			for (let j = 0; j < 16; j++) {
				this.normalTransforms[i * 16 + j] = node.normalTransform[j];
			}
		}

		for (let i = 0; i < models.length; i++) nodes[models[i]].setBoundingBoxes();

		for (let i = 0; i < this.lights.length; i++) this.set_light_data(i);

		this.jointMatricesBufferList = this.jointMatrixCompute.get_joint_matrices(
			this.modelNodeChunks,
			this.nodeTransforms
		);
		this.sortTransparent();

		const broadPhaseIndices = broad_phase();
		narrow_phase(broadPhaseIndices);

		for (let i = 0; i < models.length; i++) nodes[models[i]].set_previous_position();
	}

	update_models() {
		for (let i = 0; i < models.length; i++) {
			const model: number = models[i];
			const node: GLTFNode = nodes[model];

			node.set_direction_vectors();
			node.set_current_velocity();
			node.apply_gravity();

			if (node.objectClass === 'fish') {
				this.actions.swim(node);
			}

			if (node.name === 'Sun') {
				if (!globalToggles.todLocked) {
					node.rotateAroundPoint(
						window.myLib.deltaTime * 0.00001,
						vec3.create(0, 0, 1),
						vec3.create(0, 0, 0)
					);

					const euler = quatToEuler(node.quat);
					const hourAngle = euler[2];
					let hours = (hourAngle / (2 * Math.PI)) * 24;
					if (hours < 12) {
						hours += 12;
					} else if (hours >= 24) {
						hours -= 24;
					}
					hours = Math.round(hours * 100) / 100;
					let time =
						String(Math.floor(hours)).padStart(2, '0') +
						':' +
						String(Math.floor((hours % 1) * 60)).padStart(2, '0');

					this.todElement.value = time;

					sessionStorage.setItem('tod', time);
				}

				node.adjustedPosition = vec3.add(node.position, this.camera.position);
			}
		}

		this.camera.previousPosition = vec3.copy(this.camera.position);
	}

	set_light_data(i: number) {
		const light: Light = this.lights[i];
		const lightNode: GLTFNode = nodes[light.nodeIndex];

		if (lightNode.name === 'Flashlight') {
			this.lightIntensities[i] = globalToggles.flashlightOn ? light.intensity : 0;
		}

		const setLVP: boolean = this.lightIntensities[i] > 0;

		light.update(this.camera.forward, setLVP);

		if (setLVP) {
			this.lightViewProjMatrices.set(light.lightViewProjMatrices, i * 16 * 6);
			this.lightViewMatrices.set(light.lightViewMatrices, i * 16 * 6);
			this.lightTypes[i] = light.type;
			this.lightPositions.set([...light.position, 0], i * 4);
			this.lightColors.set([...light.color, 0], i * 4);
			this.lightIntensities[i] = light.intensity;
			this.lightDirections.set([...light.forward, 0], i * 4);
			this.lightAngleData.set([light.angleScale, light.angleOffset], i * 2);

			if (globalToggles.visualizeLightFrustums) {
				this.inverseLightViewProjMatrices.set(light.inverseLightViewProjMatrices, i * 16 * 6);
			}
		}

		if (lightNode.name === 'SunLight') {
			const sunAboveHorizon: number = vec3.dot(vec3.normalize(light.forward), [0, 1, 0]);
			// Set sun dist above horizon
			this.sunAboveHorizon[0] = sunAboveHorizon;

			// Add warm glow to sunlight during sunrise and sunset
			const lerpValue: number = 1 - Math.max(sunAboveHorizon, 0);
			let newColor: Vec3 = vec3.lerp(light.color, vec3.create(1.0, 0.5, 0.2), lerpValue);

			vec3.normalize(newColor, newColor);
			this.lightColors.set([...newColor, 0], i * 4);

			this.lightIntensities[i] = sunAboveHorizon < -0.2 ? 0 : light.intensity;

			// const rotationQuat = quat.fromAxisAngle([0, 1, 0], 0.01);
			// quat.mul(rotationQuat, lightNode.quat, lightNode.quat);
			// quat.rotateX(lightNode.quat, 0.00003 * window.myLib.deltaTime, lightNode.quat);
		}
	}

	get_node_transform(nodeIndex: number, transform: Mat4, originalNodeIndex: number): Mat4 {
		const node: GLTFNode = nodes[nodeIndex];
		const parent: number = node?.parent ?? null;
		const isJoint: boolean = this.allJoints.has(nodeIndex);
		const parentIsJoint: boolean = this.allJoints.has(parent);

		if (!this.allJoints.has(originalNodeIndex) && isJoint && !parentIsJoint) {
			// If original node is a mesh child of joint
			return mat4.mul(nodes[node.rootNode].transform, transform);
		} else if (isJoint && !parentIsJoint) {
			return transform;
		} else if (parent === null) {
			// If root node

			return transform;
		} else if (node.flag === Flag.STATIC) {
			// Never moves, so just return pre-multiplied matrix
			return transform;
		} else if (node.flag === Flag.MOVEABLE_ROOT) {
			// Only moves as single chunk, so multiply by root
			// Non-root nodes pre-multiplied
			const parentMat: Mat4 = this.get_root_matrix(node.parent);
			return mat4.mul(parentMat, transform);
		} else {
			// Any part can move, so muliply all nodes by parent
			const combinedTransform: Mat4 = mat4.mul(nodes[parent].transform, transform);
			return this.get_node_transform(parent, combinedTransform, originalNodeIndex);
		}
	}

	get_root_matrix(nodeIndex: number): Mat4 {
		const n: GLTFNode = nodes[nodeIndex];
		if (n.parent === null) return n.transform;
		return this.get_root_matrix(n.parent);
	}

	sortTransparent() {
		this.modelNodeChunks.transparent = this.modelNodeChunks.transparent.sort((a, b) => {
			const nodeAdist: number = vec3.dist(this.camera.position, nodes[a.nodeIndex].position);
			const nodeBdist: number = vec3.dist(this.camera.position, nodes[b.nodeIndex].position);
			return nodeBdist - nodeAdist;
		});
	}

	set_models(player: number) {
		this.player = player;
		this.camera = new Camera(this.player);
		for (let i = 0; i < this.lights.length; i++) {
			this.lights[i].camera = this.camera;
			this.lights[i].player = this.player;
		}

		this.camera.yaw -= Math.PI / 3.2;
		// this.camera.yaw += Math.PI / 2;
	}

	get_render_data(): IRenderData {
		return {
			camera: this.camera,
			nodeTransforms: this.nodeTransforms,
			normalTransforms: this.normalTransforms,
			jointMatricesBufferList: this.jointMatricesBufferList,
			lightTypes: this.lightTypes,
			lightPositions: this.lightPositions,
			lightColors: this.lightColors,
			lightIntensities: this.lightIntensities,
			lightDirections: this.lightDirections,
			lightAngleData: this.lightAngleData,
			lightViewProjMatrices: this.lightViewProjMatrices,
			lightViewMatrices: this.lightViewMatrices,
			inverseLightViewProjMatrices: this.inverseLightViewProjMatrices,
			sunAboveHorizon: this.sunAboveHorizon,
		};
	}
}
