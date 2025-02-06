import { Quat, vec3, Vec3 } from 'wgpu-matrix';

export function toPrincipleRangeRadians(theta: number): number {
	const mod = theta % (2 * Math.PI);
	if (mod < 0) return mod + 2 * Math.PI;
	return theta;
}

export function bilinearInterpolation(
	x: number,
	y: number,
	topLeft: Vec3,
	topRight: Vec3,
	bottomLeft: Vec3,
	bottomRight: Vec3
): number {
	// Calculate the weights for interpolation
	const x1 = topLeft[0];
	const x2 = topRight[0];
	const y1 = topLeft[1];
	const y2 = bottomLeft[1];

	const q11 = topLeft[2];
	const q21 = topRight[2];
	const q12 = bottomLeft[2];
	const q22 = bottomRight[2];

	const r1 = ((x2 - x) / (x2 - x1)) * q11 + ((x - x1) / (x2 - x1)) * q21;
	const r2 = ((x2 - x) / (x2 - x1)) * q12 + ((x - x1) / (x2 - x1)) * q22;

	const z = ((y2 - y) / (y2 - y1)) * r1 + ((y - y1) / (y2 - y1)) * r2;

	return z;
}

export function normalFromTriangle(v1: Vec3, v2: Vec3, v3: Vec3): Vec3 {
	// Calculate vectors from v1 to v2 and v1 to v3
	const va = vec3.sub(vec3.create(), v2, v1); // va = v2 - v1
	const vb = vec3.sub(vec3.create(), v3, v1); // vb = v3 - v1

	// Compute the cross product of va and vb
	const normal = vec3.cross(vec3.create(), va, vb);

	// Normalize the resulting vector
	return vec3.normalize(vec3.create(), normal);
}

export function quatToEuler(q: Quat): Vec3 {
	const [qw, qx, qy, qz] = q;

	// Calculate yaw (ψ) around Z-axis
	const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));

	// Calculate pitch (θ) around Y-axis
	// Here, we use asin for pitch to handle the singularity at ±90 degrees
	let pitch = Math.asin(2 * (qw * qy - qz * qx));
	if (pitch > Math.PI / 2) pitch = Math.PI - pitch; // handle the case where pitch is above 90 degrees
	if (pitch < -Math.PI / 2) pitch = -Math.PI - pitch; // handle the case where pitch is below -90 degrees

	// Calculate roll (φ) around X-axis
	const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));

	return vec3.create(yaw, pitch, roll); // return in radians, adjust for degrees if needed
}
