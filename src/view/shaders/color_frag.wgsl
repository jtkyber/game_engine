struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(1) world_pos: vec3f,
    @location(2) normal: vec3f,
    @location(3) texcoords: vec2f,
    @location(4) @interpolate(flat) isTerrain: u32,
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

@group(2) @binding(0) var<storage, read> lightTypes: array<f32>;
@group(2) @binding(1) var<storage, read> lightPositions: array<vec3f>;
@group(2) @binding(2) var<storage, read> lightColors: array<vec3f>;
@group(2) @binding(3) var<storage, read> lightIntensities: array<f32>;
@group(2) @binding(4) var<storage, read> lightDirections: array<vec3f>;
@group(2) @binding(5) var<storage, read> lightAngleScales: array<f32>;
@group(2) @binding(6) var<storage, read> lightAngleOffsets: array<f32>;
@group(2) @binding(7) var<storage, read> lightViewProj: array<mat4x4f>;
@group(2) @binding(8) var<uniform> cameraPosition: vec3f;

/* lIGHT TYPES  
    0: spot
    1: directional
    2: point
*/

const PI = 3.14159265359; 
const lightIntensityAdjustment = 0.001;

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
    var metallic = material_params.metallic_factor;
    var roughness = material_params.roughness_factor;
    // Check metallic and roughtness 

    if (hasColorTexture) {
        base_color = material_params.base_color_factor * base_texture_color;

        metallic *= metallic_roughness.b;
        roughness *= metallic_roughness.g;
    } else {
        base_color = material_params.base_color_factor;
    }

    var color = base_color.rgb;
    let alpha = base_color.a;

    // if (in.isTerrain == 1) {
    //     color = mix(vec3f(0.107, 0.091, 0.051), vec3f(in.world_pos[1] * in.world_pos[1] * 0.0005), 0.2);
    // }

    let N = normalize(in.normal);
    let V = normalize(cameraPosition - in.world_pos);
    let albedo = color;
    let F0 = mix(vec3f(0.04), albedo, metallic);

    // Apply lighting ----------------------------------------------------
    var Lo = vec3f(0.0);
    for (var i: u32 = 0; i < arrayLength(&lightTypes); i++) {
        let lightType = u32(lightTypes[i]);

        // calculate radiance per light
        var L: vec3f;
        if (lightType == 1) { L = normalize(lightDirections[i]); }
        else { L = normalize(lightPositions[i] - in.world_pos); }

        let H = normalize(V + L);

        var distance: f32;
        if (lightType == 1) { distance = 1.0; }
        else { distance = length(lightPositions[i] - in.world_pos); }

        let attenuation = 1.0 / (distance * distance);

        var angularAttenuation = 1.0;
        if (lightType == 0) {
            let cd = dot(lightDirections[i], L);
            angularAttenuation = saturate(cd * lightAngleScales[i] + lightAngleOffsets[i]);
            angularAttenuation *= angularAttenuation;
        }
        if (attenuation <= 0 || angularAttenuation <= 0) { continue; }

        let radiance = lightColors[i] * lightIntensities[i] * attenuation * angularAttenuation * lightIntensityAdjustment;

        // cook-torrance brdf
        let NDF = distributionGGX(N, H, roughness);
        let G = geometrySmith(N, V, L, roughness);
        let F = fresnelSchlick(max(dot(H, V), 0.0), F0);

        let kS = F;
        var kD = vec3f(1.0) - kS;
        kD *= 1.0 - metallic;

        let numerator = NDF * G * F;
        let denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
        let specular = numerator / denominator;

        // Accumulate radiance Lo
        let NdotL = max(dot(N, L), 0.0);
        Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    }

    let ambient = vec3f(0.03) * albedo;
    color = ambient + Lo;
    // color = color / (color + vec3f(1.0));
    // color = pow(color, vec3f(1.0 / 2.2));
    color[0] = linear_to_srgb(color[0]);
    color[1] = linear_to_srgb(color[1]);
    color[2] = linear_to_srgb(color[2]);

    return vec4f(color, alpha);
}

fn linear_to_srgb(x: f32) -> f32 {
    if (x <= 0.0031308) {
        return 12.92 * x;
    }
    return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

fn fresnelSchlick(cosTheta: f32, F0: vec3f) -> vec3f {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

fn distributionGGX(N: vec3f, H: vec3f, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let NdotH = max(dot(N, H), 0.0);
    let NdotH2 = NdotH * NdotH;

    let num = a2;
    var denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return num / denom;
}

fn geometrySchlickGGX(NdotV: f32, roughness: f32) -> f32 {
    let r: f32 = roughness + 1.0;
    let k: f32 = (r * r) / 8.0;

    let num: f32   = NdotV;
    let denom: f32 = NdotV * (1.0 - k) + k;
	
    return num / denom;
}

fn geometrySmith(N: vec3f, V: vec3f, L: vec3f, roughness: f32) -> f32 {
    let NdotV: f32 = max(dot(N, V), 0.0);
    let NdotL: f32 = max(dot(N, L), 0.0);
    let ggx2: f32  = geometrySchlickGGX(NdotV, roughness);
    let ggx1: f32  = geometrySchlickGGX(NdotL, roughness);
	
    return ggx1 * ggx2;
}