uniform vec2 center;
uniform float angle;
uniform float scale;
uniform vec2 tSize;
uniform sampler2D tDiffuse;
uniform vec3 starColor;
uniform float time;
uniform sampler2D tDepth;
uniform float cameraNear;
uniform float cameraFar;
uniform float distanceToStar;
uniform float maxDistance;
varying vec2 vUv;


float unpackDepth( const in vec4 d ) {
    float f = 256.0;
    float depth = d[0] * f * f * f + d[1] * f  * f + d[2] * f + d[3];
    float max = f * f * f + f * f + f + 1.0;
    return depth/max;
}


vec4 process(float ratio) {
    vec4 c = texture2D(tDiffuse, vUv.xy);
    vec4 d = texture2D(tDepth, vUv.xy);
    vec2 sp = center;

    vec2 dis = gl_FragCoord.xy - sp;
    vec2 nom = normalize(dis);
    float sf = .5 * cos(time + 18.0 * nom.x/length(nom)) + .5 * sin(time + 6.0 * nom.y/length(nom));
    sf = max(0.0,sf);
    sf = pow(sf,4.0);
    float ld = length(dis);

    float x = ratio * (1.05 - (ld)/(tSize.y));


    float z = unpackDepth( d );
    float cameraFarMinusNear = cameraFar - cameraNear;
    float v = -cameraFar * cameraNear / ( z * cameraFarMinusNear - cameraFar );

    if ( z > 0.0 ) {
        z = 1.0;
    }

    float adjustment = min(1.0, pow(x+.1, 6.0) + sf * .35) * (1.0 - z) * ratio;

    return adjustment * vec4(starColor,1) + c;
}


void main() {

    if ( distanceToStar > maxDistance ) {
       gl_FragColor = texture2D(tDiffuse, vUv.xy);
    }
    gl_FragColor = process(1.0 - (distanceToStar/maxDistance));
}