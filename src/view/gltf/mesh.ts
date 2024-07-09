import GLTFPrimitive from './primitive';

export default class GLTFMesh {
	name: string;
	primitives: GLTFPrimitive[];

	constructor(name: string, primitives: GLTFPrimitive[]) {
		this.name = name;
		this.primitives = primitives;
	}
}
