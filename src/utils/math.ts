export function toPrincipleRangeRadians(theta: number): number {
	const mod = theta % (2 * Math.PI);
	if (mod < 0) return mod + 2 * Math.PI;
	return theta;
}
