import { textSpanContainsTextSpan } from 'typescript';
import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from 'wgpu-matrix';
import { aspect, debugging } from '../control/app';
import { LightType } from '../types/enums';
import { nodes } from '../view/gltf/loader';
import { Camera } from './camera';

export default class Light {
	name: string;
	type: LightType;
	intensity: number;
	color: Vec3;
	innerConeAngle?: number = 0;
	outerConeAngle?: number = 0;
	nodeIndex: number;
	angleScale?: number = 0;
	angleOffset?: number = 0;
	up: Vec3;
	right: Vec3;
	forward: Vec3;
	position: Vec3 = vec3.create(0, 0, 0);
	lightViewProjMatrices: Float32Array = new Float32Array(16 * 6);
	lightViewMatrices: Float32Array = new Float32Array(16 * 6);
	inverseLightViewProjMatrices: Float32Array = new Float32Array(16 * 6);

	centers: Float32Array;
	projectionMatrix: Mat4;
	camera: Camera;
	player: number;
	counter = 0;

	constructor(
		name: string,
		type: string,
		intensity: number,
		color: Vec3,
		innerConeAngle: number,
		outerConeAngle: number,
		nodeIndex: number
	) {
		this.name = name;
		switch (type) {
			case 'spot':
				this.type = LightType.SPOT;
				break;
			case 'directional':
				this.type = LightType.DIRECTIONAL;
				break;
			case 'point':
				this.type = LightType.POINT;
				break;
		}
		this.intensity = intensity;
		this.color = color;
		this.innerConeAngle = innerConeAngle;
		this.outerConeAngle = outerConeAngle;

		this.angleScale = 1 / Math.max(0.001, Math.cos(innerConeAngle) - Math.cos(outerConeAngle));
		this.angleOffset = -Math.cos(outerConeAngle) * this.angleScale;

		this.nodeIndex = nodeIndex;
	}

	update(cameraForward: Vec3) {
		const transform: Mat4 = nodes[this.nodeIndex].globalTransform;
		this.forward = vec3.fromValues(transform[8], transform[9], transform[10]);
		this.position = vec3.fromValues(transform[12], transform[13], transform[14]);

		if (nodes[this.nodeIndex].name === 'Flashlight') {
			if (debugging.firstPersonMode) this.forward = vec3.negate(cameraForward);
			else this.forward = nodes[this.player].forward;
		}

		this.set_lvp_matrix();
	}

	set_lvp_matrix() {
		switch (this.type) {
			case LightType.SPOT:
				const proj: Mat4 = mat4.perspectiveReverseZ(this.outerConeAngle * 2, 1.0, 0.1, 50);
				const target: Vec3 = vec3.add(this.position, vec3.negate(this.forward));
				const view: Mat4 = mat4.lookAt(this.position, target, [0, 1, 0]);
				const lightViewProjMatrix: Mat4 = mat4.mul(proj, view);
				this.lightViewProjMatrices.set(lightViewProjMatrix, 0);
				this.lightViewMatrices.set(view, 0);

				if (debugging.visualizeLightFrustums) {
					this.inverseLightViewProjMatrices.set(mat4.inverse(lightViewProjMatrix), 0);
				}
				break;
			// case LightType.DIRECTIONAL:
			// 	const splits: Float32Array = this.camera.cascadeSplits;
			// 	if (debugging.lockDirectionalFrustums) {
			// 		if (this.counter > 50) return;
			// 		this.counter++;
			// 	}

			// 	for (let i = 0; i < this.camera.cascadeCount; i++) {
			// 		const corners: Vec4[] = this.get_frustum_corners_world_space(splits[i], splits[i + 1]);
			// 		let center: Vec3 = this.get_center(corners);

			// 		const radius: number = vec4.dist(corners[0], corners[6]) / 2;
			// 		const texelsPerUnit: number = 1024 / (radius * 2);
			// 		const scaler: Mat4 = mat4.scaling([texelsPerUnit, texelsPerUnit, texelsPerUnit]);

			// 		const lightDir: Vec3 = this.forward;

			// 		let lookAt: Mat4 = mat4.lookAt([0, 0, 0], lightDir, [0, 1, 0]);
			// 		mat4.mul(lookAt, scaler, lookAt);
			// 		const lookatInv: Mat4 = mat4.inverse(lookAt);

			// 		vec3.transformMat4(center, lookAt, center);
			// 		center[0] = Math.floor(center[0]);
			// 		center[1] = Math.floor(center[1]);
			// 		vec3.transformMat4(center, lookatInv, center);

			// 		// const eye: Vec3 = vec3.add(center, vec3.mulScalar(lightDir, radius * 2));
			// 		const eye: Vec3 = vec3.add(center, lightDir);
			// 		const lightViewMatrix: Mat4 = mat4.lookAt(eye, center, [0, 1, 0]);
			// 		const lightProjMatrix: Mat4 = mat4.ortho(
			// 			-radius,
			// 			radius,
			// 			-radius,
			// 			radius,
			// 			radius * 10,
			// 			-radius * 10
			// 		);

			// 		const lightViewProjMatrix: Mat4 = mat4.mul(lightProjMatrix, lightViewMatrix);

			// 		this.lightViewProjMatrices.set(lightViewProjMatrix, i * 16);
			// 		this.lightViewMatrices.set(lightViewMatrix, i * 16);

			// 		if (debugging.visualizeLightFrustums) {
			// 			this.inverseLightViewProjMatrices.set(mat4.inverse(lightViewProjMatrix), i * 16);
			// 		}
			// 	}
			// 	break;
			case LightType.DIRECTIONAL:
				const splits: Float32Array = this.camera.cascadeSplits;
				if (debugging.lockDirectionalFrustums) {
					if (this.counter > 50) return;
					this.counter++;
				}

				for (let i = 0; i < this.camera.cascadeCount; i++) {
					const corners: Vec3[] = this.get_frustum_corners_world_space_temp(splits[i], splits[i + 1]);
					let center: Vec3 = this.get_center(corners);

					const radius: number = vec3.dist(corners[0], corners[6]) / 2;
					this.camera.cascadeRadiusArr[i] = radius;
					const texelsPerUnit: number = 1024 / (radius * 2);
					const scaler: Mat4 = mat4.scaling([texelsPerUnit, texelsPerUnit, texelsPerUnit]);

					const lightDir: Vec3 = this.forward;

					let lookAt: Mat4 = mat4.lookAt([0, 0, 0], lightDir, [0, 1, 0]);
					mat4.mul(lookAt, scaler, lookAt);
					const lookatInv: Mat4 = mat4.inverse(lookAt);

					vec3.transformMat4(center, lookAt, center);
					center[0] = Math.floor(center[0]);
					center[1] = Math.floor(center[1]);
					vec3.transformMat4(center, lookatInv, center);

					const eye: Vec3 = vec3.add(center, vec3.mulScalar(lightDir, radius * 2));
					const lightViewMatrix: Mat4 = mat4.lookAt(eye, center, [0, 1, 0]);
					const lightProjMatrix: Mat4 = mat4.ortho(-radius, radius, -radius, radius, radius * 6, -radius * 6);

					const lightViewProjMatrix: Mat4 = mat4.mul(lightProjMatrix, lightViewMatrix);

					this.lightViewProjMatrices.set(lightViewProjMatrix, i * 16);
					this.lightViewMatrices.set(lightViewMatrix, i * 16);

					if (debugging.visualizeLightFrustums) {
						this.inverseLightViewProjMatrices.set(mat4.inverse(lightViewProjMatrix), i * 16);
					}
				}
				break;
			case LightType.POINT:
				break;
		}
	}

	get_frustum_corners_world_space_temp(near: number, far: number): Vec3[] {
		const proj: Mat4 = mat4.perspectiveReverseZ(this.camera.fov, aspect, near, far);

		const inv: Mat4 = mat4.inverse(mat4.mul(proj, this.camera.view));

		const corners = [
			vec3.create(-1, 1, 0),
			vec3.create(1, 1, 0),
			vec3.create(1, -1, 0),
			vec3.create(-1, -1, 0),
			vec3.create(-1, 1, 1),
			vec3.create(1, 1, 1),
			vec3.create(1, -1, 1),
			vec3.create(-1, -1, 1),
		];

		for (let i = 0; i < 8; i++) {
			corners[i] = vec3.transformMat4(corners[i], inv);
		}

		return corners;
	}

	get_frustum_corners_world_space(near: number, far: number): Vec3[] {
		const proj: Mat4 = mat4.perspectiveReverseZ(this.camera.fov, aspect, near, far);

		const inv: Mat4 = mat4.inverse(mat4.mul(proj, this.camera.view));

		const corners: Vec3[] = [];
		for (let x = 0; x < 2; x++) {
			for (let y = 0; y < 2; y++) {
				for (let z = 0; z < 2; z++) {
					const temp: Vec4 = vec4.create(2 * x - 1, 2 * y - 1, 2 * z - 1, 1);
					const point: Vec4 = vec4.transformMat4(temp, inv);
					const cornerTemp: Vec4 = vec4.divScalar(point, point[3]);
					corners.push(vec3.create(cornerTemp[0], cornerTemp[1], cornerTemp[2]));
				}
			}
		}
		return corners;
	}

	get_center(corners?: Vec4[]): Vec3 {
		let center: Vec3 = vec3.create(0, 0, 0);

		for (let v of corners) {
			vec3.add(center, vec3.fromValues(v[0], v[1], v[2]), center);
		}

		return vec3.divScalar(center, corners.length);
	}
}
