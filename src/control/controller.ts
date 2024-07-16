import { Vec3, vec3 } from 'wgpu-matrix';
import { Camera } from '../model/camera';
import Player from '../model/player';
import { MoveSwitchBoard } from '../types/types';

export default class Controller {
	canvas: HTMLCanvasElement;
	camera: Camera;
	player: Player;
	pointerLocked: boolean;
	moveVec: number[] = [0, 0];
	moveSwitchBoard: MoveSwitchBoard = {
		f: 0,
		b: 0,
		l: 0,
		r: 0,
	};
	spinInterpolationCoefficient: number;
	scrollInterpolationCoefficient: number;

	constructor(canvas: HTMLCanvasElement, camera: Camera, player: Player) {
		this.canvas = canvas;
		this.camera = camera;
		this.player = player;
		this.spinInterpolationCoefficient = 0;
		this.scrollInterpolationCoefficient = 0;

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
		this.scrollInterpolationCoefficient += 0.01;
		this.spinInterpolationCoefficient += 0.01;

		this.moveVec[0] = this.moveSwitchBoard.f - this.moveSwitchBoard.b;
		this.moveVec[1] = this.moveSwitchBoard.r - this.moveSwitchBoard.l;

		if (this.moveVec[0] !== 0 || this.moveVec[1] !== 0) {
			const endDir: Vec3 = this.get_rotated_direction_with_forward(this.camera.forwardMove);
			this.player.spin_lerp(endDir);
			this.player.move(vec3.mulScalar(this.player.forwardMove, -1), this.player.speed);
		}

		this.camera.lerp_cam_dist(this.scrollInterpolationCoefficient);
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
				if (this.moveSwitchBoard.f) return;
				this.moveSwitchBoard.f = 1;
				break;
			case 'KeyS':
				if (this.moveSwitchBoard.b) return;
				this.moveSwitchBoard.b = 1;
				break;
			case 'KeyA':
				if (this.moveSwitchBoard.l) return;
				this.moveSwitchBoard.l = 1;
				break;
			case 'KeyD':
				if (this.moveSwitchBoard.r) return;
				this.moveSwitchBoard.r = 1;
				break;
		}
	}

	handleKeyUp(e: KeyboardEvent) {
		if (!this.pointerLocked) return;

		switch (e.code) {
			case 'KeyW':
				this.moveSwitchBoard.f = 0;
				break;
			case 'KeyS':
				this.moveSwitchBoard.b = 0;
				break;
			case 'KeyA':
				this.moveSwitchBoard.l = 0;
				break;
			case 'KeyD':
				this.moveSwitchBoard.r = 0;
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

		this.scrollInterpolationCoefficient = 0;
		this.camera.camDistLerpInc = e.deltaY / 30;
		this.camera.distFromModelStart = this.camera.distFromModel;
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
