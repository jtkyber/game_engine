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

fn linear_to_srgb(x: f32) -> f32 {
    if (x <= 0.0031308) {
        return 12.92 * x;
    }
    return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

@fragment
fn f_main(in: VertexOutput) -> @location(0) vec4f {
    let colorTextureDimensions: vec2u = textureDimensions(base_color_texture);
    let hasColorTexture: bool = colorTextureDimensions.x > 1;

    let metallicRoughnessTextureDimensions: vec2u = textureDimensions(metallic_roughness_texture);
    let hasMetallicRoughnessTexture: bool = metallicRoughnessTextureDimensions.x > 1;

    let base_color = textureSample(base_color_texture, base_color_sampler, in.texcoords);
    let metallic_roughness = textureSample(metallic_roughness_texture, metallic_roughness_sampler, in.texcoords);

    var color = vec4f(1.0, 1.0, 1.0, 1.0);
    if (hasColorTexture) {
        color = material_params.base_color_factor * base_color;
        color.r = linear_to_srgb(color.r);
        color.g = linear_to_srgb(color.g);
        color.b = linear_to_srgb(color.b);
        color.a = color.a;
    } else {
        color.r = linear_to_srgb(material_params.base_color_factor.r);
        color.g = linear_to_srgb(material_params.base_color_factor.g);
        color.b = linear_to_srgb(material_params.base_color_factor.b);
        color.a = material_params.base_color_factor.a;

        // color = vec4f((in.normal + 1.0) * 0.5, 1.0); // Remove later
        // color.r = linear_to_srgb(color.r);
        // color.g = linear_to_srgb(color.g);
        // color.b = linear_to_srgb(color.b);
        // color.a = 1.0;
    }
    return color;
}