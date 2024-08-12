struct Camera {
    forwards: vec3f,
    right: vec3f,
    up: vec3f
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var skyboxTexture: texture_cube<f32>;
@group(0) @binding(2) var skyboxSampler: sampler;

struct VertexOutput {
    @builtin(position) Position: vec4f,
    @location(0) direction: vec3f
}

const positions = array<vec2f, 6> (
    vec2f(1.0, 1.0),
    vec2f(1.0, -1.0),
    vec2f(-1.0, -1.0),
    vec2f(1.0, 1.0),
    vec2f(-1.0, -1.0),
    vec2f(-1.0, 1.0)
);

@vertex
fn v_main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var output: VertexOutput;
    output.Position = vec4f(positions[vertexIndex], 0.0, 1.0);
    let x: f32 = positions[vertexIndex].x;
    let y: f32 = positions[vertexIndex].y;

    output.direction = normalize(camera.forwards + x * camera.right + y * camera.up);
    output.direction[0] *= -1.0;
    return output;
}

@fragment
fn f_main(@location(0) direction: vec3f) -> @location(0) vec4f {
    return textureSample(skyboxTexture, skyboxSampler, direction);
}