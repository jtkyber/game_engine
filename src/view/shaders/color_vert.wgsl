struct VertexInput {
    @builtin(instance_index) i_id: u32,
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texcoords: vec2f,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) world_pos: vec3f,
    @location(2) normal: vec3f,
    @location(3) texcoords: vec2f,
    @location(4) @interpolate(flat) isTerrain: u32
};

@group(0) @binding(0) var<storage, read> model_transforms: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> normal_transforms: array<mat4x4f>;
@group(0) @binding(2) var<storage, read> proj_view_transform: mat4x4f;

fn extractMat3FromMat4(m: mat4x4f) -> mat3x3f {
    return mat3x3(
        m[0].xyz,
        m[1].xyz,
        m[2].xyz
    );
}

@vertex
fn v_main(vert: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    
    var worldPos = model_transforms[vert.i_id] * vec4f(vert.position, 1.0);

    out.position = proj_view_transform * worldPos;
    out.world_pos = worldPos.xyz;
    out.normal = extractMat3FromMat4(normal_transforms[vert.i_id]) * vert.normal;
    out.texcoords = vert.texcoords;
    out.isTerrain = 0;
    return out;
}