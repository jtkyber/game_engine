@group(0) @binding(0) var<storage, read> model_transforms: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> light_view_proj: array<mat4x4f>;

struct Input {
    @builtin(instance_index) idx: u32,
    @location(0) vertexPosition: vec3f,
};

@vertex
fn vs_main(in: Input) -> @builtin(position) vec4f {
    let obj_id = in.idx & 0xFFFF;
    let light_id = (in.idx >> 16) & 0xFFFF;
    let vertWorldPos = model_transforms[obj_id] * vec4f(in.vertexPosition, 1.0);
    return light_view_proj[light_id] * vertWorldPos;
}