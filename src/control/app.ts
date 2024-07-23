import Scene from '../model/scene';
import { IGLTFScene } from '../types/gltf';
import GTLFLoader, { animations, nodes } from '../view/gltf/loader';
import Renderer from '../view/renderer';
import Controller from './controller';

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
	showAABBs: boolean = false;
	showOBBs: boolean = false;

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
		// console.log(nodes);
		console.log(animations);

		this.scene = new Scene(nodes, gltfScene.modelNodeChunks, this.renderer.device, gltfLoader.allJoints);
		this.scene.set_models(gltfScene.models, gltfScene.player);

		this.renderer.init();

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

		this.controller.update();
		this.scene.update();
		this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks, this.scene.models);

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
