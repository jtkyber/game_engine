struct Camera {
    forwards: vec3f,
    right: vec3f,
    up: vec3f
}

@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var skyboxTexture: texture_cube<f32>;
@group(0) @binding(2) var skyboxSampler: sampler;
@group(0) @binding(3) var<uniform> sunAboveHorizon: f32;

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

const skyColor = vec3f(0.42, 0.65, 1.0);

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
    if (sunAboveHorizon >= 1.0) { return vec4f(skyColor, 1.0); }

    let texSample = textureSample(skyboxTexture, skyboxSampler, direction);
    var lerpValue = saturate(sunAboveHorizon + 0.2);
    lerpValue /= 0.2;
    let finalColor = mix(texSample.xyz, skyColor, saturate(lerpValue));
    return vec4f(finalColor, 1.0);
}