import Renderer from '../view/Renderer';
import GTLFLoader from '../view/gltf/loader';
import GLTFPrimitive from '../view/gltf/primitive';

export default class App {
	canvas: HTMLCanvasElement;
	fpsInterval: number;
	then: number;
	startTime: number;
	now: number;
	maxFramerate: number;
	framerateChunk: number[];
	framesPerFPSupdate: number;
	renderer: Renderer;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.maxFramerate = 60;
		this.fpsInterval = 1000 / this.maxFramerate;
		this.framerateChunk = [];
		this.framesPerFPSupdate = 10;
	}

	async init() {
		window.myLib = window.myLib || {};
		window.myLib.deltaTime = 0;

		this.renderer = new Renderer(this.canvas);
		await this.renderer.init();

		const gltfLoader = new GTLFLoader(this.renderer.device);

		await gltfLoader.parse_gltf('../../dist/scene');

		const nodes = gltfLoader.load_scene(0);

		console.log(nodes);
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

		// this.renderer.render(this.primitives);

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
