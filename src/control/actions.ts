import { quat, Quat, vec3, Vec3 } from 'wgpu-matrix';
import GLTFNode from '../view/gltf/node';

export default class Actions {
	constructor() {}

	swim(node: GLTFNode) {
		if (vec3.distance(node.position, node.targetPosition) < 0.5) {
			// Find new random location within radius
			const theta: number = 2 * Math.PI * Math.random();

			const r: number = node.maxRadius * Math.sqrt(Math.random());

			let x: number = r * Math.cos(theta);
			let y: number = r * Math.sin(theta);

			x += node.initialPosition[0];
			y += node.initialPosition[2];

			node.targetPosition = vec3.fromValues(x, node.position[1], y);
		}

		const targetDirection: Vec3 = vec3.normalize(vec3.sub(node.targetPosition, node.position));

		node.spin_lerp(targetDirection);

		// const angleToTarget: number = vec3.angle(node.forward, targetDirection);
		// const newDistFromTarget: number = vec3.distance(node.position, node.targetPosition);
		// const speedMult: number =
		// 	newDistFromTarget > 4 && angleToTarget > 2.9
		// 		? Math.min(Math.max(Math.sqrt(newDistFromTarget), 1), 2)
		// 		: 1;

		node.move_forward();
	}
}
