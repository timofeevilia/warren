import"./disclose-version.xihTtKlq.js";import{A as e,B as t,D as n,F as r,G as i,H as a,K as o,M as s,N as c,O as l,P as u,S as d,U as f,V as p,b as m,c as h,g,h as _,k as v,l as y,m as b,p as x,q as ee,r as S,w as C,z as w}from"./client.ORfvZblS.js";import{n as T,t as E}from"./bodies.DvwO8Rrq.js";var D=`
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`,O=`
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;   // px, origin bottom-left
uniform float uRadius;  // px
uniform float uKind;    // 0 rocky, 1 gas, 2 star, 3 earth, 4 starfield
uniform vec3 uC1, uC2, uC3;
uniform vec3 uAtm;
uniform float uAtmPow;
uniform float uBands;
uniform float uScale;
uniform float uSpin;
uniform vec3 uAxis;     // rotation axis in view space
uniform vec3 uRing;     // inner radius, outer radius, opacity
uniform vec3 uRingColor;
uniform vec3 uLight;
uniform float uSeed;
uniform float uScroll;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 spinY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 starfield(vec2 frag) {
  vec3 col = vec3(0.0);
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float cell = 46.0 + fl * 38.0;
    // Nearer layers move more with scroll: cheap parallax.
    vec2 uv = (frag + vec2(0.0, uScroll * (30.0 + fl * 45.0))) / cell;
    vec2 id = floor(uv);
    vec3 rnd = vec3(hash(vec3(id, fl)), hash(vec3(id, fl + 7.0)), hash(vec3(id, fl + 13.0)));
    vec2 d = fract(uv) - 0.15 - 0.7 * rnd.xy;
    float size = (0.02 + 0.03 * rnd.z * rnd.z) / (1.0 + fl * 0.8);
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + rnd.x * 2.0) + rnd.y * 40.0);
    float core = smoothstep(size, 0.0, length(d));
    float star = core * core * step(0.55, rnd.z) * twinkle;
    col += star * mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.78), rnd.x);
  }
  return col;
}

void main() {
  if (uKind > 3.5) {
    vec3 s = starfield(gl_FragCoord.xy);
    gl_FragColor = vec4(s, max(s.r, max(s.g, s.b)));
    return;
  }

  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  bool star = uKind > 1.5 && uKind < 2.5;
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // Halo outside the disc. A star glows all around; a planet only on its lit side.
  if (d > 1.0) {
    float fall = star ? 2.2 : 9.0;
    float side = star ? 1.0 : smoothstep(-0.6, 0.7, dot(normalize(p), normalize(uLight.xy)));
    float halo = exp(-(d - 1.0) * fall) * uAtmPow * (star ? 0.9 : 0.55) * side;
    col = uAtm * halo;
    alpha = halo;
  }

  if (d < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - d * d));
    // Express the normal in the planet's own frame (axis = "up"), then spin it.
    vec3 u = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0)));
    vec3 v = cross(u, uAxis);
    vec3 q = spinY(vec3(dot(n, u), dot(n, uAxis), dot(n, v)), uTime * uSpin + uSeed);
    float l = dot(n, uLight);
    vec3 surf;

    if (star) {
      float g = fbm(q * uScale + vec3(0.0, uTime * 0.04, 0.0));
      float cells = fbm(q * uScale * 3.0 - vec3(uTime * 0.06));
      surf = mix(uC1, uC2, smoothstep(0.25, 0.75, g));
      surf = mix(surf, uC3, smoothstep(0.55, 0.9, cells) * 0.7);
      // Limb darkening: the edge of a star is dimmer and redder.
      col = surf * (0.45 + 0.75 * pow(n.z, 0.45));
    } else {
      if (uKind < 0.5) {
        float h = fbm(q * uScale);
        surf = mix(uC1, uC2, smoothstep(0.32, 0.62, h));
        surf = mix(surf, uC3, smoothstep(0.55, 0.8, fbm(q * uScale * 2.6 + 3.0)));
        // Cheap relief: darken where fine noise dips.
        surf *= 0.8 + 0.4 * fbm(q * uScale * 6.0 + 9.0);
      } else if (uKind < 1.5) {
        float turb = fbm(q * uScale + uSeed);
        float lat = q.y * uBands;
        float b = fbm(vec3(lat + turb * 0.9, turb * 0.35, uSeed));
        surf = mix(uC1, uC2, smoothstep(0.34, 0.66, b));
        surf = mix(surf, uC3, smoothstep(0.5, 0.82, fbm(vec3(lat * 2.3 + turb * 1.4, 1.7, uSeed + 4.0))));
      } else {
        float h = fbm(q * uScale + 2.0);
        float land = smoothstep(0.5, 0.53, h);
        vec3 ground = mix(uC2, uC3, smoothstep(0.55, 0.72, fbm(q * uScale * 2.0 + 5.0)));
        surf = mix(uC1 * (0.7 + 0.6 * h), ground, land);
        surf = mix(surf, vec3(0.92, 0.95, 1.0), smoothstep(0.78, 0.9, abs(q.y) + 0.12 * h));
        // Sun glint on the oceans only.
        vec3 hv = normalize(uLight + vec3(0.0, 0.0, 1.0));
        surf += (1.0 - land) * pow(max(dot(n, hv), 0.0), 60.0) * 0.6;
        float clouds = smoothstep(0.5, 0.72, fbm(spinY(q, uTime * 0.012) * 3.6 + 7.0));
        surf = mix(surf, vec3(1.0), clouds * 0.85);
      }
      float lit = smoothstep(-0.12, 0.65, l);
      col = surf * (lit * 1.08 + 0.012);
      // Atmosphere: light scattered at grazing angles.
      float rim = pow(1.0 - n.z, 3.0);
      col += uAtm * rim * uAtmPow * smoothstep(-0.25, 0.5, l);
    }
    float edge = smoothstep(1.0, 1.0 - 2.5 / uRadius, d);
    alpha = mix(alpha, 1.0, edge);
  }

  // Rings: intersect the view ray with the equatorial plane.
  if (uRing.z > 0.0) {
    float z = -(p.x * uAxis.x + p.y * uAxis.y) / uAxis.z;
    vec3 P = vec3(p, z);
    float r = length(P);
    bool hidden = d < 1.0 && z < sqrt(max(1.0 - d * d, 0.0));
    if (r > uRing.x && r < uRing.y && !hidden) {
      float t = (r - uRing.x) / (uRing.y - uRing.x);
      float grain = 0.5 + 0.5 * noise(vec3(r * 42.0, 0.0, uSeed));
      float gap = smoothstep(0.0, 0.035, abs(t - 0.62)); // Cassini division
      float ra = uRing.z * grain * gap * smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.93, t);
      // Shadow the planet casts on its rings.
      float bl = dot(P, uLight);
      float shadow = (bl < 0.0 && r * r - bl * bl < 1.0) ? 0.12 : 1.0;
      vec3 rc = uRingColor * (0.75 + 0.35 * grain) * shadow;
      col = col * (1.0 - ra) + rc * ra;
      alpha = alpha + ra * (1.0 - alpha);
    }
  }

  gl_FragColor = vec4(col, alpha);
}
`;function te(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,premultipliedAlpha:!0});if(!t)return null;let n=(e,n)=>{let r=t.createShader(e);if(t.shaderSource(r,n),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw Error(t.getShaderInfoLog(r)??`shader compile failed`);return r},r=t.createProgram();if(t.attachShader(r,n(t.VERTEX_SHADER,D)),t.attachShader(r,n(t.FRAGMENT_SHADER,O)),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS))throw Error(t.getProgramInfoLog(r)??`program link failed`);t.useProgram(r),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);let i=t.getAttribLocation(r,`aPos`);t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA);let a=Object.fromEntries([`uRes`,`uTime`,`uCenter`,`uRadius`,`uKind`,`uC1`,`uC2`,`uC3`,`uAtm`,`uAtmPow`,`uBands`,`uScale`,`uSpin`,`uAxis`,`uRing`,`uRingColor`,`uLight`,`uSeed`,`uScroll`].map(e=>[e,t.getUniformLocation(r,e)])),o=[-.72,.24,.65],s=Math.hypot(...o),c=1,l=0;return{resize(n,r){c=Math.min(devicePixelRatio||1,1.75),e.width=Math.round(n*c),e.height=Math.round(r*c),t.viewport(0,0,e.width,e.height)},begin(n,r){l=n,t.disable(t.SCISSOR_TEST),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.uniform2f(a.uRes,e.width,e.height),t.uniform1f(a.uTime,l),t.uniform3f(a.uLight,o[0]/s,o[1]/s,o[2]/s),t.uniform1f(a.uScroll,r),t.uniform1f(a.uKind,4),t.drawArrays(t.TRIANGLES,0,3)},planet({look:n,x:r,y:i,radius:o,seed:s}){let l=r*c,u=e.height-i*c,d=o*c,f=d*(n.ring?n.ring.outer+.1:n.kind===2?3.2:1.6);if(l+f<0||l-f>e.width||u+f<0||u-f>e.height)return;t.enable(t.SCISSOR_TEST),t.scissor(Math.floor(l-f),Math.floor(u-f),Math.ceil(f*2),Math.ceil(f*2));let p=.3;t.uniform2f(a.uCenter,l,u),t.uniform1f(a.uRadius,d),t.uniform1f(a.uKind,n.kind),t.uniform3f(a.uC1,...T(n.colors[0])),t.uniform3f(a.uC2,...T(n.colors[1])),t.uniform3f(a.uC3,...T(n.colors[2])),t.uniform3f(a.uAtm,...T(n.atmosphere)),t.uniform1f(a.uAtmPow,n.atmospherePower),t.uniform1f(a.uBands,n.bands),t.uniform1f(a.uScale,n.scale),t.uniform1f(a.uSpin,n.spin),t.uniform3f(a.uAxis,Math.sin(n.tilt)*Math.cos(p),Math.cos(n.tilt)*Math.cos(p),Math.sin(p)),t.uniform1f(a.uSeed,s),n.ring?(t.uniform3f(a.uRing,n.ring.inner,n.ring.outer,n.ring.opacity),t.uniform3f(a.uRingColor,...T(n.ring.color))):t.uniform3f(a.uRing,0,0,0),t.drawArrays(t.TRIANGLES,0,3)}}}var ne=C(`<p class="label-sm faint svelte-8z6iwk">WebGL is unavailable in this browser — showing the text version.</p>`),k=C(`<div class="svelte-8z6iwk"><dt class="label-sm muted svelte-8z6iwk"> </dt> <dd class="data-lg svelte-8z6iwk"> </dd></div>`),re=C(`<section><div class="copy svelte-8z6iwk"><p class="label-md kicker svelte-8z6iwk"> </p> <h2 class="display-xl svelte-8z6iwk"> </h2> <p class="body-lg muted blurb svelte-8z6iwk"> </p> <dl class="stats svelte-8z6iwk"></dl></div></section>`),A=C(`<button> </button>`),j=C(`<canvas class="sky svelte-8z6iwk" aria-hidden="true"></canvas> <div class="scrim svelte-8z6iwk" aria-hidden="true"></div> <header class="nav svelte-8z6iwk"><a href="/" class="label-md muted svelte-8z6iwk">← Warren</a> <span class="label-md svelte-8z6iwk">Orbita</span> <a href="/orbita/simulator/" class="label-md sim-link svelte-8z6iwk">Open simulator ◎</a></header> <section class="intro svelte-8z6iwk"><p class="label-md svelte-8z6iwk">Warren · Experiment 01</p> <h1 class="display-xl svelte-8z6iwk">Orbita</h1> <p class="body-lg muted svelte-8z6iwk">Four and a half billion kilometres, from the surface of the Sun to the last planet. Light makes
    the trip in four hours. You have a scroll wheel.</p> <p class="label-md hint svelte-8z6iwk">Scroll to launch ↓</p> <!></section> <main class="svelte-8z6iwk"></main> <section><p class="label-md svelte-8z6iwk">End of the line</p> <h2 class="display-lg svelte-8z6iwk">Now take<br class="svelte-8z6iwk"/>the controls</h2> <p class="body-lg muted svelte-8z6iwk">Eight planets, a comet and five thousand asteroids on their real orbits. Drag to look around,
    then speed time up until the years blur.</p> <a href="/orbita/simulator/" class="cta label-md svelte-8z6iwk">Open the simulator →</a></section> <nav class="rail svelte-8z6iwk" aria-label="Planets"></nav> <aside aria-live="off"><div class="svelte-8z6iwk"><span class="label-sm muted svelte-8z6iwk">From the Sun</span> <span class="data-lg svelte-8z6iwk"> <small class="svelte-8z6iwk">AU</small></span></div> <div class="svelte-8z6iwk"><span class="label-sm muted svelte-8z6iwk">Million km</span> <span class="data-lg svelte-8z6iwk"> </span></div> <div class="svelte-8z6iwk"><span class="label-sm muted svelte-8z6iwk">At light speed</span> <span class="data-lg svelte-8z6iwk"> </span></div></aside>`,1);function M(n,C){f(C,!0);let T,D,O=t(-1),M=t(0),N=t(!0),ie=p(()=>v(M)<.001?`0`:Math.round(v(M)*149597870.7/1e6).toLocaleString(`en`).replace(/,/g,` `)),ae=p(()=>{let e=v(M)*8.3167;return e<60?`${e.toFixed(1)} min`:`${Math.floor(e/60)} h ${String(Math.round(e%60)).padStart(2,`0`)} m`}),P=p(()=>E[Math.max(0,Math.min(E.length-1,v(O)))].accent);function F(e){D.children[e].scrollIntoView({behavior:`smooth`})}g(()=>{let e=matchMedia(`(prefers-reduced-motion: reduce)`).matches,t=null;try{t=te(T)}catch(e){console.error(e)}t||w(N,!1);let n=0,r=0,i=0,a=-1,o=performance.now(),s=()=>{n=innerWidth,r=innerHeight,t?.resize(n,r)},c=()=>{let e=D.offsetHeight/E.length;return(scrollY-D.offsetTop)/e},l=o,u=s=>{i=requestAnimationFrame(u);let d=Math.min((s-l)/1e3,.1);l=s;let f=c();a=e?f:a+(f-a)*(1-Math.exp(-d*5.5));let p=Math.round(f);p!==v(O)&&w(O,Math.max(-1,Math.min(E.length,p)),!0);let m=Math.max(0,Math.min(E.length-1,a)),h=Math.floor(m),g=Math.min(E.length-1,h+1),_=E[h].au+(E[g].au-E[h].au)*(m-h);if(Math.abs(_-v(M))>5e-4&&w(M,_),!t)return;let y=n<860;t.begin(e?0:(s-o)/1e3,a);for(let e=0;e<E.length;e++){let i=e-a;if(Math.abs(i)>1.6)continue;let o=E[e].look,s=o.size*r*(y?.55:1);t.planet({look:o,x:y?n*.5:n*(.69+(o.shift??0)+.09*i*i),y:(y?r*.25:r*.5)+i*r*1.05,radius:s*(1-.22*Math.min(Math.abs(i),1)),seed:e*12.9898})}};return s(),a=c(),addEventListener(`resize`,s),i=requestAnimationFrame(u),()=>{cancelAnimationFrame(i),removeEventListener(`resize`,s)}});var I=j(),L=c(I);S(L,e=>T=e,()=>T);var R=r(L,4),oe=r(s(R),4);let z;o(R);var B=r(R,2),V=s(B);let H;var se=r(V,8),ce=e=>{var t=ne();d(e,t)};_(se,e=>{v(N)||e(ce)}),o(B);var U=r(B,2);x(U,23,()=>E,e=>e.id,(t,n,i)=>{var a=re();let c,l;var f=s(a),g=s(f),_=u(g),S=r(g,2),C=u(S,!0),w=r(S,2),T=u(w,!0),D=r(w,2);x(D,21,()=>v(n).stats,b,(t,n,i)=>{var a=p(()=>ee(v(n),2));let c=()=>v(a)[0],l=()=>v(a)[1];var f=k();h(f,``,{},{"--i":i});var g=s(f),_=u(g,!0),y=r(g,2),b=u(y,!0);o(f),e(()=>{m(_,c()),m(b,l())}),d(t,f)}),o(D),o(f),o(a),e((e,t)=>{c=y(a,1,`chapter svelte-8z6iwk`,null,c,{active:v(O)===v(i)}),l=h(a,``,l,{"--accent":v(n).accent}),m(_,`${e??``} / ${t??``} — ${v(n).kind??``}`),m(C,v(n).name),m(T,v(n).blurb)},[()=>String(v(i)+1).padStart(2,`0`),()=>String(E.length).padStart(2,`0`)]),d(t,a)}),o(U),S(U,e=>D=e,()=>D);var W=r(U,2);let G;var le=s(W);let K;i(6),o(W);var q=r(W,2);x(q,23,()=>E,e=>e.id,(t,n,r)=>{var i=A();let a,o;var s=u(i,!0);e(()=>{a=y(i,1,`label-sm svelte-8z6iwk`,null,a,{current:v(O)===v(r)}),o=h(i,``,o,{"--accent":v(n).accent}),m(s,v(n).name)}),l(`click`,i,()=>F(v(r))),d(t,i)}),o(q);var J=r(q,2);let Y;var X=s(J),Z=r(s(X),2),ue=s(Z);i(),o(Z),o(X);var Q=r(X,2),de=r(s(Q),2),fe=u(de,!0);o(Q);var $=r(Q,2),pe=r(s($),2),me=u(pe,!0);o($),o(J),e(e=>{z=h(oe,``,z,{color:v(P)}),H=h(V,``,H,{color:v(P)}),G=y(W,1,`outro svelte-8z6iwk`,null,G,{active:v(O)>=E.length}),K=h(le,``,K,{color:v(P)}),Y=y(J,1,`odometer svelte-8z6iwk`,null,Y,{visible:v(O)>=0}),m(ue,`${e??``} `),m(fe,v(ie)),m(me,v(ae))},[()=>v(M).toFixed(2)]),d(n,I),a()}n([`click`]);export{M as default};