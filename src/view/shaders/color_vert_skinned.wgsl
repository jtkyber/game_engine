struct VertexInput {
    @builtin(instance_index) i_id: u32,
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoords: vec2f,
    @location(3) joint: vec4u,
    @location(4) weight: vec4f,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) world_pos: vec4f,
    @location(2) normal: vec3f,
    @location(3) texcoords: vec2f,
};

@group(0) @binding(0) var<storage, read> model_transforms: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> normal_transforms: array<mat4x4f>;
@group(0) @binding(2) var<uniform> proj_view: array<mat4x4f, 2>;
@group(0) @binding(5) var<storage, read> lightViewProjectionMat: array<mat4x4f>;

@group(3) @binding(0) var<storage, read> jointMatrices: array<mat4x4f>;

fn extractMat3FromMat4(m: mat4x4f) -> mat3x3f {
    return mat3x3(
        m[0].xyz,
        m[1].xyz,
        m[2].xyz
    );
}

fn get_skin_matrix(weight: vec4f, joint: vec4u) -> mat4x4f {
    return mat4x4f(weight.x * jointMatrices[joint.x] + 
    weight.y * jointMatrices[joint.y] + 
    weight.z * jointMatrices[joint.z] + 
    weight.w * jointMatrices[joint.w]);
}

@vertex
fn v_main(vert: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let skinMatrix: mat4x4f = get_skin_matrix(vert.weight, vert.joint);
    
    let worldPos = model_transforms[vert.i_id] * skinMatrix * vec4f(vert.position, 1.0);

    out.position = proj_view[0] * proj_view[1] * worldPos;
    // out.position = lightViewProjectionMat[0] * worldPos;
    out.world_pos = worldPos;
    out.normal = extractMat3FromMat4(normal_transforms[vert.i_id]) * vert.normal;
    out.texcoords = vert.texcoords;
    return out;
}