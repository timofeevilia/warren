import{C as e,D as t,E as n,S as r,_ as i,a,b as o,f as s,l as c,n as l,o as u,p as d,r as f,w as p}from"./web.CbfWUlI9.js";import{c as m,l as h,n as g,o as _,r as v,s as y,t as b,u as x}from"./data.B0cFxQ7-.js";var S=`
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`,C=`
precision highp float;

uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform mat3 uRot;     // view space -> geographic space
uniform vec3 uSun;     // direction to the Sun, geographic space
uniform sampler2D uLand;
uniform sampler2D uAurora;
uniform float uHasAurora;

const float PI = 3.14159265;
const int SHELLS = 10;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

// Geographic direction -> (longitude, latitude) in radians.
vec2 lonLat(vec3 g) { return vec2(atan(g.x, g.z), asin(clamp(g.y, -1.0, 1.0))); }

// Light emitted by the aurora at geographic direction g, 0..1.
float auroraAt(vec3 g) {
  vec2 ll = lonLat(g);
  float p = texture2D(uAurora, vec2(ll.x / (2.0 * PI), ll.y / PI + 0.5)).r; // 1.0 = 100 %
  // Fine vertical rays that drift sideways: the "curtain" structure.
  float rays = 0.55 + 0.45 * noise(vec2(ll.x * 60.0 + uTime * 0.25, ll.y * 6.0 - uTime * 0.05));
  float shimmer = 0.8 + 0.2 * noise(vec2(ll.x * 9.0 - uTime * 0.12, uTime * 0.3));
  // Quiet nights peak around 10-20 %; this curve keeps them visible without
  // letting a real storm blow out to white.
  return (1.0 - exp(-p * 7.0)) * rays * shimmer;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uRadius;
  float d = length(p);
  vec3 col = vec3(0.027, 0.027, 0.043);

  // Stars
  vec2 cell = gl_FragCoord.xy / 54.0;
  vec2 id = floor(cell);
  float rnd = hash(id);
  vec2 off = fract(cell) - 0.15 - 0.7 * vec2(rnd, hash(id + 7.0));
  float star = smoothstep(0.035, 0.0, length(off)) * step(0.6, hash(id + 3.0));
  col += star * star * (0.5 + 0.5 * sin(uTime * (0.5 + rnd) + rnd * 40.0)) * 0.7;

  if (d < 1.0) {
    vec3 n = vec3(p, sqrt(1.0 - d * d));
    vec3 g = uRot * n;
    vec2 ll = lonLat(g);
    float land = texture2D(uLand, vec2(ll.x / (2.0 * PI) + 0.5, 0.5 - ll.y / PI)).r;
    land = max(land, step(ll.y, -1.5)); // the mask has a pinhole at the south pole
    float day = smoothstep(-0.12, 0.22, dot(g, uSun));

    vec3 ocean = mix(vec3(0.016, 0.022, 0.042), vec3(0.04, 0.085, 0.17), day);
    vec3 ground = mix(vec3(0.055, 0.065, 0.1), vec3(0.16, 0.2, 0.3), day);
    vec3 surf = mix(ocean, ground, smoothstep(0.35, 0.65, land));
    // Coastline: brightest where the mask is half-way between sea and land.
    surf += vec3(0.25, 0.32, 0.45) * land * (1.0 - land) * 1.6;
    // Graticule every 15 degrees.
    vec2 grid = abs(fract(vec2(ll.x, ll.y) * (12.0 / PI) + 0.5) - 0.5);
    surf += 0.035 * (smoothstep(0.012, 0.0, grid.x) + smoothstep(0.012, 0.0, grid.y));

    col = surf * (0.55 + 0.45 * n.z);
    // Thin blue atmosphere at grazing angles, stronger on the day side.
    col += vec3(0.2, 0.45, 1.0) * pow(1.0 - n.z, 3.5) * (0.25 + 0.5 * day);
    float edge = smoothstep(1.0, 1.0 - 2.5 / uRadius, d);
    col = mix(vec3(0.027, 0.027, 0.043), col, edge);
  } else {
    col += vec3(0.2, 0.45, 1.0) * exp(-(d - 1.0) * 26.0) * 0.22;
  }

  // Aurora shells, 80 to ~500 km up (exaggerated so they read at globe scale).
  if (uHasAurora > 0.5) {
    vec3 glow = vec3(0.0);
    for (int k = 0; k < SHELLS; k++) {
      float t = float(k) / float(SHELLS - 1);
      float r = 1.012 + t * 0.075;
      if (d >= r) continue;
      float z = sqrt(r * r - d * d);
      vec3 tint = mix(vec3(0.2, 1.0, 0.62), vec3(0.62, 0.3, 1.0), smoothstep(0.25, 1.0, t));
      float weight = exp(-t * 2.2) * 0.34;
      // Front of the shell: always in front of the planet.
      vec3 gf = uRot * (vec3(p, z) / r);
      float night = 1.0 - 0.75 * smoothstep(-0.1, 0.25, dot(gf, uSun));
      glow += tint * auroraAt(gf) * weight * night;
      // Back of the shell: only visible beyond the limb.
      if (d > 1.0) {
        vec3 gb = uRot * (vec3(p, -z) / r);
        float nightB = 1.0 - 0.75 * smoothstep(-0.1, 0.25, dot(gb, uSun));
        glow += tint * auroraAt(gb) * weight * nightB;
      }
    }
    col += glow;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;function w(e){let t=e.getContext(`webgl`,{alpha:!1,antialias:!1});if(!t)return null;let n=(e,n)=>{let r=t.createShader(e);if(t.shaderSource(r,n),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw Error(t.getShaderInfoLog(r)??`shader compile failed`);return r},r=t.createProgram();if(t.attachShader(r,n(t.VERTEX_SHADER,S)),t.attachShader(r,n(t.FRAGMENT_SHADER,C)),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS))throw Error(t.getProgramInfoLog(r)??`program link failed`);t.useProgram(r),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);let i=t.getAttribLocation(r,`aPos`);t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0);let a=e=>t.getUniformLocation(r,e),o={center:a(`uCenter`),radius:a(`uRadius`),time:a(`uTime`),rot:a(`uRot`),sun:a(`uSun`),hasAurora:a(`uHasAurora`)},s=(e,n)=>{let r=t.createTexture();return t.activeTexture(t.TEXTURE0+e),t.bindTexture(t.TEXTURE_2D,r),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,n),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),r};t.pixelStorei(t.UNPACK_ALIGNMENT,1),s(0,t.REPEAT),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,1,1,0,t.LUMINANCE,t.UNSIGNED_BYTE,new Uint8Array([0])),t.uniform1i(a(`uLand`),0);let c=new Image;c.onload=()=>{t.activeTexture(t.TEXTURE0),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,t.LUMINANCE,t.UNSIGNED_BYTE,c)},c.src=`/pulse/land.png`;let l=new Uint8Array(131072);s(1,t.REPEAT),t.uniform1i(a(`uAurora`),1),t.uniform1f(o.hasAurora,0);let u=1;return{resize(n,r){u=Math.min(devicePixelRatio||1,1.5),e.width=Math.round(n*u),e.height=Math.round(r*u),t.viewport(0,0,e.width,e.height)},setAurora(e){for(let t=0;t<256;t++){let n=t/255*180,r=Math.floor(n),i=Math.min(180,r+1),a=n-r;for(let n=0;n<512;n++){let o=n/512*360,s=Math.floor(o)%360,c=(s+1)%360,u=o-Math.floor(o),d=e[r*360+s]*(1-u)+e[r*360+c]*u,f=e[i*360+s]*(1-u)+e[i*360+c]*u;l[t*512+n]=Math.min(255,(d*(1-a)+f*a)*2.55)}}t.activeTexture(t.TEXTURE1),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,512,256,0,t.LUMINANCE,t.UNSIGNED_BYTE,l),t.uniform1f(o.hasAurora,1)},draw(n){t.uniform2f(o.center,n.x*u,e.height-n.y*u),t.uniform1f(o.radius,n.radius*u),t.uniform1f(o.time,n.time),t.uniformMatrix3fv(o.rot,!1,n.rotation),t.uniform3f(o.sun,n.sun[0],n.sun[1],n.sun[2]),t.drawArrays(t.TRIANGLES,0,3)}}}function T(e,t){let n=e*Math.PI/180,r=t*Math.PI/180;return[Math.cos(n)*Math.sin(r),Math.sin(n),Math.cos(n)*Math.cos(r)]}function E(e,t,n){let r=e*Math.PI/180,i=t*Math.PI/180,a=Math.sin(r),o=Math.cos(r),s=Math.sin(i),c=Math.cos(i);return n[0]=c,n[1]=0,n[2]=-s,n[3]=-a*s,n[4]=o,n[5]=-a*c,n[6]=o*s,n[7]=a,n[8]=o*c,n}var D=s(`<canvas class=pulse-canvas aria-hidden=true>`),O=s(`<div class=pulse-marker aria-hidden=true>`),k=s(`<p class="pulse-nogl label-sm faint">WebGL is unavailable — the globe can't be drawn in this browser.`),A=s(`<aside class=pulse-hud aria-label="Live space weather"><div class=pulse-hud-head><span class="label-sm pulse-status"></span><span class="label-sm faint"></span></div><div class=pulse-hud-grid><div class=pulse-stat><span class="label-sm muted">Wind</span><span class=data-lg><!$><!/> <small>km/s</small></span><svg class=pulse-spark viewBox="0 0 100 24"preserveAspectRatio=none aria-hidden=true><path></path></svg></div><div class=pulse-stat><span class="label-sm muted">Density</span><span class=data-lg><!$><!/> <small>p/cm³</small></span></div><div class=pulse-stat><span class="label-sm muted">Bz</span><span class=data-lg><!$><!/> <small>nT</small></span></div><div class=pulse-stat><span class="label-sm muted">Kp</span><span class=data-lg><!$><!/> <small>`);function j(e){let[t,r]=p(e.get(),{equals:!1});return n(e.subscribe(e=>r(()=>e))),t}var M=e=>((e+180)%360+360)%360-180;function N(){let s,S,C=j(x),N=j(g),P=j(b),F=j(y),I=j(h),[L,R]=p(Date.now()),[z,B]=p(!0),V=r(()=>C().at(-1)),H=r(()=>N().filter(e=>!e.predicted).at(-1)?.kp),U=r(()=>{let e=P();if(!e)return``;let t=Math.max(0,Math.round((L()-e.observed.getTime())/6e4));return t<1?`just now`:t<90?`${t} min ago`:`${Math.round(t/60)} h ago`}),W=r(()=>{let e=C();if(e.length<2)return``;let t=e.map(e=>e.speed),n=Math.min(...t),r=Math.max(1,Math.max(...t)-n);return t.map((e,i)=>`${i?`L`:`M`}${(i/(t.length-1)*100).toFixed(1)} ${(22-(e-n)/r*20).toFixed(1)}`).join(` `)});return t(()=>{_();let e=setInterval(()=>R(Date.now()),15e3);n(()=>clearInterval(e));let t=null;try{t=w(s)}catch(e){console.error(e)}if(!t){B(!1);return}let r=t;n(b.subscribe(e=>e&&r.setAurora(e.grid)));let i=matchMedia(`(prefers-reduced-motion: reduce)`).matches,a=new Float32Array(9),o=0,c=0,l=0,u=30,d=0,f=!1,p=0,h=0,g=!1,v=null,y=performance.now(),x=()=>{o=innerWidth,c=innerHeight,r.resize(o,c)},C=e=>{l=requestAnimationFrame(C);let t=m(new Date),n=I();n!==v&&(v=n,g=!1);let s=n.lat,_=n.lon===`night`?t.lon+180:n.lon===`day`?t.lon-55:n.lon;g&&(s=p,_=h);let b=f?.35:i?1:.045;u+=(s-u)*b,d+=M(_-d)*b;let x=o<860,w=x?Math.min(o*.44,c*.24):Math.min(c*.4,o*.27),D=x?o/2:o*.68,O=x?c*.29:c*.5;E(u,d,a),r.draw({x:D,y:O,radius:w,time:i?0:(e-y)/1e3,rotation:a,sun:T(t.lat,t.lon)});let k=n.marker;if(k){let e=T(k.lat,k.lon),t=e[0]*a[0]+e[1]*a[1]+e[2]*a[2],n=e[0]*a[3]+e[1]*a[4]+e[2]*a[5],r=e[0]*a[6]+e[1]*a[7]+e[2]*a[8];S.style.transform=`translate(${D+t*w}px, ${O-n*w}px)`,S.style.opacity=r>.05?`1`:`0`,S.dataset.name=k.name}else S.style.opacity=`0`},D=0,O=0,k=e=>{e.pointerType!==`touch`&&(f=!0,g=!0,p=u,h=d,D=e.clientX,O=e.clientY,s.setPointerCapture(e.pointerId))},A=e=>{f&&(h=M(h-(e.clientX-D)*.3),p=Math.max(-89,Math.min(89,p+(e.clientY-O)*.3)),D=e.clientX,O=e.clientY)},j=()=>f=!1;x(),addEventListener(`resize`,x),s.addEventListener(`pointerdown`,k),s.addEventListener(`pointermove`,A),s.addEventListener(`pointerup`,j),s.addEventListener(`pointercancel`,j),l=requestAnimationFrame(C),n(()=>{cancelAnimationFrame(l),removeEventListener(`resize`,x)})}),[(()=>{var e=l(D),t=s;return typeof t==`function`?d(t,e):s=e,e})(),(()=>{var e=l(O),t=S;return typeof t==`function`?d(t,e):S=e,e})(),o(i,{get when(){return!z()},get children(){return l(k)}}),(()=>{var t=l(A),n=t.firstChild,r=n.firstChild,i=r.nextSibling,o=n.nextSibling.firstChild,s=o.firstChild.nextSibling,d=s.firstChild,[p,m]=f(d.nextSibling);p.nextSibling;var h=s.nextSibling.firstChild,g=o.nextSibling,_=g.firstChild.nextSibling,y=_.firstChild,[b,x]=f(y.nextSibling);b.nextSibling;var S=g.nextSibling,C=S.firstChild.nextSibling,w=C.firstChild,[T,E]=f(w.nextSibling);T.nextSibling;var D=S.nextSibling.firstChild.nextSibling,O=D.firstChild,[k,j]=f(O.nextSibling),M=k.nextSibling.nextSibling;return a(r,(()=>{var e=u(()=>F()===`live`);return()=>e()?`● Live · NOAA SWPC`:u(()=>F()===`snapshot`)()?`○ Saved snapshot`:F()===`offline`?`○ NOAA unreachable`:`○ Connecting…`})()),a(i,U),a(s,(()=>{var e=u(()=>!!V());return()=>e()?Math.round(V().speed):`—`})(),p,m),a(_,(()=>{var e=u(()=>!!V());return()=>e()?V().density.toFixed(1):`—`})(),b,x),a(C,(()=>{var e=u(()=>!!V());return()=>e()?(V().bz>0?`+`:``)+V().bz.toFixed(1):`—`})(),T,E),a(D,(()=>{var e=u(()=>H()!==void 0);return()=>e()?H().toFixed(1):`—`})(),k,j),a(M,(()=>{var e=u(()=>H()!==void 0);return()=>e()?v(H()).split(` · `)[0]:``})()),e(e=>{var t=F()===`live`,n=W(),i=(V()?.bz??0)<0;return t!==e.e&&r.classList.toggle(`live`,e.e=t),n!==e.t&&c(h,`d`,e.t=n),i!==e.a&&C.classList.toggle(`pulse-south`,e.a=i),e},{e:void 0,t:void 0,a:void 0}),t})()]}export{N as default};