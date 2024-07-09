import { Mat4, Quat, Vec3 } from 'wgpu-matrix';
import { GLTFComponentType, GLTFType } from '../types/enums';

export function fromRotationTranslationScale(
	out: Mat4,
	q: Quat | number[],
	v: Vec3 | number[],
	s: Vec3 | number[]
) {
	// Quaternion math
	let x = q[0],
		y = q[1],
		z = q[2],
		w = q[3];
	let x2 = x + x;
	let y2 = y + y;
	let z2 = z + z;

	let xx = x * x2;
	let xy = x * y2;
	let xz = x * z2;
	let yy = y * y2;
	let yz = y * z2;
	let zz = z * z2;
	let wx = w * x2;
	let wy = w * y2;
	let wz = w * z2;
	let sx = s[0];
	let sy = s[1];
	let sz = s[2];

	out[0] = (1 - (yy + zz)) * sx;
	out[1] = (xy + wz) * sx;
	out[2] = (xz - wy) * sx;
	out[3] = 0;
	out[4] = (xy - wz) * sy;
	out[5] = (1 - (xx + zz)) * sy;
	out[6] = (yz + wx) * sy;
	out[7] = 0;
	out[8] = (xz + wy) * sz;
	out[9] = (yz - wx) * sz;
	out[10] = (1 - (xx + yy)) * sz;
	out[11] = 0;
	out[12] = v[0];
	out[13] = v[1];
	out[14] = v[2];
	out[15] = 1;

	return out;
}

export function parseGltfType(type: string) {
	switch (type) {
		case 'SCALAR':
			return GLTFType.SCALAR;
		case 'VEC2':
			return GLTFType.VEC2;
		case 'VEC3':
			return GLTFType.VEC3;
		case 'VEC4':
			return GLTFType.VEC4;
		case 'MAT2':
			return GLTFType.MAT2;
		case 'MAT3':
			return GLTFType.MAT3;
		case 'MAT4':
			return GLTFType.MAT4;
		default:
			throw Error(`Unhandled glTF Type ${type}`);
	}
}

export function gltfTypeSize(componentType: GLTFComponentType, type: GLTFType) {
	let componentSize = 0;
	switch (componentType) {
		case GLTFComponentType.BYTE:
			componentSize = 1;
			break;
		case GLTFComponentType.UNSIGNED_BYTE:
			componentSize = 1;
			break;
		case GLTFComponentType.SHORT:
			componentSize = 2;
			break;
		case GLTFComponentType.UNSIGNED_SHORT:
			componentSize = 2;
			break;
		case GLTFComponentType.INT:
			componentSize = 4;
			break;
		case GLTFComponentType.UNSIGNED_INT:
			componentSize = 4;
			break;
		case GLTFComponentType.FLOAT:
			componentSize = 4;
			break;
		case GLTFComponentType.DOUBLE:
			componentSize = 8;
			break;
		default:
			throw Error('Unrecognized GLTF Component Type?');
	}
	return gltfTypeNumComponents(type) * componentSize;
}

export function gltfTypeNumComponents(type: number) {
	switch (type) {
		case GLTFType.SCALAR:
			return 1;
		case GLTFType.VEC2:
			return 2;
		case GLTFType.VEC3:
			return 3;
		case GLTFType.VEC4:
		case GLTFType.MAT2:
			return 4;
		case GLTFType.MAT3:
			return 9;
		case GLTFType.MAT4:
			return 16;
		default:
			throw Error(`Invalid glTF Type ${type}`);
	}
}

export function gltfVertexType(componentType: number, type: number): string {
	var typeStr = null;
	switch (componentType) {
		case GLTFComponentType.BYTE:
			typeStr = 'sint8';
			break;
		case GLTFComponentType.UNSIGNED_BYTE:
			typeStr = 'uint8';
			break;
		case GLTFComponentType.SHORT:
			typeStr = 'sint16';
			break;
		case GLTFComponentType.UNSIGNED_SHORT:
			typeStr = 'uint16';
			break;
		case GLTFComponentType.INT:
			typeStr = 'int32';
			break;
		case GLTFComponentType.UNSIGNED_INT:
			typeStr = 'uint32';
			break;
		case GLTFComponentType.FLOAT:
			typeStr = 'float32';
			break;
		default:
			throw Error(`Unrecognized or unsupported glTF type ${componentType}`);
	}

	switch (gltfTypeNumComponents(type)) {
		case 1:
			return typeStr;
		case 2:
			return typeStr + 'x2';
		case 3:
			return typeStr + 'x3';
		case 4:
			return typeStr + 'x4';
		default:
			throw Error(`Invalid number of components for gltfType: ${type}`);
	}
}
