@group(0) @binding(0) var<storage, read> inverseBindMatrices : array<mat4x4f>;
@group(0) @binding(1) var<storage, read> inverseGlobalTransform : mat4x4f;
@group(0) @binding(2) var<storage, read> globalJointTransforms : array<mat4x4f>;
@group(0) @binding(3) var<storage, read_write> jointMatrices : array<mat4x4f>;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    for (var i: u32 = 0; i < arrayLength(&inverseBindMatrices); i++) {
        jointMatrices[i] = globalJointTransforms[i] * inverseBindMatrices[i];
    }
}