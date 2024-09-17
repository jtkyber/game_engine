import { mat4, utils } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import Scene from '../model/scene';
import { IGLTFScene } from '../types/gltf';
import { IDebug } from '../types/types';
import BindGroupLayouts from '../view/bindGroupLayouts';
import GLTFImage from '../view/gltf/image';
import GTLFLoader, { models, nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import Renderer from '../view/renderer';
import { Skybox } from '../view/skybox';
import Controller from './controller';

export const debugging: IDebug = {
	showAABBs: false,
	showOBBs: false,
	visualizeLightFrustums: false,
	lockDirectionalFrustums: false,
	firstPersonMode: false,
	flashlightOn: false,
};

export let aspect: number = 0;

export default class App {
	canvas: HTMLCanvasElement;
	then: number;
	startTime: number;
	now: number;
	frameCap: number = 1000 / 30;
	framerateChunk: number[] = [];
	framerateChunk_2: number[] = [];
	framesPerFPSupdate: number = 50;
	renderer: Renderer;
	scene: Scene;
	controller: Controller;
	firstFrameCompleted: boolean = false;
	bindGroupLayouts: BindGroupLayouts;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	async init() {
		aspect = this.canvas.width / this.canvas.height;
		window.myLib = window.myLib || {};
		window.myLib.deltaTime = 0;

		this.renderer = new Renderer(this.canvas);
		await this.renderer.setupDevice();
		this.bindGroupLayouts = new BindGroupLayouts(this.renderer.device);
		this.bindGroupLayouts.createBindGroupLayouts();

		const skybox = new Skybox();
		await skybox.initialize(this.renderer.device, 'dist/skybox_day.png');
		this.renderer.skybox = skybox;

		const gltfLoader = new GTLFLoader(this.renderer.device, this.bindGroupLayouts);
		await gltfLoader.parse_gltf('dist/scene');

		const gltfScene: IGLTFScene = gltfLoader.load_scene(0);

		const splatMap: GLTFImage = await gltfLoader.get_splat_map('../../dist/SplatMap.png');
		// console.log(splatMap);

		await gltfLoader.get_terrain_height_map('dist/yosemiteHeightMap.png');
		const terrainNodeIndex: number = gltfLoader.terrainNodeIndex;
		const terrainMaterialIndex: number = gltfLoader.terrainMaterialIndex;

		// console.log(gltfLoader.jsonChunk);
		// console.log(gltfLoader.modelNodeChunks);
		// console.log(nodes);
		console.log(nodes.filter((n, i) => models.includes(i)));
		// console.log(gltfLoader.lights);
		// console.log(animations);

		this.scene = new Scene(
			gltfScene.modelNodeChunks,
			this.renderer.device,
			gltfLoader.allJoints,
			gltfLoader.lights,
			terrainNodeIndex
		);
		this.scene.set_models(gltfScene.player);

		// new WebGPURecorder();

		this.renderer.init(
			gltfLoader.lights.length,
			splatMap,
			terrainMaterialIndex,
			terrainNodeIndex,
			this.bindGroupLayouts,
			gltfLoader.terrainMaterial
		);

		this.controller = new Controller(this.canvas, this.scene.camera, this.scene.player);
	}

	async fetch_and_update_parameters() {
		const res = await fetch('../game_settings.json');
		const data = await res.json();
		const camera: Camera = this.scene.camera;
		const player: GLTFNode = nodes[this.scene.player];
		const modelIndices = this.scene.modelNodeChunks.opaque.concat(this.scene.modelNodeChunks.transparent);

		camera.fov = utils.degToRad(data.camera.fov);
		camera.near = data.camera.near;
		camera.far = data.camera.far;
		camera.shadowNear = data.camera.shadowNear;
		camera.shadowFar = data.camera.shadowFar;

		camera.projection = mat4.perspectiveReverseZ(camera.fov, aspect, camera.near, camera.far);
		for (let i = 0; i < camera.cascadeCount; i++) {
			camera.cascadeSplits[i] =
				camera.shadowNear * Math.pow(camera.shadowFar / camera.shadowNear, (i + 1) / camera.cascadeCount);
		}

		modelIndices.forEach(i => {
			nodes[i.nodeIndex].turnSpeed = data.node.turnSpeed;
			nodes[i.nodeIndex].gravityAcc = data.node.gravityAcc;
		});

		player.turnSpeed = data.player.turnSpeed;
		player._speed = data.player.speed;
		player._mass = data.player.mass;
	}

	start = () => {
		// setInterval(() => this.fetch_and_update_parameters(), 3000);

		this.then = performance.now();
		this.startTime = this.then;
		this.frame();
	};

	frame = () => {
		requestAnimationFrame(this.frame);

		this.now = performance.now();
		window.myLib.deltaTime = this.now - this.then;

		if (window.myLib.deltaTime > this.frameCap) {
			this.then = performance.now();
			// this.then = this.now - (window.myLib.deltaTime % this.frameCap);

			if (this.controller.pointerLocked || !this.firstFrameCompleted) {
				this.controller.update();
				this.scene.update();
				this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks);
				this.firstFrameCompleted = true;
			}

			this.framerateChunk.push(window.myLib.deltaTime);
			if (this.framerateChunk.length === this.framesPerFPSupdate) this.show_framerate();

			// this.framerateChunk_2.push(performance.now() - this.then);
			// if (this.framerateChunk_2.length === 10) {
			// 	this.frameCap = this.get_framerate_average(this.framerateChunk_2);
			// 	this.framerateChunk_2 = [];
			// }
		}
	};

	get_framerate_average(chunk: number[]): number {
		const count: number = chunk.length;
		let avg: number = 0;
		for (let i = 0; i < count; i++) {
			avg += chunk[i];
		}
		return avg / count;
	}

	show_framerate() {
		(document.getElementById('fps_counter') as HTMLElement).innerText = (~~(
			// (1000 / this.frameCap)
			(1000 / this.get_framerate_average(this.framerateChunk))
		)).toString();

		this.framerateChunk = [];
	}
}
