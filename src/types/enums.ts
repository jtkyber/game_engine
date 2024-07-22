export enum GLTFType {
	SCALAR = 0,
	VEC2 = 1,
	VEC3 = 2,
	VEC4 = 3,
	MAT2 = 4,
	MAT3 = 5,
	MAT4 = 6,
}

export enum GLTFComponentType {
	BYTE = 5120,
	UNSIGNED_BYTE = 5121,
	SHORT = 5122,
	UNSIGNED_SHORT = 5123,
	INT = 5124,
	UNSIGNED_INT = 5125,
	FLOAT = 5126,
	DOUBLE = 5130,
}

export enum GLTFRenderMode {
	POINTS = 0,
	LINE = 1,
	LINE_LOOP = 2,
	LINE_STRIP = 3,
	TRIANGLES = 4,
	TRIANGLE_STRIP = 5,
	// Note: fans are not supported in WebGPU, use should be
	// an error or converted into a list/strip
	TRIANGLE_FAN = 6,
}

export enum GLTFTextureFilter {
	NEAREST = 9728,
	LINEAR = 9729,
	NEAREST_MIPMAP_NEAREST = 9984,
	LINEAR_MIPMAP_NEAREST = 9985,
	NEAREST_MIPMAP_LINEAR = 9986,
	LINEAR_MIPMAP_LINEAR = 9987,
}

export enum GLTFTextureWrap {
	REPEAT = 10497,
	CLAMP_TO_EDGE = 33071,
	MIRRORED_REPEAT = 33648,
}

export enum ImageUsage {
	BASE_COLOR,
	METALLIC_ROUGHNESS,
	NORMAL,
	OCCLUSION,
	EMISSION,
}

export enum moveableFlag {
	STATIC,
	MOVEABLE_ROOT,
}

export enum GLTFAnimationInterpolation {
	LINEAR,
	STEP,
	CUBICSPLINE,
}

export enum GLTFAnimationPath {
	TRANSLATION,
	ROTATION,
	SCALE,
	WEIGHTS,
}
