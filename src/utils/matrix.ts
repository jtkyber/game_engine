import { Mat4, Quat, Vec3, mat4, quat, vec3 } from 'wgpu-matrix';

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

export function getRotation(mat: Mat4, out?: Quat) {
	if (!out) out = quat.create();

	let scaling = vec3.create();
	vec3.getScaling(mat, scaling);

	let is1 = 1 / scaling[0];
	let is2 = 1 / scaling[1];
	let is3 = 1 / scaling[2];

	let sm11 = mat[0] * is1;
	let sm12 = mat[1] * is2;
	let sm13 = mat[2] * is3;
	let sm21 = mat[4] * is1;
	let sm22 = mat[5] * is2;
	let sm23 = mat[6] * is3;
	let sm31 = mat[8] * is1;
	let sm32 = mat[9] * is2;
	let sm33 = mat[10] * is3;

	let trace = sm11 + sm22 + sm33;
	let S = 0;

	if (trace > 0) {
		S = Math.sqrt(trace + 1.0) * 2;
		out[3] = 0.25 * S;
		out[0] = (sm23 - sm32) / S;
		out[1] = (sm31 - sm13) / S;
		out[2] = (sm12 - sm21) / S;
	} else if (sm11 > sm22 && sm11 > sm33) {
		S = Math.sqrt(1.0 + sm11 - sm22 - sm33) * 2;
		out[3] = (sm23 - sm32) / S;
		out[0] = 0.25 * S;
		out[1] = (sm12 + sm21) / S;
		out[2] = (sm31 + sm13) / S;
	} else if (sm22 > sm33) {
		S = Math.sqrt(1.0 + sm22 - sm11 - sm33) * 2;
		out[3] = (sm31 - sm13) / S;
		out[0] = (sm12 + sm21) / S;
		out[1] = 0.25 * S;
		out[2] = (sm23 + sm32) / S;
	} else {
		S = Math.sqrt(1.0 + sm33 - sm11 - sm22) * 2;
		out[3] = (sm12 - sm21) / S;
		out[0] = (sm31 + sm13) / S;
		out[1] = (sm23 + sm32) / S;
		out[2] = 0.25 * S;
	}

	return out;
}

export function zUpTransformation(): Mat4 {
	return mat4.create(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
}

export function transformPosition(
	vertex: Float32Array | number[],
	modelTransform: Float32Array
): Float32Array {
	const v1: number = vertex[0];
	const v2: number = vertex[1];
	const v3: number = vertex[2];
	const v4: number = 1;

	const m1_1: number = modelTransform[0];
	const m1_2: number = modelTransform[1];
	const m1_3: number = modelTransform[2];
	// const m1_4: number = modelTransform[3];
	const m2_1: number = modelTransform[4];
	const m2_2: number = modelTransform[5];
	const m2_3: number = modelTransform[6];
	// const m2_4: number = modelTransform[7];
	const m3_1: number = modelTransform[8];
	const m3_2: number = modelTransform[9];
	const m3_3: number = modelTransform[10];
	// const m3_4: number = modelTransform[11];
	const m4_1: number = modelTransform[12];
	const m4_2: number = modelTransform[13];
	const m4_3: number = modelTransform[14];
	// const m4_4: number = modelTransform[15];

	const col1: number = v1 * m1_1 + v2 * m2_1 + v3 * m3_1 + v4 * m4_1;
	const col2: number = v1 * m1_2 + v2 * m2_2 + v3 * m3_2 + v4 * m4_2;
	const col3: number = v1 * m1_3 + v2 * m2_3 + v3 * m3_3 + v4 * m4_3;

	return new Float32Array([col1, col2, col3]);
}
