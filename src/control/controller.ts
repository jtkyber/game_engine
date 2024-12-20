import { Vec3, vec3 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import { ControlBoard } from '../types/types';
import { animations, nodes } from '../view/gltf/loader';
import { debugging } from './app';

export default class Controller {
	canvas: HTMLCanvasElement;
	camera: Camera;
	player: number;
	pointerLocked: boolean;
	moveVec: number[] = [0, 0];
	controlBoard: ControlBoard = {
		f: 0,
		b: 0,
		l: 0,
		r: 0,
		space: 0,
		shift: 0,
	};
	spinInterpolationCoefficient: number;
	scrollAmt: number;

	constructor(canvas: HTMLCanvasElement, camera: Camera, player: number) {
		this.canvas = canvas;
		this.camera = camera;
		this.player = player;
		this.spinInterpolationCoefficient = 0;
		this.scrollAmt = 0;

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
		this.spinInterpolationCoefficient += 0.01;
		this.camera.distFromModel += this.scrollAmt;

		this.moveVec[0] = this.controlBoard.f - this.controlBoard.b;
		this.moveVec[1] = this.controlBoard.r - this.controlBoard.l;

		const speedMult: number = this.controlBoard.shift ? 3 : 1;

		const endDir: Vec3 = this.get_rotated_direction_with_forward(this.camera.forwardMove);
		if (debugging.firstPersonMode) nodes[this.player].spin_to(this.camera.yaw);

		if (this.moveVec[0] !== 0 || this.moveVec[1] !== 0) {
			if (debugging.firstPersonMode) {
				if (this.moveVec[0] !== 0) {
					nodes[this.player].move(
						vec3.mulScalar(nodes[this.player].forwardMove, -this.moveVec[0]),
						speedMult
					);
				}
				if (this.moveVec[1] !== 0) {
					nodes[this.player].move(vec3.mulScalar(nodes[this.player].rightMove, -this.moveVec[1]), speedMult);
				}
			} else {
				nodes[this.player].spin_lerp(endDir);
				nodes[this.player].move(vec3.mulScalar(nodes[this.player].forwardMove, -1), speedMult);
			}

			if (debugging.flashlightOn) {
				animations['Walk_flashlight'].play(1.4 * speedMult);
			} else {
				animations['Walk'].play(1.4 * speedMult);
			}
		} else {
			if (debugging.flashlightOn) {
				animations['Idle_flashlight'].play();
			} else {
				animations['Idle'].play();
			}
		}

		this.scrollAmt = 0;
	}

	get_rotated_direction_with_forward(forward: Vec3): Vec3 {
		let newDir: Vec3;
		const rotationAxis: Vec3 = vec3.create(0, 1, 0);
		switch (this.moveVec.toString()) {
			case '0,0':
				// Still
				return;
			case '1,0':
				// Forward
				newDir = forward;
				break;
			case '-1,0':
				// Backward
				newDir = this.dir_rotated(forward, Math.PI, rotationAxis);
				break;
			case '0,1':
				// Right
				newDir = this.dir_rotated(forward, -Math.PI / 2, rotationAxis);
				break;
			case '0,-1':
				// Left
				newDir = this.dir_rotated(forward, Math.PI / 2, rotationAxis);
				break;
			case '1,1':
				// Forward-Right
				newDir = this.dir_rotated(forward, -Math.PI / 4, rotationAxis);
				break;
			case '1,-1':
				// Forward-Left
				newDir = this.dir_rotated(forward, Math.PI / 4, rotationAxis);
				break;
			case '-1,1':
				// Backward-Right
				newDir = this.dir_rotated(forward, Math.PI + Math.PI / 4, rotationAxis);
				break;
			case '-1,-1':
				// Backward-Left
				newDir = this.dir_rotated(forward, -(Math.PI + Math.PI / 4), rotationAxis);
				break;
		}

		return newDir;
	}

	dir_rotated(dir: Vec3, angle: number, axis: Vec3) {
		const chunk1 = vec3.mulScalar(dir, Math.cos(angle));
		const chunk2 = vec3.mulScalar(vec3.cross(axis, dir), Math.sin(angle));
		const chunk3 = vec3.mulScalar(vec3.mulScalar(axis, vec3.dot(axis, dir)), 1 - Math.cos(angle));

		return vec3.add(chunk1, vec3.add(chunk2, chunk3));
	}

	handleKeyDown(e: KeyboardEvent) {
		if (!this.pointerLocked) return;

		switch (e.code) {
			case 'KeyW':
				if (!this.controlBoard.f) this.controlBoard.f = 1;
				break;
			case 'KeyS':
				if (!this.controlBoard.b) this.controlBoard.b = 1;
				break;
			case 'KeyA':
				if (!this.controlBoard.l) this.controlBoard.l = 1;
				break;
			case 'KeyD':
				if (!this.controlBoard.r) this.controlBoard.r = 1;
				break;
			case 'Space':
				if (!this.controlBoard.space) this.controlBoard.space = 1;
				break;
			case 'ShiftLeft':
				if (!this.controlBoard.shift) this.controlBoard.shift = 1;
				break;
		}
	}

	handleKeyUp(e: KeyboardEvent) {
		if (!this.pointerLocked) return;

		switch (e.code) {
			case 'KeyW':
				this.controlBoard.f = 0;
				break;
			case 'KeyS':
				this.controlBoard.b = 0;
				break;
			case 'KeyA':
				this.controlBoard.l = 0;
				break;
			case 'KeyD':
				this.controlBoard.r = 0;
				break;
			case 'Space':
				this.controlBoard.space = 0;
				break;
			case 'KeyV':
				debugging.firstPersonMode = !debugging.firstPersonMode;
				this.camera.setInitialCamDists();
				break;
			case 'KeyQ':
				debugging.flashlightOn = !debugging.flashlightOn;
				break;
			case 'ShiftLeft':
				this.controlBoard.shift = 0;
				break;
		}
	}

	handleMouseMove(e: MouseEvent) {
		if (!this.pointerLocked) return;
		this.camera.yaw -= e.movementX * 0.0005;
		this.camera.pitch -= e.movementY * 0.0005;
	}

	handleMouseDown() {
		if (!this.pointerLocked) {
			this.lockPointer();
		} else {
		}
	}

	handleScrollWheel(e: WheelEvent) {
		if (!this.pointerLocked) return;

		this.scrollAmt += e.deltaY / (1000 / this.camera.distFromModel);
	}

	lockPointer() {
		if (document.pointerLockElement !== this.canvas) {
			this.canvas.requestPointerLock =
				this.canvas.requestPointerLock ||
				//@ts-expect-error
				this.canvas.mozRequestPointerLock ||
				//@ts-expect-error
				this.canvas.webkitRequestPointerLock;

			////@ts-expect-error
			const promise = this.canvas.requestPointerLock({ unadjustedMovement: true });

			////@ts-expect-error
			if (!promise) {
				console.log('Disabling mouse acceleration is not supported');
				return this.canvas.requestPointerLock();
			}

			return (
				promise
					////@ts-expect-error
					.then(() => console.log('Pointer is locked'))
					////@ts-expect-error
					.catch(err => {
						if (err.name === 'NotSupportedError') {
							return this.canvas.requestPointerLock();
						}
					})
			);
		}
	}
}
