import BindGroupLayouts from '../view/bindGroupLayouts';
import { models, nodes } from '../view/gltf/loader';
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
	frame: () => any;

	constructor(
		renderer: Renderer,
		bindGroupLayouts: BindGroupLayouts,
		skybox: Skybox,
		framerateElement: HTMLElement,
		canvas: HTMLCanvasElement,
		controller: Controller,
		frame: () => any
	) {
		this.renderer = renderer;
		this.bindGroupLayouts = bindGroupLayouts;
		this.skybox = skybox;
		this.framerateElement = framerateElement;
		this.canvas = canvas;
		this.controller = controller;
		this.frame = frame;

		document.addEventListener('change', e => this.handleMenuSelection(e));
	}

	handleMenuSelection(e: Event) {
		const el = e.target;

		if (el instanceof HTMLInputElement) {
			switch (el.id) {
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
				case 'fpsCap':
					globalToggles.frameCap = 1000 / parseInt(el.value);
					sessionStorage.setItem(el.id, globalToggles.frameCap.toString());
					break;
			}
		}

		if (el instanceof HTMLSelectElement) {
			switch (el.id) {
				case 'resolution':
					sessionStorage.setItem(el.id, el.value);
					window.location.reload();
					break;
			}
		}

		this.controller.pointerLocked = true;
		setTimeout(() => (this.controller.pointerLocked = false), 100);
	}
}
