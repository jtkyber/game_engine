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
};

struct MaterialParams {
    base_color_factor: vec4f,
    metallic_factor: f32,
    roughness_factor: f32,
};

@group(0) @binding(0) var<storage, read> model_transforms: array<mat4x4f>;
@group(0) @binding(1) var<storage, read> normal_transforms: array<mat4x4f>;
@group(0) @binding(2) var<storage, read> proj_view_transform: mat4x4f;

@group(1) @binding(0) var<uniform> material_params: MaterialParams;
@group(1) @binding(1) var base_color_sampler: sampler;
@group(1) @binding(2) var base_color_texture: texture_2d<f32>;
@group(1) @binding(3) var metallic_roughness_sampler: sampler;
@group(1) @binding(4) var metallic_roughness_texture: texture_2d<f32>;

fn extractMat3FromMat4(m: mat4x4f) -> mat3x3f {
    return mat3x3(
        m[0].xyz,
        m[1].xyz,
        m[2].xyz
    );
}

fn linear_to_srgb(x: f32) -> f32 {
    if (x <= 0.0031308) {
        return 12.92 * x;
    }
    return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

@vertex
fn v_main(vert: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = proj_view_transform * model_transforms[vert.i_id] * vec4f(vert.position, 1.0);
    out.world_pos = vert.position.xyz;
    out.normal = extractMat3FromMat4(normal_transforms[vert.i_id]) * vert.normal;
    out.texcoords = vert.texcoords;
    return out;
};

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
    }
    return color;
}