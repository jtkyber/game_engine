import { WebGPURecorder } from 'webgpu_recorder/webgpu_recorder.js';
import Scene from '../model/scene';
import { IGLTFScene } from '../types/gltf';
import { IDebug } from '../types/types';
import GTLFLoader, { nodes } from '../view/gltf/loader';
import Renderer from '../view/renderer';
import Controller from './controller';

export const debugging: IDebug = {
	showAABBs: false,
	showOBBs: false,
};

export default class App {
	canvas: HTMLCanvasElement;
	then: number;
	startTime: number;
	now: number;
	framerateChunk: number[];
	framesPerFPSupdate: number;
	renderer: Renderer;
	scene: Scene;
	controller: Controller;
	firstFrameCompleted: boolean = false;
	terrainNodeIndex: number = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.framerateChunk = [];
		this.framesPerFPSupdate = 10;
	}

	async init() {
		window.myLib = window.myLib || {};
		window.myLib.deltaTime = 0;

		this.renderer = new Renderer(this.canvas);
		await this.renderer.setupDevice();

		const gltfLoader = new GTLFLoader(this.renderer.device);
		await gltfLoader.parse_gltf('dist/scene');

		const gltfScene: IGLTFScene = gltfLoader.load_scene(0);

		await gltfLoader.get_terrain_height_map('dist/terrain_height_map.png');
		this.terrainNodeIndex = gltfLoader.terrainNodeIndex;
		// console.log(gltfLoader.modelNodeChunks);
		// console.log(nodes);
		// console.log(gltfLoader.models);
		// console.log(gltfLoader.lights);
		// console.log(animations);

		this.scene = new Scene(
			gltfScene.modelNodeChunks,
			this.renderer.device,
			gltfLoader.allJoints,
			gltfLoader.lights,
			this.terrainNodeIndex
		);
		this.scene.set_models(gltfScene.models, gltfScene.player);

		// new WebGPURecorder();

		this.renderer.init(gltfLoader.lights.length);

		this.controller = new Controller(this.canvas, this.scene.camera, this.scene.player);
	}

	start = () => {
		this.then = performance.now();
		this.startTime = this.then;
		this.frame();
	};

	frame = () => {
		requestAnimationFrame(this.frame);

		this.now = performance.now();
		window.myLib.deltaTime = this.now - this.then;
		this.then = performance.now();

		if (this.controller.pointerLocked || !this.firstFrameCompleted) {
			this.controller.update();
			this.scene.update();
			this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks, this.terrainNodeIndex);
			this.firstFrameCompleted = true;
		}

		this.framerateChunk.push(window.myLib.deltaTime);
		if (this.framerateChunk.length === this.framesPerFPSupdate) this.show_framerate();
	};

	show_framerate() {
		let averageDeltaTime: number = 0;
		for (let i = 0; i < this.framesPerFPSupdate; i++) {
			averageDeltaTime += this.framerateChunk[i];
		}
		averageDeltaTime /= this.framesPerFPSupdate;

		(document.getElementById('fps_counter') as HTMLElement).innerText = (~~(
			1000 / averageDeltaTime
		)).toString();

		this.framerateChunk = [];
	}
}
