import { Mat4, Vec3 } from 'wgpu-matrix';

export default class GLTFLight {
	name: string;
	type: string;
	intensity: number;
	color: Vec3;
	innerConeAngle: number;
	outerConeAngle: number;
	transform: Mat4;

	constructor(
		name: string,
		type: string,
		intensity: number,
		color: Vec3,
		innerConeAngle: number,
		outerConeAngle: number,
		transform: Mat4
	) {
		this.name = name;
		this.type = type;
		this.intensity = intensity;
		this.color = color;
		this.innerConeAngle = innerConeAngle;
		this.outerConeAngle = outerConeAngle;
		this.transform = transform;
	}
}
