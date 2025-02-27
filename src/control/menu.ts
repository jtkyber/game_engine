import { mat3, Mat4, Vec3, vec3 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import { eulerFromQuat } from '../utils/math';
import { quatFromTime } from '../utils/misc';
import BindGroupLayouts from '../view/bindGroupLayouts';
import { models, nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';
import Renderer from '../view/renderer';
import { Skybox } from '../view/skybox';
import { globalToggles } from './app';
import Controller from './controller';

export default class Menu {
	renderer: Renderer;
	bindGroupLayouts: BindGroupLayouts;
	skybox: Skybox;
	framerateElement: HTMLElement;
	canvas: HTMLCanvasElement;
	controller: Controller;
	frame: (currentTime: number) => any;
	camera: Camera;
	menuElement: HTMLMenuElement;
	menuBtn: HTMLButtonElement;

	constructor(
		renderer: Renderer,
		bindGroupLayouts: BindGroupLayouts,
		skybox: Skybox,
		framerateElement: HTMLElement,
		canvas: HTMLCanvasElement,
		controller: Controller,
		frame: (currentTime: number) => any,
		camera: Camera
	) {
		this.renderer = renderer;
		this.bindGroupLayouts = bindGroupLayouts;
		this.skybox = skybox;
		this.framerateElement = framerateElement;
		this.canvas = canvas;
		this.controller = controller;
		this.frame = frame;
		this.camera = camera;
		this.menuElement = document.querySelector('menu');
		this.menuBtn = document.querySelector('.menuBtn');

		this.menuElement.addEventListener('change', e => this.handleMenuSelection(e));
		this.menuElement.addEventListener('input', e => this.handleInput(e));
		this.menuBtn.addEventListener('click', () => {
			const display: string = this.menuElement.style.display === 'block' ? 'none' : 'block';
			this.menuElement.style.display = display;
			if (display === 'block') this.menuBtn.classList.add('active');
			else this.menuBtn.classList.remove('active');
			sessionStorage.setItem('menu', display);
		});
	}

	handleMenuSelection(e: Event) {
		const el = e.target;

		if (el instanceof HTMLInputElement) {
			switch (el.id) {
				case 'showStatus':
					document.getElementById('status').style.display = el.checked ? 'block' : 'none';
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'showAABBs':
					globalToggles.showAABBs = el.checked;
					for (let m of models) {
						if (el.checked) nodes[m].initialize_bounding_boxes();
						else if (nodes[m].hasBoundingBox) nodes[m].AABBBuffer.destroy();
					}
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'showOBBs':
					globalToggles.showOBBs = el.checked;
					for (let m of models) {
						if (el.checked) nodes[m].initialize_bounding_boxes();
						else if (nodes[m].hasBoundingBox) nodes[m].OBBBuffer.destroy();
					}
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'visualizeLightFrustums':
					globalToggles.visualizeLightFrustums = el.checked;
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'lockDirectionalFrustums':
					globalToggles.lockDirectionalFrustums = el.checked;
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'antialiasing':
					globalToggles.antialiasing = el.checked;

					this.renderer.createDepthTexture();
					this.renderer.createPipeline(this.bindGroupLayouts);
					this.skybox.createPipeline(this.renderer.device);
					this.renderer.lightFrustums.createPipeline();
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'showFPS':
					globalToggles.showFPS = el.checked;
					this.framerateElement.style.display = el.checked ? 'block' : 'none';
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
				case 'todLock':
					globalToggles.todLocked = el.checked;
					sessionStorage.setItem(el.id, el.checked.toString());
					break;
			}
		}

		if (el instanceof HTMLSelectElement) {
			switch (el.id) {
				case 'resolution':
					sessionStorage.setItem(el.id, el.value);
					window.location.reload();
					break;
				case 'collisionDetection':
					sessionStorage.setItem(el.id, el.value);
					globalToggles.collisionDetection = el.value;
					break;
			}
		}
	}

	handleInput(e: Event) {
		const el = e.target;
		if (!(el instanceof HTMLInputElement)) return;

		switch (el.id) {
			case 'fpsCap':
				globalToggles.fixedTimeStep = 1000 / parseInt(el.value);
				sessionStorage.setItem(el.id, globalToggles.fixedTimeStep.toString());
				document.getElementById('fpsCapValue').innerText = el.value;
				break;
			case 'fov':
				this.camera.setFOV(parseInt(el.value));
				sessionStorage.setItem(el.id, el.value);
				document.getElementById('fovValue').innerText = el.value;
				break;
			case 'tod':
				for (let m of models) {
					const node: GLTFNode = nodes[m];
					if (node.name === 'Sun') {
						sessionStorage.setItem(el.id, el.value);
						node.quat = quatFromTime(el.value);
						const euler = eulerFromQuat(node.quat);
						const hourAngle = euler[2];
						globalToggles.sunAngle = hourAngle;

						const rotationMatrix: Mat4 = mat3.fromQuat(node.quat);
						const worldDirection: Vec3 = vec3.transformMat3([0, 1, 0], rotationMatrix);
						const movement: Vec3 = vec3.scale(worldDirection, 400);
						node.position = movement;
						break;
					}
				}
				break;
		}

		this.controller.pointerLocked = true;
		setTimeout(() => (this.controller.pointerLocked = false), 100);
	}
}
