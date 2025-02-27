import { mat3, Mat4, mat4, quat, utils, vec3, Vec3 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import Scene from '../model/scene';
import { IGLTFScene } from '../types/gltf';
import { IDebug } from '../types/types';
import { eulerFromQuat } from '../utils/math';
import { newStatus, quatFromTime } from '../utils/misc';
import BindGroupLayouts from '../view/bindGroupLayouts';
import GLTFImage from '../view/gltf/image';
import GTLFLoader, { animations, models, nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import Renderer from '../view/renderer';
import { Skybox } from '../view/skybox';
import Actions from './actions';
import Controller from './controller';
import Menu from './menu';

export const globalToggles: IDebug = {
	showAABBs: false,
	showOBBs: false,
	visualizeLightFrustums: false,
	lockDirectionalFrustums: false,
	firstPersonMode: true,
	flashlightOn: false,
	forceWalking: false,
	antialiasing: true,
	showFPS: true,
	fixedTimeStep: 1000 / 30,
	todLocked: false,
	collisionDetection: 'satContinuous',
	sunAngle: 0,
};

export let aspect: number = 0;

export default class App {
	canvas: HTMLCanvasElement;
	then: number;
	sinceLastRender: number;
	startTime: number;
	accumulator: number = 0;
	totalFrames: number = 0;
	framerateChunk: number[] = [];
	framerateChunk_2: number[] = [];
	framesPerFPSupdate: number = 30;
	renderer: Renderer;
	scene: Scene;
	controller: Controller;
	menu: Menu;
	bindGroupLayouts: BindGroupLayouts;
	framerateElement: HTMLElement = document.getElementById('fps_counter') as HTMLElement;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
	}

	async init() {
		const menuBtn = document.querySelector('.menuBtn');
		let menuDisplay = sessionStorage.getItem('menu');
		menuDisplay = menuDisplay ? menuDisplay : 'block';

		document.querySelector('menu').style.display = menuDisplay;
		if (menuDisplay === 'block') menuBtn.classList.add('active');
		else menuBtn.classList.remove('active');

		const res: string = sessionStorage.getItem('resolution');
		if (res) {
			const index: number = res.indexOf('x');
			const width = res.substring(0, index);
			const height = res.substring(index + 1);

			this.canvas.width = parseInt(width);
			this.canvas.height = parseInt(height);
		}

		const showStatus = sessionStorage.getItem('showStatus');
		if (showStatus) {
			document.getElementById('status').style.display = showStatus === 'true' ? 'block' : 'none';
		}

		const antialiasingCached = sessionStorage.getItem('antialiasing');
		if (antialiasingCached) globalToggles.antialiasing = antialiasingCached === 'true';

		aspect = this.canvas.width / this.canvas.height;
		window.myLib = window.myLib || {};
		window.myLib.deltaTime = 0;

		newStatus('setting up renderer');
		this.renderer = new Renderer(this.canvas);
		await this.renderer.setupDevice();
		this.bindGroupLayouts = new BindGroupLayouts(this.renderer.device);
		this.bindGroupLayouts.createBindGroupLayouts();

		const skybox = new Skybox();
		await skybox.initialize(this.renderer.device, 'dist/skybox_space2.png');
		this.renderer.skybox = skybox;
		newStatus('skybox loaded');

		newStatus('parsing and loading gltf file');
		const gltfLoader = new GTLFLoader(this.renderer.device, this.bindGroupLayouts);
		await gltfLoader.parse_gltf('dist/scene');
		newStatus('gltf file loaded');

		const gltfScene: IGLTFScene = gltfLoader.load_scene(0);

		const splatMap: GLTFImage = await gltfLoader.get_splat_map('dist/splat_map.png');

		await gltfLoader.get_terrain_height_map('dist/HeightMapTest.png', 60);
		const terrainNodeIndex: number = gltfLoader.terrainNodeIndex;
		const terrainMaterialIndex: number = gltfLoader.terrainMaterialIndex;

		// console.log(gltfLoader.jsonChunk);
		// console.log(gltfLoader.modelNodeChunks);
		// console.log(nodes);
		// console.log(nodes.filter((n, i) => models.includes(i)));
		// console.log(gltfLoader.lights);
		// console.log(animations);
		// console.log(terrainHeightMap);
		//

		const actions = new Actions();

		this.scene = new Scene(
			gltfScene.modelNodeChunks,
			this.renderer.device,
			gltfLoader.allJoints,
			gltfLoader.lights,
			terrainNodeIndex,
			actions
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

		this.loadFromSessionStorage();

		this.setMenuOptions();

		this.controller = new Controller(this.canvas, this.scene.camera, this.scene.player);

		this.menu = new Menu(
			this.renderer,
			this.bindGroupLayouts,
			skybox,
			this.framerateElement,
			this.canvas,
			this.controller,
			this.frame.bind(this),
			this.scene.camera
		);
	}

	setMenuOptions() {
		const inputs = Array.from(document.querySelectorAll('input'));
		const selects = Array.from(document.querySelectorAll('select'));

		for (let input of inputs) {
			switch (input.id) {
				case 'showStatus':
					input.checked = document.getElementById('status').style.display !== 'none';
					break;
				case 'showAABBs':
					input.checked = globalToggles.showAABBs;
					break;
				case 'showOBBs':
					input.checked = globalToggles.showOBBs;
					break;
				case 'visualizeLightFrustums':
					input.checked = globalToggles.visualizeLightFrustums;
					break;
				case 'lockDirectionalFrustums':
					setTimeout(() => {
						input.checked = globalToggles.lockDirectionalFrustums;
					}, 1100);
					break;
				case 'antialiasing':
					input.checked = globalToggles.antialiasing;
					break;
				case 'showFPS':
					input.checked = globalToggles.showFPS;
					break;
				case 'fpsCap':
					input.value = Math.round(1000 / globalToggles.fixedTimeStep).toString();
					document.getElementById('fpsCapValue').innerText = input.value;
					break;
				case 'fov':
					input.value = utils.radToDeg(this.scene.camera.fov).toString();
					document.getElementById('fovValue').innerText = input.value;
					break;
				case 'tod':
					for (let m of models) {
						const node: GLTFNode = nodes[m];
						if (node.name === 'Sun') {
							const euler = eulerFromQuat(node.quat);
							const hourAngle = euler[2];
							globalToggles.sunAngle = hourAngle;

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

							input.value = time;
							break;
						}
					}
					break;
				case 'todLock':
					input.checked = globalToggles.todLocked;
					break;
			}
		}

		for (let select of selects) {
			switch (select.id) {
				case 'resolution':
					const select: HTMLSelectElement = document.querySelector('#resolution');
					select.value = `${this.canvas.width}x${this.canvas.height}`;
					break;
				case 'collisionDetection':
					const select2: HTMLSelectElement = document.querySelector('#collisionDetection');
					select2.value = globalToggles.collisionDetection;
					break;
			}
		}
	}

	loadFromSessionStorage() {
		const showAABBsCached = sessionStorage.getItem('showAABBs');
		const showOBBsCached = sessionStorage.getItem('showOBBs');
		const visualizeLightFrustumsCached = sessionStorage.getItem('visualizeLightFrustums');
		const lockDirectionalFrustumsCached = sessionStorage.getItem('lockDirectionalFrustums');
		const showFPSCached = sessionStorage.getItem('showFPS');
		const todCached = sessionStorage.getItem('tod');
		const todLockedCached = sessionStorage.getItem('todLock');
		const collisionDetection = sessionStorage.getItem('collisionDetection');
		const isFirstPerson = sessionStorage.getItem('isFirstPerson');
		const playerPosition = sessionStorage.getItem('playerPosition');
		const playerRotation = sessionStorage.getItem('playerRotation');
		const cameraYaw = sessionStorage.getItem('cameraYaw');
		const cameraPitch = sessionStorage.getItem('cameraPitch');
		globalToggles.fixedTimeStep = parseFloat(sessionStorage.getItem('fpsCap')) || globalToggles.fixedTimeStep;
		this.scene.camera.setFOV(
			parseFloat(sessionStorage.getItem('fov')) || utils.radToDeg(this.scene.camera.fov)
		);

		if (showAABBsCached) globalToggles.showAABBs = showAABBsCached === 'true';
		if (showOBBsCached) globalToggles.showOBBs = showOBBsCached === 'true';
		if (visualizeLightFrustumsCached) {
			globalToggles.visualizeLightFrustums = visualizeLightFrustumsCached === 'true';
		}

		globalToggles.lockDirectionalFrustums = false;
		setTimeout(() => {
			if (lockDirectionalFrustumsCached) {
				globalToggles.lockDirectionalFrustums = lockDirectionalFrustumsCached === 'true';
			}
		}, 1000);

		if (showFPSCached) globalToggles.showFPS = showFPSCached === 'true';

		for (let m of models) {
			const node: GLTFNode = nodes[m];
			if (node.name === 'Sun') {
				const tod: string = todCached ? todCached : '06:00';
				node.quat = quatFromTime(tod);
				globalToggles.sunAngle = quat.toAxisAngle(node.quat).angle;

				const rotationMatrix: Mat4 = mat3.fromQuat(node.quat);
				const worldDirection: Vec3 = vec3.transformMat3([0, 1, 0], rotationMatrix);
				const movement: Vec3 = vec3.scale(worldDirection, 400);
				node.position = movement;
				break;
			}
		}

		if (todLockedCached) globalToggles.todLocked = todLockedCached === 'true';

		this.framerateElement.style.display = globalToggles.showFPS ? 'block' : 'none';

		if (collisionDetection) globalToggles.collisionDetection = collisionDetection;

		if (isFirstPerson) {
			globalToggles.firstPersonMode = isFirstPerson === 'true';
			this.scene.camera.setInitialCamDists();
		}

		if (playerPosition) {
			nodes[this.scene.player].position = JSON.parse(playerPosition);
			nodes[this.scene.player].position[1] += 0.5;
		}

		if (playerRotation) nodes[this.scene.player].quat = JSON.parse(playerRotation);

		if (cameraYaw) this.scene.camera.yaw = parseFloat(cameraYaw);
		else this.scene.camera.yaw -= Math.PI / 3.2;

		if (cameraPitch) this.scene.camera.pitch = parseFloat(cameraPitch);

		for (let m of models) {
			if (globalToggles.showAABBs) nodes[m].initialize_bounding_boxes();
			if (globalToggles.showOBBs) nodes[m].initialize_bounding_boxes();
		}

		// document.getElementById('fpsCapValue').innerText = Math.round(1000 / globalToggles.frameCap).toString();
		// document.getElementById('fovValue').innerText = utils.radToDeg(this.scene.camera.fov).toString();
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

		camera.projection = mat4.perspectiveReverseZ(camera.fov, aspect, camera.near, camera.far);

		modelIndices.forEach(i => {
			nodes[i.nodeIndex].turnSpeed = data.node.turnSpeed;
			nodes[i.nodeIndex].gravityAcc = data.node.gravityAcc;
		});

		player.turnSpeed = data.player.turnSpeed;
		player._speed = data.player.speed;
		player._mass = data.player.mass;
	}

	periodic_save() {
		sessionStorage.setItem('isFirstPerson', JSON.stringify(globalToggles.firstPersonMode));
		sessionStorage.setItem('playerPosition', JSON.stringify(Array.from(nodes[this.scene.player].position)));
		sessionStorage.setItem('playerRotation', JSON.stringify(Array.from(nodes[this.scene.player].quat)));
		sessionStorage.setItem('cameraYaw', JSON.stringify(this.scene.camera.yaw));
		sessionStorage.setItem('cameraPitch', JSON.stringify(this.scene.camera.pitch));
	}

	start = () => {
		// setInterval(() => this.fetch_and_update_parameters(), 3000);

		this.then = performance.now();
		this.startTime = this.then;
		requestAnimationFrame(this.frame);

		setInterval(() => this.periodic_save(), 3000);
	};

	// frame = (now: number) => {
	// 	requestAnimationFrame(this.frame);

	// 	window.myLib.deltaTime = now - this.then;

	// 	if (window.myLib.deltaTime >= globalToggles.fixedTimeStep) {
	// 		this.then = now - (window.myLib.deltaTime % globalToggles.fixedTimeStep);

	// 		if (this.controller.pointerLocked || !this.firstFrameCompleted) {
	// 			this.controller.update();
	// 			this.scene.update();

	// 			this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks);
	// 			this.firstFrameCompleted = true;
	// 		}

	// 		if (globalToggles.showFPS) {
	// 			const perfNow = performance.now();
	// 			const deltaTime = perfNow - this.sinceLastRender;
	// 			this.framerateChunk.push(deltaTime);
	// 			if (this.framerateChunk.length === this.framesPerFPSupdate) this.show_framerate();
	// 			this.sinceLastRender = perfNow;
	// 		}
	// 	}
	// };

	frame = (now: number) => {
		requestAnimationFrame(this.frame);

		let deltaTime = now - this.then;
		deltaTime = Math.min(deltaTime, globalToggles.fixedTimeStep * 4);

		window.myLib.deltaTime = globalToggles.fixedTimeStep;

		this.then = now;

		this.accumulator += deltaTime;

		let updated = false;

		let count = 0;
		while (this.accumulator >= globalToggles.fixedTimeStep) {
			if (this.controller.pointerLocked || this.totalFrames < 2) {
				this.controller.update();
				this.scene.update();

				updated = true;
				this.totalFrames++;
			}

			this.accumulator -= globalToggles.fixedTimeStep;
			count++;
		}

		if (updated) {
			this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks);
		}

		if (globalToggles.showFPS) {
			const perfNow = performance.now();
			const renderDelta = perfNow - this.sinceLastRender;
			this.framerateChunk.push(
				renderDelta > globalToggles.fixedTimeStep ? renderDelta : globalToggles.fixedTimeStep
			);
			if (this.framerateChunk.length === this.framesPerFPSupdate) this.show_framerate();
			this.sinceLastRender = perfNow;
		}
	};

	// frame = (now: number) => {
	// 	requestAnimationFrame(this.frame);

	// 	window.myLib.deltaTime = now - this.then;

	// 	this.then = now;

	// 	if (this.controller.pointerLocked || !this.firstFrameCompleted) {
	// 		this.controller.update();
	// 		this.scene.update();
	// 		this.renderer.render(this.scene.get_render_data(), this.scene.modelNodeChunks);
	// 		this.firstFrameCompleted = true;
	// 	}

	// 	if (globalToggles.showFPS) {
	// 		const perfNow = performance.now();
	// 		const renderDelta = perfNow - this.sinceLastRender;
	// 		this.framerateChunk.push(renderDelta);
	// 		if (this.framerateChunk.length === this.framesPerFPSupdate) this.show_framerate();
	// 		this.sinceLastRender = perfNow;
	// 	}
	// };

	get_fps_below_cap(chunk: number[], margin: number = 0) {
		let count: number = 0;
		for (let frame of chunk) {
			if (frame >= 1000 / globalToggles.fixedTimeStep - margin) {
				count++;
			}
		}
		return count / chunk.length;
	}

	get_framerate_average(chunk: number[]): number {
		const count: number = chunk.length;
		let avg: number = 0;
		for (let i = 0; i < count; i++) {
			avg += chunk[i];
		}
		return avg / count;
	}

	show_framerate() {
		const averageFps: number = ~~(1000 / this.get_framerate_average(this.framerateChunk));
		this.framerateElement.innerText = averageFps.toString();

		this.framerateChunk = [];

		// this.framerateChunk_2.push(averageFps || ~~(1000 / globalToggles.frameCap));
		// if (this.framerateChunk_2.length >= 10) {
		// 	if (this.get_fps_below_cap(this.framerateChunk_2, 2) < 0.7) {
		// 		newStatus('Lag Detected --> Reduce FPS Cap or Graphics Settings');
		// 	}
		// 	this.framerateChunk_2 = [];
		// }
	}
}
