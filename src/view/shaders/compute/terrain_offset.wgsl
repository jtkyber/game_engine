@group(0) @binding(0) var<storage, read> terrain_positions : array<vec3f>;
@group(0) @binding(1) var<uniform> node_positions : array<vec3f>;
@group(0) @binding(2) var<storage, read_write> terrain_height_offsets : array<f32>;

@compute @workgroup_size(128, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let pX = node_position[0];
    let pY = node_position[1];
    let pZ = node_position[2];

    for (var i: u32 = 0; i < arrayLength(&terrain_positions); i++) {
        let nX = terrain_positions[i][0];
        let nY = terrain_positions[i][1];
        let nZ = terrain_positions[i][2];

        if (pX == nX && pZ == nZ) {
            let offset = nY - pY;
            terrain_height_offset = offset;
        }
    }
}