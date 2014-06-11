uniform sampler2D tDiffuse;
uniform vec3 triggerColor;
uniform vec3 bloomColor;
uniform vec3 kernel[ KERNEL_SIZE_INT ];
uniform float tWidth;
uniform vec2 tSize;

varying vec2 vUv;

void main() {

    vec4 d = vec4(0.0,0.0,0.0,1.0);

    vec4 c = texture2D(tDiffuse, vUv.xy);

    int i;

    float z = 0.0;

    for( int i = 0; i < KERNEL_SIZE_INT; i++ ) {
        vec3 p = kernel[i];
        p.x /= tSize.x;
        p.y /= tSize.y;
        vec2 xy = vUv.xy + p.xy;
        if ( xy.x >= z && xy.x < tSize.x &&  xy.y >= z && xy.y < tSize.y ) {
            float dp = dot(texture2D(tDiffuse, xy).xyz, triggerColor);
            if ( dp > .98 ) {
                d += vec4(bloomColor, 1) * dp * p.z;
            }
        }
    }

    gl_FragColor = c + d;

}