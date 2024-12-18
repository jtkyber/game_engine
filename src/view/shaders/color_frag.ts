const baseColorSplat: string = /*wgsl*/ `
    var splat_color: vec4f;

    let tLength = terrainAABB.max.x - terrainAABB.min.x;
    let tWidth = terrainAABB.max.z - terrainAABB.min.z;

    let splatX = (in.world_pos.x - terrainAABB.min.x) / tLength;
    let splatY = (in.world_pos.z - terrainAABB.min.z) / tWidth;

    splat_color = textureSample(splatMapTexture, base_color_sampler, vec2f(splatX, splatY));

    var base_texture_color = vec3f(0.0, 0.0, 0.0);

    var metallic = 0.0;
    var roughness = 1.0;
    var emission = vec3f(0.0, 0.0, 0.0);

    var alpha_temp = 1.0;
    
    let hasColorTexture: bool = textureDimensions(base_color_texture).x > 1;
    let hasMetallicRoughnessTexture: bool = textureDimensions(metallic_roughness_texture).x > 1;
    let hasNormalTexture: bool = textureDimensions(normal_texture).x > 1;

    for (var i = 0; i < 4; i++) {
        let cIndex = i32(materialIndices[i]);
        if (cIndex < 0) { continue; }

        var mix_factor = splat_color[cIndex];
        if (cIndex == 3) { mix_factor = 1 - mix_factor; }

        
        var base_color_temp = textureSample(base_color_texture, base_color_sampler, in.texcoords, i);
        var metallic_roughness_temp = textureSample(metallic_roughness_texture, metallic_roughness_sampler, in.texcoords, i);
        var uv_normal  = textureSample(normal_texture, normal_sampler, in.texcoords, i).rgb;
        uv_normal  = uv_normal  * 2.0 - 1.0;
        let normal_temp = normalize(TBN * uv_normal);

        if (mix_factor > 0.001) { 
            var metallic_temp = material_params[i].metallic_factor;
            var roughness_temp = material_params[i].roughness_factor;
            var emission_temp = material_params[i].emissive_factor;
    
            if (hasColorTexture) {
                base_color_temp = material_params[i].base_color_factor * base_color_temp;
    
                base_texture_color = mix(base_texture_color, base_color_temp.rgb, mix_factor);
                alpha_temp = mix(alpha_temp, base_color_temp.a, mix_factor);
            } else {
                base_texture_color = mix(base_texture_color, material_params[i].base_color_factor.rgb, mix_factor);
                alpha_temp = mix(alpha_temp, material_params[i].base_color_factor.a, mix_factor);
            }
    
            if (hasMetallicRoughnessTexture) {
                metallic_temp *= metallic_roughness_temp.b;
                roughness_temp *= metallic_roughness_temp.g;
            } 
            
            if (hasNormalTexture) {
                N = slerp(N, normal_temp, mix_factor);
            }
    
            metallic = mix(metallic, metallic_temp, mix_factor);
            roughness = mix(roughness, roughness_temp, mix_factor);
        }

    }

    N = normalize(N);

    base_color = vec4f(base_texture_color, alpha_temp);
`;

const baseColor: string = /*wgsl*/ `
    let hasColorTexture: bool = textureDimensions(base_color_texture).x > 1;
    let hasMetallicRoughnessTexture: bool = textureDimensions(metallic_roughness_texture).x > 1;
    let hasNormalTexture: bool = textureDimensions(normal_texture).x > 1;

    let base_texture_color = textureSample(base_color_texture, base_color_sampler, in.texcoords);
    let metallic_roughness = textureSample(metallic_roughness_texture, metallic_roughness_sampler, in.texcoords);
    var uv_normal  = textureSample(normal_texture, normal_sampler, in.texcoords).rgb;
    uv_normal  = uv_normal  * 2.0 - 1.0;
    if (hasNormalTexture) { N = normalize(TBN * uv_normal ); }

    var metallic = material_params.metallic_factor;
    var roughness = material_params.roughness_factor;
    let emission = material_params.emissive_factor;

    if (hasColorTexture) {
        base_color = material_params.base_color_factor * base_texture_color;
    } else {
        base_color = material_params.base_color_factor;
    }

    if (hasMetallicRoughnessTexture) {
        metallic *= metallic_roughness.b;
        roughness *= metallic_roughness.g;
    }
`;

export const colorFragShader = (splatMap: boolean = false) => /*wgsl*/ `
    struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) world_pos: vec4f,
        @location(1) texcoords: vec2f,
        @location(2) T: vec3f,
        @location(3) B: vec3f,
        @location(4) N: vec3f,
    };

    struct MaterialParams {
        base_color_factor: vec4f,
        metallic_factor: f32,
        roughness_factor: f32,
        emissive_factor: vec3f,
    };

    struct TransformData {
        view: mat4x4f,
        projection: mat4x4f,
    };

    struct TerrainAABB {
        min: vec3f,
        max: vec3f,
    };

    @group(0) @binding(2) var<uniform> transformUBO: TransformData;
    @group(0) @binding(3) var shadowDepthTexture: texture_depth_2d_array;
    @group(0) @binding(4) var shadowDepthSampler: sampler_comparison;
    @group(0) @binding(5) var<storage, read> lightViewProjMatrix: array<mat4x4f>;
    @group(0) @binding(6) var splatMapTexture: texture_2d<f32>;
    @group(0) @binding(7) var<uniform> terrainAABB: TerrainAABB;

    @group(1) @binding(0) var<${splatMap ? 'storage, read' : 'uniform'}> material_params: ${
	splatMap ? 'array<MaterialParams>' : 'MaterialParams'
};
    @group(1) @binding(1) var base_color_sampler: sampler;
    @group(1) @binding(2) var base_color_texture: texture_2d${splatMap ? '_array' : ''}<f32>;
    @group(1) @binding(3) var metallic_roughness_sampler: sampler;
    @group(1) @binding(4) var metallic_roughness_texture: texture_2d${splatMap ? '_array' : ''}<f32>;
    @group(1) @binding(5) var normal_sampler: sampler;
    @group(1) @binding(6) var normal_texture: texture_2d${splatMap ? '_array' : ''}<f32>;
    ${splatMap ? '@group(1) @binding(7) var<uniform> materialIndices: vec4f;' : ''}

    @group(2) @binding(0) var<storage, read> lightTypes: array<f32>;
    @group(2) @binding(1) var<storage, read> lightPositions: array<vec3f>;
    @group(2) @binding(2) var<storage, read> lightColors: array<vec3f>;
    @group(2) @binding(3) var<storage, read> lightIntensities: array<f32>;
    @group(2) @binding(4) var<storage, read> lightDirections: array<vec3f>;
    @group(2) @binding(5) var<storage, read> lightAngleData: array<vec2f>; // [scale, offset]
    @group(2) @binding(6) var<uniform> cameraPosition: vec3f;
    @group(2) @binding(7) var<uniform> cascadeSplits: vec4f;

    /* lIGHT TYPES  
        0: spot
        1: directional
        2: point
    */

    const PI = 3.14159265359; 
    const lightIntensityAdjustment = 0.001;
    const cascadeCount = 3;

    @fragment
    fn f_main(in: VertexOutput) -> @location(0) vec4f {
        let TBN = mat3x3(normalize(in.T), normalize(in.B), normalize(in.N));
        var N = normalize(in.N);
        // Determine Base color -----------------------------------------------
        var base_color = vec4f(1.0, 1.0, 1.0, 1.0);
    
        ${splatMap ? baseColorSplat : baseColor}
        // N = normalize(in.N);

        var color = base_color.rgb;
        let alpha = base_color.a;

        let albedo = color;
        let V = normalize(cameraPosition - in.world_pos.xyz);
        let F0 = mix(vec3f(0.04), albedo, metallic);

        // Apply lighting ----------------------------------------------------
        var Lo = vec3f(0.0);
        for (var i: u32 = 0; i < arrayLength(&lightTypes); i++) {
            let lightType = u32(lightTypes[i]);

            // calculate radiance per light
            var L: vec3f;
            if (lightType == 1) { L = normalize(lightDirections[i]); }
            else { L = normalize(lightPositions[i] - in.world_pos.xyz); }

            let H = normalize(V + L);

            var distance: f32;
            if (lightType == 1) { distance = 1.0; }
            else { distance = length(lightPositions[i] - in.world_pos.xyz); }

            let attenuation = 1.0 / (distance * distance);

            var angularAttenuation = 1.0;
            if (lightType == 0) {
                let cd = dot(lightDirections[i], L);
                angularAttenuation = saturate(cd * lightAngleData[i].r + lightAngleData[i].g);
                angularAttenuation *= angularAttenuation;
            }
            // if (attenuation <= 0 || angularAttenuation <= 0) { continue; }

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

            // Shadows ------------------

            var index = i * 6;
            var layer: u32 = 0;
            if (lightType == 1) {
                let fragPosViewSpace = transformUBO.view * in.world_pos;
                let depthValue = abs(fragPosViewSpace.z);

                if (depthValue < cascadeSplits[0]) { layer = 0; }
                else if (depthValue < cascadeSplits[1]) { layer = 1; }
                else { layer = 2; }

                index += layer;
            }
            
            // var visibility = 1.0;
            var visibility = 0.0;
            var posLightSpace = lightViewProjMatrix[index] * in.world_pos;
            posLightSpace /= posLightSpace.w;
            var shadowPos = vec3f(posLightSpace.xy * vec2f(0.5, -0.5) + vec2f(0.5), posLightSpace.z);
            shadowPos.z = saturate(shadowPos.z);

            // let lightSpaceNormal = normalize((lightViewMatrix[index] * vec4f(in.normal, 0.0)).xyz);
            // let dz_dx = lightSpaceNormal.x / lightSpaceNormal.z;
            // let dz_dy = lightSpaceNormal.y / lightSpaceNormal.z;
            // let maxSlope = max(abs(dz_dx), abs(dz_dy));
            // let bias = maxSlope * 0.0008 + 0.0005;
            // var bias = tan(acos(dot(in.N, lightDirections[i])));
            // bias *= 0.00029;

            // let bias = max(0.0025 * (1.0 - dot(N, lightDirections[i])), 0.001);
            let bias = max(0.003 * (1.0 - dot(in.N, lightDirections[i])), 0.0002);

            let oneOverShadowDepthTextureSize = 1.0 / 1024.0;
            for (var y = -1; y <= 1; y++) {
                for (var x = -1; x <= 1; x++) {
                    let offset = vec2f(vec2(x, y)) * oneOverShadowDepthTextureSize;

                    visibility += textureSampleCompare(
                        shadowDepthTexture, shadowDepthSampler,
                        shadowPos.xy + offset, index, shadowPos.z + bias
                    );
                }
            }

            visibility /= 9.0;
            if (shadowPos.x < 0.0 || shadowPos.x > 1.0 || shadowPos.y < 0.0 || shadowPos.y > 1.0) {
                visibility = 1.0;
            }

            // --------------------------


            // Accumulate radiance Lo
            let NdotL = max(dot(N, L), 0.0);
            Lo += (kD * albedo / PI + specular) * radiance * NdotL * visibility;
        }

        // let ambient = vec3f(0.03) * albedo;
        let ambient = vec3f(0.08) * albedo;
        color = ambient + Lo;
        color += emission;
        color = color / (color + vec3f(1.0));
        // color = pow(color, vec3f(1.0 / 2.2));
        color[0] = linear_to_srgb(color[0]);
        color[1] = linear_to_srgb(color[1]);
        color[2] = linear_to_srgb(color[2]);

        return vec4f(color, alpha);
        // return vec4f(normalize(in.T) * 0.5 + 0.5, 1.0);
        // return vec4f(N * 0.5 + 0.5, 1.0);
        // return vec4f(uv_normal * 0.5 + 0.5, 1.0);
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

    fn slerp(n1: vec3f, n2: vec3f, factor: f32) -> vec3f {
        let dotProduct = clamp(dot(n1, n2), -1.0, 1.0);
        let theta = acos(dotProduct) * factor;
        let relativeVec = normalize(n2 - n1 * dotProduct);
        return normalize(n1 * cos(theta) + relativeVec * sin(theta));
    }
`;
