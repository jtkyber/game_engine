import { Mat4, Vec3, mat4, vec3 } from 'wgpu-matrix';
import { LightType } from '../types/enums';
import { nodes } from '../view/gltf/loader';
import GLTFNode from '../view/gltf/node';

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
	forward: Vec3;
	position: Vec3 = vec3.create(0, 0, 0);

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
			case 'directional':
				this.type = LightType.DIRECTIONAL;
			case 'point':
				this.type = LightType.POINT;
		}
		this.intensity = intensity;
		this.color = color;
		this.innerConeAngle = innerConeAngle;
		this.outerConeAngle = outerConeAngle;

		this.angleScale = 1 / Math.max(0.001, Math.cos(innerConeAngle) - Math.cos(outerConeAngle));
		this.angleOffset = -Math.cos(outerConeAngle) * this.angleScale;

		this.nodeIndex = nodeIndex;
	}

	get_projection_matrix(): Mat4 {
		return mat4.perspectiveReverseZ(this.outerConeAngle, 1.0, 0.01, 1000);
	}

	get_view_matrix(): Mat4 {
		const transform: Mat4 = nodes[this.nodeIndex].globalTransform;
		const right: Vec3 = vec3.fromValues(transform[0], transform[1], transform[2]);
		const up: Vec3 = vec3.fromValues(transform[4], transform[5], transform[6]);
		this.forward = vec3.fromValues(transform[8], transform[9], transform[10]);
		this.position = vec3.fromValues(transform[12], transform[13], transform[14]);

		const viewMatrix: Mat4 = mat4.create();

		viewMatrix[0] = right[0];
		viewMatrix[1] = up[0];
		viewMatrix[2] = this.forward[0];
		viewMatrix[3] = 0;

		viewMatrix[4] = right[1];
		viewMatrix[5] = up[1];
		viewMatrix[6] = this.forward[1];
		viewMatrix[7] = 0;

		viewMatrix[8] = right[2];
		viewMatrix[9] = up[2];
		viewMatrix[10] = this.forward[2];
		viewMatrix[11] = 0;

		viewMatrix[12] = -vec3.dot(right, this.position);
		viewMatrix[13] = -vec3.dot(up, this.position);
		viewMatrix[14] = -vec3.dot(this.forward, this.position);
		viewMatrix[15] = 1;

		return viewMatrix;
	}

	get_light_view_proj_matrix(): Mat4 {
		return mat4.mul(this.get_projection_matrix(), this.get_view_matrix());
	}
}
