import { Vec3, vec3 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import Model from '../model/model';
import { IMoveVecOnOff, MoveVec, MoveVecOnOffValue } from '../types/types';

export default class Controller {
	canvas: HTMLCanvasElement;
	camera: Camera;
	player: Model;
	pointerLocked: boolean;
	spinAmt: number[];
	moveVec: MoveVec;
	moveVecOnOff: IMoveVecOnOff;

	constructor(canvas: HTMLCanvasElement, camera: Camera, player: Model) {
		this.canvas = canvas;
		this.camera = camera;
		this.player = player;
		this.spinAmt = [0, 0];
		this.moveVec = [0, 0];
		this.moveVecOnOff = {
			f: 0,
			b: 0,
			l: 0,
			r: 0,
		};

		document.addEventListener('keydown', e => this.handleKeyDown(e));
		document.addEventListener('keyup', e => this.handleKeyUp(e));
		document.addEventListener('mousemove', e => this.handleMouseMove(e));
		document.addEventListener('mousedown', () => this.handleMouseDown());
		canvas.addEventListener('wheel', e => this.handleScrollWheel(e), { passive: true });
		document.addEventListener(
			'pointerlockchange',
			() => {
				if (document.pointerLockElement === canvas) {
					this.pointerLocked = true;
				} else this.pointerLocked = false;
			},
			false
		);
	}

	update() {
		this.moveVec[0] = <MoveVecOnOffValue>(this.moveVecOnOff.f - this.moveVecOnOff.b);
		this.moveVec[1] = <MoveVecOnOffValue>(this.moveVecOnOff.r - this.moveVecOnOff.l);

		const cameraPos: Vec3 = this.camera.position;
		this.camera.move_FB(this.moveVec[0], this.player.speed);
		this.camera.strafe(this.moveVec[1], this.player.speed);
		const cameraMoveVec: Vec3 = vec3.sub(this.camera.position, cameraPos);

		this.player.move(vec3.normalize(cameraMoveVec), this.player.speed);

		this.camera.spin_on_target(this.spinAmt[0], this.spinAmt[1], this.player.position);

		this.spinAmt = [0, 0];
	}

	handleKeyDown(e: KeyboardEvent) {
		if (!this.pointerLocked) return;

		switch (e.code) {
			case 'KeyW':
				this.moveVecOnOff.f = 1;
				break;
			case 'KeyS':
				this.moveVecOnOff.b = 1;
				break;
			case 'KeyA':
				this.moveVecOnOff.l = 1;
				break;
			case 'KeyD':
				this.moveVecOnOff.r = 1;
				break;
		}
	}

	handleKeyUp(e: KeyboardEvent) {
		if (!this.pointerLocked) return;

		switch (e.code) {
			case 'KeyW':
				this.moveVecOnOff.f = 0;
				break;
			case 'KeyS':
				this.moveVecOnOff.b = 0;
				break;
			case 'KeyA':
				this.moveVecOnOff.l = 0;
				break;
			case 'KeyD':
				this.moveVecOnOff.r = 0;
				break;
		}
	}

	handleMouseMove(e: MouseEvent) {
		if (!this.pointerLocked) return;

		this.spinAmt = [-(e.movementX / 20), -(e.movementY / 20)];
	}

	handleMouseDown() {
		if (!this.pointerLocked) {
			this.lockPointer();
		} else {
		}
	}

	handleScrollWheel(e: WheelEvent) {
		if (!this.pointerLocked) return;
	}

	lockPointer() {
		if (document.pointerLockElement !== this.canvas) {
			this.canvas.requestPointerLock =
				this.canvas.requestPointerLock ||
				//@ts-expect-error
				this.canvas.mozRequestPointerLock ||
				//@ts-expect-error
				this.canvas.webkitRequestPointerLock;

			//@ts-expect-error
			const promise = this.canvas.requestPointerLock({ unadjustedMovement: true });

			//@ts-expect-error
			if (!promise) {
				console.log('Disabling mouse acceleration is not supported');
				return this.canvas.requestPointerLock();
			}

			return (
				promise
					//@ts-expect-error
					.then(() => console.log('Pointer is locked'))
					//@ts-expect-error
					.catch(err => {
						if (err.name === 'NotSupportedError') {
							return this.canvas.requestPointerLock();
						}
					})
			);
		}
	}
}
