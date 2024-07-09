import { Mat4 } from 'wgpu-matrix';
import GLTFMesh from './mesh';

export default class GLTFNode {
	name: string;
	parent: number;
	transform: Mat4;
	mesh: GLTFMesh;

	constructor(name: string, parent: number, transform: Mat4, mesh: GLTFMesh) {
		this.name = name;
		this.parent = parent;
		this.transform = transform;
		this.mesh = mesh;
	}
}
