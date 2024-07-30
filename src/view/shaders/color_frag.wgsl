struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) world_pos: vec3f,
    @location(2) normal: vec3f,
    @location(3) texcoords: vec2f,
};

struct MaterialParams {
    base_color_factor: vec4f,
    metallic_factor: f32,
    roughness_factor: f32,
};

@group(1) @binding(0) var<uniform> material_params: MaterialParams;
@group(1) @binding(1) var base_color_sampler: sampler;
@group(1) @binding(2) var base_color_texture: texture_2d<f32>;
@group(1) @binding(3) var metallic_roughness_sampler: sampler;
@group(1) @binding(4) var metallic_roughness_texture: texture_2d<f32>;

@group(2) @binding(0) var<storage, read> lightTypes: array<u32>;
@group(2) @binding(1) var<storage, read> lightPositions: array<vec3f>;
@group(2) @binding(2) var<storage, read> lightColors: array<vec3f>;
@group(2) @binding(3) var<storage, read> lightIntensities: array<f32>;
@group(2) @binding(4) var<storage, read> lightDirections: array<vec3f>;
@group(2) @binding(5) var<storage, read> lightAngleScales: array<f32>;
@group(2) @binding(6) var<storage, read> lightAngleOffsets: array<f32>;
@group(2) @binding(7) var<storage, read> lightViewProj: array<mat4x4f>;

fn linear_to_srgb(x: f32) -> f32 {
    if (x <= 0.0031308) {
        return 12.92 * x;
    }
    return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

const ambient = 0.2;

@fragment
fn f_main(in: VertexOutput) -> @location(0) vec4f {
    // Determine Base color -----------------------------------------------

    let colorTextureDimensions: vec2u = textureDimensions(base_color_texture);
    let hasColorTexture: bool = colorTextureDimensions.x > 1;

    let metallicRoughnessTextureDimensions: vec2u = textureDimensions(metallic_roughness_texture);
    let hasMetallicRoughnessTexture: bool = metallicRoughnessTextureDimensions.x > 1;

    let base_texture_color = textureSample(base_color_texture, base_color_sampler, in.texcoords);
    let metallic_roughness = textureSample(metallic_roughness_texture, metallic_roughness_sampler, in.texcoords);

    var base_color = vec4f(1.0, 1.0, 1.0, 1.0);
    if (hasColorTexture) {
        base_color = material_params.base_color_factor * base_texture_color;
        base_color.r = linear_to_srgb(base_color.r);
        base_color.g = linear_to_srgb(base_color.g);
        base_color.b = linear_to_srgb(base_color.b);
        base_color.a = base_color.a;
    } else {
        base_color.r = linear_to_srgb(material_params.base_color_factor.r);
        base_color.g = linear_to_srgb(material_params.base_color_factor.g);
        base_color.b = linear_to_srgb(material_params.base_color_factor.b);
        base_color.a = material_params.base_color_factor.a;
    }

    var color = base_color.rgb * ambient;
    let alpha = base_color.a;

    // Apply lighting ----------------------------------------------------

    for (var i: u32 = 0; i < arrayLength(&lightTypes); i++) {
        let lightDist = abs(distance(lightPositions[i], in.world_pos));

        color += (0.2 / lightDist);
    }
    return vec4f(color, alpha);
}