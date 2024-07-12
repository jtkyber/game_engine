import { Mat4 } from 'wgpu-matrix';
import { moveableFlag } from '../../types/enums';
import GLTFMesh from './mesh';

export default class GLTFNode {
	name: string;
	flag: moveableFlag;
	parent: number = null;
	transform: Mat4;
	mesh: GLTFMesh;

	constructor(name: string, flag: any, parent: number, transform: Mat4, mesh: GLTFMesh) {
		this.name = name;
		this.flag = flag;
		this.parent = parent;
		this.transform = transform;
		this.mesh = mesh;
	}
}
