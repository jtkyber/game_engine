import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from 'wgpu-matrix';
import { aspect } from '../control/app';
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
	projectionMatrix: Mat4;
	camera: Camera;
	player: number;

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

	update() {
		const transform: Mat4 = nodes[this.nodeIndex].globalTransform;
		// this.right = vec3.fromValues(transform[0], transform[1], transform[2]);
		// this.up = vec3.fromValues(transform[4], transform[5], transform[6]);
		this.forward = vec3.fromValues(transform[8], transform[9], transform[10]);
		this.right = vec3.normalize(vec3.cross(this.forward, [0, 1, 0]));
		this.up = vec3.normalize(vec3.cross(this.right, this.forward));
		this.position = vec3.fromValues(transform[12], transform[13], transform[14]);

		switch (this.type) {
			case LightType.SPOT:
				this.lightViewProjMatrices.set(mat4.mul(this.get_proj_matrix(), this.get_view_matrix()), 0);
				break;
			case LightType.DIRECTIONAL:
				this.position = vec3.add(this.position, this.camera.position);

				const splits: Float32Array = this.camera.cascadeSplits;
				for (let i = 0; i < this.camera.cascadeCount; i++) {
					const corners: Vec4[] = this.get_frustum_corners_world_space(splits[i], splits[i + 1]);

					const view: Mat4 = this.get_view_matrix(corners);
					this.lightViewProjMatrices.set(mat4.mul(this.get_proj_matrix(view, corners), view), i * 16);
				}
				break;
			case LightType.POINT:
				break;
		}
	}

	get_frustum_corners_world_space(near: number, far: number): Vec4[] {
		const proj: Mat4 = mat4.perspectiveReverseZ(this.camera.fov, aspect, near, far);

		const inv: Mat4 = mat4.inverse(mat4.mul(proj, this.camera.get_view()));

		const directionalFrustumCorners: Vec4[] = [];
		for (let x = 0; x < 2; x++) {
			for (let y = 0; y < 2; y++) {
				for (let z = 0; z < 2; z++) {
					const temp: Vec4 = vec4.create(2 * x - 1, 2 * y - 1, 2 * z - 1, 1);
					const point: Vec4 = vec4.transformMat4(temp, inv);
					directionalFrustumCorners.push(vec4.divScalar(point, point[3]));
				}
			}
		}
		return directionalFrustumCorners;
	}

	get_proj_matrix(view?: Mat4, directionalFrustumCorners?: Vec4[]): Mat4 {
		switch (this.type) {
			case LightType.SPOT:
				return mat4.perspectiveReverseZ(this.outerConeAngle * 2, 1.0, 0.1, 100);
			case LightType.DIRECTIONAL:
				let minX: number = Infinity;
				let maxX: number = -Infinity;
				let minY: number = Infinity;
				let maxY: number = -Infinity;
				let minZ: number = Infinity;
				let maxZ: number = -Infinity;

				for (let v of directionalFrustumCorners) {
					const trf: Vec3 = vec3.transformMat4(v, view);

					minX = Math.min(minX, trf[0]);
					maxX = Math.max(maxX, trf[0]);
					minY = Math.min(minY, trf[1]);
					maxY = Math.max(maxY, trf[1]);
					minZ = Math.min(minZ, trf[2]);
					maxZ = Math.max(maxZ, trf[2]);
				}

				const zMult: number = 10;
				if (minZ < 0) minZ *= zMult;
				else minZ /= zMult;

				if (maxZ < 0) maxZ /= zMult;
				else maxZ *= zMult;

				return mat4.ortho(minX, maxX, minY, maxY, maxZ, minZ);
			case LightType.POINT:
				return;
		}
	}

	get_view_matrix(directionalFrustumCorners?: Vec4[]): Mat4 {
		switch (this.type) {
			case LightType.SPOT:
				// const viewMatrix: Mat4 = mat4.create();

				// viewMatrix[0] = -this.right[0];
				// viewMatrix[1] = this.up[0];
				// viewMatrix[2] = this.forward[0];
				// viewMatrix[3] = 0;

				// viewMatrix[4] = -this.right[1];
				// viewMatrix[5] = this.up[1];
				// viewMatrix[6] = this.forward[1];
				// viewMatrix[7] = 0;

				// viewMatrix[8] = -this.right[2];
				// viewMatrix[9] = this.up[2];
				// viewMatrix[10] = this.forward[2];
				// viewMatrix[11] = 0;

				// viewMatrix[12] = -vec3.dot(vec3.negate(this.right), this.position);
				// viewMatrix[13] = -vec3.dot(this.up, this.position);
				// viewMatrix[14] = -vec3.dot(this.forward, this.position);
				// viewMatrix[15] = 1;

				// return viewMatrix;

				const target: Vec3 = vec3.add(this.position, vec3.negate(this.forward));
				return mat4.lookAt(this.position, target, [0, 1, 0]);

			case LightType.DIRECTIONAL:
				let center: Vec3 = vec3.create(0, 0, 0);

				for (let v of directionalFrustumCorners) {
					vec3.add(center, vec3.fromValues(v[0], v[1], v[2]), center);
				}

				vec3.divScalar(center, directionalFrustumCorners.length, center);

				return mat4.lookAt(vec3.add(center, this.get_light_direction()), center, [0, 1, 0]);
			case LightType.POINT:
				return;
		}
	}

	get_light_direction(): Vec3 {
		switch (this.type) {
			case LightType.SPOT:
				return this.forward;
			case LightType.DIRECTIONAL:
				return vec3.normalize(vec3.sub(this.position, this.camera.position));
			case LightType.POINT:
				return vec3.create(0, 0, 0);
		}
	}
}
