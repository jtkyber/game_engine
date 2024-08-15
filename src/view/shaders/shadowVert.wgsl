@group(0) @binding(0) var<storage, read> modelMat: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> lightViewProjectionMat: array<mat4x4f>;

struct Input {
    @builtin(instance_index) idx: u32,
    @location(0) vertexPosition: vec3f,
};

@vertex
fn vs_main(in: Input) -> @builtin(position) vec4f {
    let obj_id = in.idx & 0xFFFF;
    let light_id = (in.idx >> 16) & 0xFFFF;
    let vertWorldPos = modelMat[obj_id] * vec4f(in.vertexPosition, 1.0);
    return lightViewProjectionMat[light_id] * vertWorldPos;
}