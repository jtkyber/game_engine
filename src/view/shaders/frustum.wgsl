struct TransformData {
    view: mat4x4f,
    projection: mat4x4f,
};

struct VertIn {
    @builtin(vertex_index) v_id: u32,
    @builtin(instance_index) i_id: u32
}

@group(0) @binding(0) var<storage, read> inverseLightViewProjectionMat: array<mat4x4f>;
@group(0) @binding(1) var<uniform> transformUBO: TransformData;

@vertex
fn v_main(in: VertIn) -> @builtin(position) vec4f {
     let vertices = array<vec3f, 24> (
        vec3f(-1, 1, 0), vec3f(1, 1, 0),

        vec3f(1, 1, 0), vec3f(1, -1, 0),

        vec3f(1, -1, 0), vec3f(-1, -1, 0),

        vec3f(-1, -1, 0), vec3f(-1, 1, 0),


        vec3f(-1, 1, 1), vec3f(1, 1, 1),

        vec3f(1, 1, 1), vec3f(1, -1, 1),

        vec3f(1, -1, 1), vec3f(-1, -1, 1),

        vec3f(-1, -1, 1), vec3f(-1, 1, 1),


        vec3f(-1, 1, 0), vec3f(-1, 1, 1),

        vec3f(1, 1, 0), vec3f(1, 1, 1),

        vec3f(-1, -1, 0), vec3f(-1, -1, 1),

        vec3f(1, -1, 0), vec3f(1, -1, 1),
    );

    var worldPos = inverseLightViewProjectionMat[in.i_id] * vec4f(vertices[in.v_id], 1.0);
    worldPos /= worldPos.w;
    let pos = transformUBO.projection * transformUBO.view * worldPos;

    return pos;
}

@fragment
fn f_main() -> @location(0) vec4f {
    return vec4f(0.0, 1.0, 0.0, 1.0);
}