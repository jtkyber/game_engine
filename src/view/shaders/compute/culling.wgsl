struct TransformData {
    view: mat4x4f,
    projection: mat4x4f,
};

struct AABB {
    min: vec3f,
    max: vec3f,
}

@group(0) @binding(0) var<uniform> transformUBO: TransformData;
@group(0) @binding(1) var<storage, read> aabbs: array<AABB>;
@group(0) @binding(2) var<storage, read_write> result: array<f32>;

const offset = 0.0;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    for (var i: u32 = 0; i < arrayLength(&aabbs); i++) {
        let min = aabbs[i].min;
        let max = aabbs[i].max;

        var corners: array<vec3f, 8>;
        corners[0] = vec3f(min[0], min[1], min[2]);
        corners[1] = vec3f(max[0], min[1], min[2]);
        corners[2] = vec3f(max[0], max[1], min[2]);
        corners[3] = vec3f(min[0], max[1], min[2]);
        corners[4] = vec3f(min[0], min[1], max[2]);
        corners[5] = vec3f(max[0], min[1], max[2]);
        corners[6] = vec3f(max[0], max[1], max[2]);
        corners[7] = vec3f(min[0], max[1], max[2]);

        var pos: array<vec4f, 8>;
        pos[0] = transformUBO.projection * transformUBO.view * vec4f(corners[0], 1.0);
        pos[1] = transformUBO.projection * transformUBO.view * vec4f(corners[1], 1.0);
        pos[2] = transformUBO.projection * transformUBO.view * vec4f(corners[2], 1.0);
        pos[3] = transformUBO.projection * transformUBO.view * vec4f(corners[3], 1.0);
        pos[4] = transformUBO.projection * transformUBO.view * vec4f(corners[4], 1.0);
        pos[5] = transformUBO.projection * transformUBO.view * vec4f(corners[5], 1.0);
        pos[6] = transformUBO.projection * transformUBO.view * vec4f(corners[6], 1.0);
        pos[7] = transformUBO.projection * transformUBO.view * vec4f(corners[7], 1.0);

        var inFrame: bool = false;
        for (var p: u32 = 0; p < 5; p++) {
            inFrame = false;

            for (var j: u32 = 0; j < 8; j++) {
                switch p {
                    case 0: {
                        // Left Plane
                        if (pos[j].x >= -pos[j].w - offset) { inFrame = true; }
                    }
                    case 1: {
                        // Right Plane
                        if (pos[j].x <= pos[j].w + offset) { inFrame = true; }
                    }
                    case 2: {
                        // Top Plane
                        if (pos[j].y <= pos[j].w + offset) { inFrame = true; }
                    }
                    case 3: {
                        // Bottom Plane
                        if (pos[j].y >= -pos[j].w - offset) { inFrame = true; }
                    }
                    default {
                        // Near Plane
                        if (pos[j].w > 0.0) { inFrame = true; }
                    }
                }
            }

            if (!inFrame) { break; }
        }

        if (inFrame) { result[i] = 1.0; }
        else { result[i] = 0.0; }
    }
}