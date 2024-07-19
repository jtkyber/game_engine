import { Mat4, Vec3 } from 'wgpu-matrix';
import GLTFNode from '../view/gltf/node';

export default class Light {
	name: string;
	type: string;
	intensity: number;
	color: Vec3;
	innerConeAngle: number;
	outerConeAngle: number;
	nodeIndex: number;

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
		this.type = type;
		this.intensity = intensity;
		this.color = color;
		this.innerConeAngle = innerConeAngle;
		this.outerConeAngle = outerConeAngle;
		this.nodeIndex = nodeIndex;
	}
}
