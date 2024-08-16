struct VertexInput {
    @location(0) position: vec3f,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
};

@group(0) @binding(0) var<uniform> proj_view: array<mat4x4f, 2>;

@vertex
fn v_main(vert: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = proj_view[0] * proj_view[1] * vec4f(vert.position, 1.0);
    return out;
}

@fragment
fn f_main(in: VertexOutput) -> @location(0) vec4f {
    return vec4f(0.0, 1.0, 1.0, 0.01);
}