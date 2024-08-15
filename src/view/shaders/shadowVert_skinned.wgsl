@group(0) @binding(0) var<storage, read> modelMat: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> lightViewProjectionMat: array<mat4x4f>;

@group(1) @binding(0) var<storage, read> jointMatrices: array<mat4x4f>;

struct Input {
    @builtin(instance_index) idx: u32,
    @location(0) vertexPosition: vec3f,
    @location(1) joint: vec4u,
    @location(2) weight: vec4f,
};

fn get_skin_matrix(weight: vec4f, joint: vec4u) -> mat4x4f {
    return mat4x4f(weight.x * jointMatrices[joint.x] + 
    weight.y * jointMatrices[joint.y] + 
    weight.z * jointMatrices[joint.z] + 
    weight.w * jointMatrices[joint.w]);
}

@vertex
fn vs_main(vert: Input) -> @builtin(position) vec4f {
    let skinMatrix: mat4x4f = get_skin_matrix(vert.weight, vert.joint);

    let obj_id = vert.idx & 0xFFFF;
    let light_id = (vert.idx >> 16) & 0xFFFF;
    let vertWorldPos = modelMat[obj_id] * skinMatrix * vec4f(vert.vertexPosition, 1.0);
    return lightViewProjectionMat[light_id] * vertWorldPos;
}