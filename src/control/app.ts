import Scene from '../model/scene';
import { IGLTFScene } from '../types/gltf';
import { IDebug } from '../types/types';
import GTLFLoader from '../view/gltf/loader';
import Renderer from '../view/renderer';
import { Skybox } from '../view/skybox';
import Controller from './controller';

export const debugging: IDebug = {
	showAABBs: false,
	showOBBs: false,
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
	terrainNodeIndex: number = null;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	async init() {
		aspect = this.canvas.width / this.canvas.height;
		window.myLib = window.myLib || {};
		window.myLib.deltaTime = 0;

		this.renderer = new Renderer(this.canvas);
		await this.renderer.setupDevice();

		const skybox = new Skybox();
		await skybox.initialize(this.renderer.device, 'dist/skybox_day.png');
		this.renderer.skybox = skybox;

		const gltfLoader = new GTLFLoader(this.renderer.device);
		await gltfLoader.parse_gltf('dist/scene');

		const gltfScene: IGLTFScene = gltfLoader.load_scene(0);

		await gltfLoader.get_terrain_height_map('dist/yosemiteHeightMap.png');
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
		if (window.myLib.deltaTime > this.frameCap) {
			this.then = performance.now();

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
