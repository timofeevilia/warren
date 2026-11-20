import{C as e,D as t,E as n,S as r,_ as i,a,b as o,c as s,d as c,f as l,g as u,l as d,n as f,o as p,p as m,r as h,t as g,w as _}from"./web.CbfWUlI9.js";import{S as v,_ as y,a as b,b as x,f as S,g as C,h as w,l as T,m as E,n as D,o as O,p as k,r as A,s as j,t as ee,u as M,v as te,x as N,y as P}from"./engine.MG_mQQ61.js";var F=`
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`,I=`
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uScene;
uniform float uFade;
uniform float uBass, uMid, uHigh, uLevel;
uniform float uGlow, uDetail;
uniform vec3 uA, uB, uC;      // palette: dark, main, highlight
uniform vec3 uTint;           // colour of the notes being played
uniform float uTintAmount;
uniform sampler2D uSpec, uWave, uHist;
uniform float uHistRow;       // v coordinate of the newest row in uHist
uniform vec4 uNotes[6];       // hue, age (s), velocity, x position

const float PI = 3.14159265;

vec3 pal(float t) {
  t = clamp(t, 0.0, 1.0);
  return mix(mix(uA, uB, smoothstep(0.0, 0.55, t)), uC, smoothstep(0.5, 1.0, t));
}
vec3 hue(float h) { return clamp(abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 17.3; a *= 0.5; }
  return v;
}

// Silk: ribbons whose shape is the waveform itself.
vec3 silk(vec2 uv) {
  vec3 col = vec3(0.0);
  float lines = 5.0 + floor(uDetail * 8.0);
  for (int i = 0; i < 13; i++) {
    float fi = float(i);
    if (fi >= lines) break;
    float t = fi / (lines - 1.0);
    float w = texture2D(uWave, vec2(uv.x * 0.22 + 0.5 + t * 0.07, 0.5)).r - 0.5;
    float y = sin(uv.x * (1.3 + t * 2.2) + uTime * (0.35 + t * 0.4) + fi * 1.7) * (0.12 + 0.1 * t)
            + (t - 0.5) * 0.9
            + w * (0.35 + uLevel * 1.3);
    float d = abs(uv.y - y);
    col += pal(t) * (0.0035 + 0.01 * uLevel) / (d + 0.006) * 0.45;
  }
  return col;
}

// Bloom: the spectrum wrapped around a circle and mirrored into petals.
vec3 bloom(vec2 uv) {
  float r = length(uv);
  float n = 3.0 + floor(uDetail * 9.0);
  float a = atan(uv.y, uv.x) + uTime * 0.07;
  float seg = PI / n;
  a = abs(mod(a, 2.0 * seg) - seg);
  float s = texture2D(uSpec, vec2(clamp(r * 0.72, 0.0, 1.0), 0.5)).r;
  float petal = 0.5 + 0.5 * cos(a * n * 2.0 + r * 14.0 - uTime * 1.3);
  float rings = 0.5 + 0.5 * sin(r * 34.0 - uTime * 2.0 - s * 6.0);
  vec3 col = pal(fract(r * 0.9 - uTime * 0.04)) * s * s * (0.35 + 1.6 * petal * rings);
  col += uC * uBass * 0.5 * exp(-r * 5.0);
  col += pal(0.5) * 0.05 * petal * exp(-r * 1.4); // a faint flower even in silence
  return col;
}

// Liquid: smoke that the bass stirs.
vec3 liquid(vec2 uv) {
  vec2 p = uv * (1.2 + uDetail * 1.6);
  float t = uTime * 0.12;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + (1.6 + uBass * 3.5) * q + vec2(1.7, 9.2)), fbm(p + 2.0 * q + vec2(8.3, 2.8) + t));
  float v = fbm(p + (2.2 + uMid * 2.5) * r);
  vec3 col = pal(v * 1.25 + uHigh * 0.35 - 0.1) * (0.05 + v * v * (0.55 + uLevel * 2.2));
  col += uC * pow(v, 6.0) * uHigh * 4.0;
  return col;
}

// Strata: every line is the spectrum from a moment ago, receding into the distance.
vec3 strata(vec2 uv) {
  vec3 col = vec3(0.0);
  float rows = 14.0 + floor(uDetail * 16.0);
  float aspect = uRes.x / uRes.y;
  for (int i = 29; i >= 0; i--) {     // far to near, so near ridges hide far ones
    float fi = float(i);
    if (fi >= rows) continue;
    float t = fi / (rows - 1.0);      // 0 = nearest (newest), 1 = farthest
    float scale = mix(1.0, 0.42, t);
    float x = uv.x / aspect / scale;
    float h = texture2D(uHist, vec2(clamp(abs(x) * 1.15, 0.0, 1.0), uHistRow - t * 0.46)).r;
    float y = -0.72 + t * 1.25 + h * 0.42 * scale;
    float inside = step(abs(x), 0.87);
    if (uv.y < y) col *= 1.0 - 0.92 * inside;
    float d = abs(uv.y - y);
    col += pal(1.0 - t) * inside * (0.003 * scale) / (d + 0.0035) * (0.35 + 1.4 * h) * mix(1.0, 0.35, t);
  }
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  vec3 col;
  if (uScene < 0.5) col = silk(uv);
  else if (uScene < 1.5) col = bloom(uv);
  else if (uScene < 2.5) col = liquid(uv);
  else col = strata(uv);

  // The synaesthesia part: what is being played tints everything.
  col *= mix(vec3(1.0), uTint * 1.2 + 0.4, uTintAmount);

  // Each new note drops a ring of its own colour.
  float aspect = uRes.x / uRes.y;
  for (int i = 0; i < 6; i++) {
    vec4 note = uNotes[i];
    if (note.z <= 0.0) continue;
    vec2 centre = vec2((note.w - 0.5) * aspect * 1.5, -0.55);
    float d = abs(length(uv - centre) - note.y * 0.75);
    col += hue(note.x) * note.z * exp(-note.y * 1.6) * 0.012 / (d + 0.006);
  }

  col *= (0.45 + uGlow * 1.5) * uFade;
  col = 1.0 - exp(-col * 1.25);                         // soft clip instead of blowing out
  col *= 1.0 - 0.38 * dot(uv * 0.5, uv * 0.5);          // vignette
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.018; // grain hides banding
  col += vec3(0.027, 0.027, 0.043) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}
`,L=64;function R(e){let t=e.getContext(`webgl`,{alpha:!1,antialias:!1,preserveDrawingBuffer:!0});if(!t)return null;let n=(e,n)=>{let r=t.createShader(e);if(t.shaderSource(r,n),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw Error(t.getShaderInfoLog(r)??`shader compile failed`);return r},r=t.createProgram();if(t.attachShader(r,n(t.VERTEX_SHADER,F)),t.attachShader(r,n(t.FRAGMENT_SHADER,I)),t.linkProgram(r),!t.getProgramParameter(r,t.LINK_STATUS))throw Error(t.getProgramInfoLog(r)??`program link failed`);t.useProgram(r),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);let i=t.getAttribLocation(r,`aPos`);t.enableVertexAttribArray(i),t.vertexAttribPointer(i,2,t.FLOAT,!1,0,0);let a=e=>t.getUniformLocation(r,e),o={res:a(`uRes`),time:a(`uTime`),scene:a(`uScene`),fade:a(`uFade`),bass:a(`uBass`),mid:a(`uMid`),high:a(`uHigh`),level:a(`uLevel`),glow:a(`uGlow`),detail:a(`uDetail`),a:a(`uA`),b:a(`uB`),c:a(`uC`),tint:a(`uTint`),tintAmount:a(`uTintAmount`),histRow:a(`uHistRow`),notes:a(`uNotes`)};t.pixelStorei(t.UNPACK_ALIGNMENT,1);let s=(e,n,r)=>{t.activeTexture(t.TEXTURE0+e),t.bindTexture(t.TEXTURE_2D,t.createTexture()),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,r),t.uniform1i(a(n),e)};s(0,`uSpec`,t.CLAMP_TO_EDGE),s(1,`uWave`,t.CLAMP_TO_EDGE),s(2,`uHist`,t.REPEAT);let c=new Uint8Array(64*L),l=0,u=0,d=1;return{resize(n,r){d=Math.min(devicePixelRatio||1,1.5),e.width=Math.round(n*d),e.height=Math.round(r*d),t.viewport(0,0,e.width,e.height)},draw(n){let{audio:r}=n;t.activeTexture(t.TEXTURE0),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,64,1,0,t.LUMINANCE,t.UNSIGNED_BYTE,r.spectrum),t.activeTexture(t.TEXTURE1),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,256,1,0,t.LUMINANCE,t.UNSIGNED_BYTE,r.waveform),n.time-u>.05&&(u=n.time,l=(l+1)%L,c.set(r.spectrum,l*64),t.activeTexture(t.TEXTURE2),t.texImage2D(t.TEXTURE_2D,0,t.LUMINANCE,64,L,0,t.LUMINANCE,t.UNSIGNED_BYTE,c)),t.uniform2f(o.res,e.width,e.height),t.uniform1f(o.time,n.time),t.uniform1f(o.scene,n.scene),t.uniform1f(o.fade,n.fade),t.uniform1f(o.bass,r.bass),t.uniform1f(o.mid,r.mid),t.uniform1f(o.high,r.high),t.uniform1f(o.level,r.level),t.uniform1f(o.glow,n.glow),t.uniform1f(o.detail,n.detail),t.uniform3fv(o.a,n.palette.subarray(0,3)),t.uniform3fv(o.b,n.palette.subarray(3,6)),t.uniform3fv(o.c,n.palette.subarray(6,9)),t.uniform3f(o.tint,n.tint[0],n.tint[1],n.tint[2]),t.uniform1f(o.tintAmount,n.tintAmount),t.uniform1f(o.histRow,(l+.5)/L),t.uniform4fv(o.notes,n.notes),t.drawArrays(t.TRIANGLES,0,3)}}}var ne=e=>[parseInt(e.slice(1,3),16)/255,parseInt(e.slice(3,5),16)/255,parseInt(e.slice(5,7),16)/255];function z(e){let t=t=>Math.min(1,Math.max(0,Math.abs((e+t)%1*6-3)-1));return[t(0),t(2/3),t(1/3)]}var re=l(`<div class=syn-knob role=slider tabindex=0 aria-valuemin=0 aria-valuemax=100><svg viewBox="0 0 56 56"aria-hidden=true><circle class=syn-knob-track cx=28 cy=28 r=20 stroke-dasharray="94.25 200"transform="rotate(135 28 28)"></circle><circle class=syn-knob-value cx=28 cy=28 r=20 transform="rotate(135 28 28)"></circle><line class=syn-knob-hand x1=28 y1=28 x2=28 y2=13></line></svg><span class="label-sm muted"></span><span class="label-sm syn-knob-read">`),ie=l(`<p class="syn-nogl label-sm muted">WebGL is unavailable — you can still play, but there is nothing to see.`),ae=l(`<aside class=syn-panel><section><p class="label-md syn-accent">Sound</p><div class=syn-segment role=radiogroup aria-label=Waveform></div><div class=syn-knobs><!$><!/><!$><!/><!$><!/><!$><!/><!$><!/></div></section><section><p class="label-md syn-accent">Vision</p><div class=syn-segment role=radiogroup aria-label=Scene></div><div class=syn-knobs><!$><!/><!$><!/><!$><!/></div></section><section class=syn-actions><button class=label-sm></button><button class=label-sm></button><button class=label-sm></button></section><p class="label-sm faint"><!$><!/> · <!$><!/>`),oe=l(`<div class=syn><canvas class=syn-canvas aria-hidden=true></canvas><!$><!/><button class="syn-panel-toggle label-md"></button><!$><!/><div class=syn-keys><div class=syn-keys-inner></div><p class="label-sm faint syn-hint">Play with the keys A–; and W E T Y U O P · Z / X shift the octave (<!$><!/><!$><!/>)`),se=l(`<button class=label-sm role=radio>`),ce=l(`<button class=syn-key tabindex=-1><span class=label-sm>`);function B(e){let[t,r]=_(e.get(),{equals:!1});return n(e.subscribe(e=>r(()=>e))),t}var V=270;function H(t){let n=0,r=0,i=e=>P(t.name,Math.max(0,Math.min(1,e))),o=()=>-135+t.value()*V,c=()=>`${t.value()*94.25} 200`;return(()=>{var l=f(re),u=l.firstChild,p=u.firstChild.nextSibling,m=p.nextSibling,h=u.nextSibling,g=h.nextSibling;return l.$$keydown=e=>{(e.key===`ArrowUp`||e.key===`ArrowRight`)&&i(t.value()+.03),(e.key===`ArrowDown`||e.key===`ArrowLeft`)&&i(t.value()-.03)},l.addEventListener(`wheel`,e=>{e.preventDefault(),i(t.value()-Math.sign(e.deltaY)*.03)}),l.$$pointermove=e=>{e.currentTarget.hasPointerCapture(e.pointerId)&&i(r+(n-e.clientY)/160)},l.$$pointerdown=e=>{e.currentTarget.setPointerCapture(e.pointerId),n=e.clientY,r=t.value()},a(h,()=>t.label),a(g,()=>j[t.name](t.value())),e(e=>{var n=t.label,r=Math.round(t.value()*100),i=j[t.name](t.value()),a=c(),s=`rotate(${o()} 28 28)`;return n!==e.e&&d(l,`aria-label`,e.e=n),r!==e.t&&d(l,`aria-valuenow`,e.t=r),i!==e.a&&d(l,`aria-valuetext`,e.a=i),a!==e.o&&d(p,`stroke-dasharray`,e.o=a),s!==e.i&&d(m,`transform`,e.i=s),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0}),s(),l})()}var U=[`a`,`w`,`s`,`e`,`d`,`f`,`t`,`g`,`y`,`h`,`u`,`j`,`k`,`o`,`l`,`p`,`;`],W=new Set([1,3,6,8,10]),G=48,K=Array.from({length:25},(e,t)=>{let n=G+t,[r,i,a]=z(M(n));return{midi:n,black:W.has(n%12),color:`rgb(${Math.round(r*255)}, ${Math.round(i*255)}, ${Math.round(a*255)})`}}),q=K.filter(e=>!e.black),J=new Map(q.map((e,t)=>[e.midi,t]));function Y(){let l,g=B(C),j=B(T),F=B(N),I=B(b),L=B(k),re=B(O),[V,W]=_(0),[G,Y]=_(!0),[le,ue]=_(!1),[de,fe]=_(!0),X=e=>r(()=>g()[e]),Z={attack:X(`attack`),release:X(`release`),filter:X(`filter`),echo:X(`echo`),space:X(`space`),glow:X(`glow`),detail:X(`detail`),speed:X(`speed`)},pe=r(()=>Math.round(g().wave)),me=r(()=>Math.round(g().scene)),he=e=>U[e-60-V()*12]?.toUpperCase()??``,ge=!1,_e=()=>ge=!0,Q=null,ve=e=>{x(),Q!==null&&Q!==e&&E(Q),Q=e,w(e)},$=()=>{Q!==null&&E(Q),Q=null};return t(()=>{innerWidth<760&&Y(!1);let e=new Map,t=t=>{if(t.repeat||t.metaKey||t.ctrlKey||t.altKey||t.target.closest?.(`input, textarea`))return;let n=t.key.toLowerCase();if(n===`z`)return W(e=>Math.max(-1,e-1));if(n===`x`)return W(e=>Math.min(1,e+1));let r=U.indexOf(n);if(r<0||e.has(n)||!N.get())return;x();let i=60+V()*12+r;e.set(n,i),w(i)},r=t=>{let n=t.key.toLowerCase(),r=e.get(n);r!==void 0&&(e.delete(n),E(r))};addEventListener(`keydown`,t),addEventListener(`keyup`,r),addEventListener(`pointerup`,$),addEventListener(`pointercancel`,$),n(()=>{removeEventListener(`keydown`,t),removeEventListener(`keyup`,r),removeEventListener(`pointerup`,$),removeEventListener(`pointercancel`,$),te(!1)});let i=null;try{i=R(l)}catch(e){console.error(e)}if(!i){fe(!1);return}let a=i,o=matchMedia(`(prefers-reduced-motion: reduce)`).matches,s=new Float32Array(24),c=new Float64Array(6).fill(-100),u=0,d=[1,1,1],f=0;S((e,t)=>{u=(u+1)%6,c[u]=performance.now()/1e3,s[u*4]=M(e),s[u*4+2]=t,s[u*4+3]=Math.max(0,Math.min(1,(e-40)/40));let n=z(M(e));for(let e=0;e<3;e++)d[e]+=(n[e]-d[e])*.45;f=Math.min(.38,f+.2)}),n(()=>S(null));let p=new Float32Array(9),m=new Float32Array(9),h=Math.round(C.get().scene),g=1,_=0,v=performance.now(),b=0,T=()=>a.resize(innerWidth,innerHeight),D=e=>{b=requestAnimationFrame(D);let t=Math.min((e-v)/1e3,.1);v=e;let n=C.get();o||(_+=t*(.2+n.speed*1.8)),(y.find(e=>e.id===O.get().id)??y[0]).palette.forEach((e,t)=>m.set(ne(e),t*3));for(let e=0;e<9;e++)p[e]+=(m[e]-p[e])*Math.min(1,t*4);let r=Math.round(n.scene);r===h?g=Math.min(1,g+t*3):(g-=t*5,g<=0&&(g=0,h=r));let i=e/1e3;for(let e=0;e<6;e++)s[e*4+1]=i-c[e];f*=Math.exp(-t*.6),a.draw({time:_,scene:h,fade:g,glow:n.glow,detail:n.detail,palette:p,tint:d,tintAmount:f,notes:s,audio:A()}),ge&&(ge=!1,l.toBlob(e=>{if(!e)return;let t=document.createElement(`a`);t.href=URL.createObjectURL(e),t.download=`synesthesia-${O.get().id}-${Date.now()}.png`,t.click(),URL.revokeObjectURL(t.href),ue(!0),setTimeout(()=>ue(!1),1800)},`image/png`))};T(),k();function k(){(y.find(e=>e.id===O.get().id)??y[0]).palette.forEach((e,t)=>p.set(ne(e),t*3))}addEventListener(`resize`,T),b=requestAnimationFrame(D),n(()=>{cancelAnimationFrame(b),removeEventListener(`resize`,T)})}),(()=>{var t=f(oe),n=t.firstChild,r=n.nextSibling,[g,_]=h(r.nextSibling),y=g.nextSibling,b=y.nextSibling,[x,S]=h(b.nextSibling),C=x.nextSibling,w=C.firstChild,T=w.nextSibling,E=T.firstChild.nextSibling,[O,k]=h(E.nextSibling),A=O.nextSibling,[M,N]=h(A.nextSibling);M.nextSibling;var R=l;return typeof R==`function`?m(R,n):l=n,a(t,o(i,{get when(){return!de()},get children(){return f(ie)}}),g,_),y.$$click=()=>Y(e=>!e),a(y,()=>G()?`Hide controls`:`Controls`),a(t,o(i,{get when(){return G()},get children(){var t=f(ae),n=t.firstChild,r=n.firstChild.nextSibling,i=r.nextSibling,c=i.firstChild,[l,m]=h(c.nextSibling),g=l.nextSibling,[_,y]=h(g.nextSibling),b=_.nextSibling,[x,S]=h(b.nextSibling),C=x.nextSibling,[w,T]=h(C.nextSibling),E=w.nextSibling,[O,k]=h(E.nextSibling),A=n.nextSibling,j=A.firstChild.nextSibling,M=j.nextSibling,N=M.firstChild,[F,R]=h(N.nextSibling),ne=F.nextSibling,[z,ie]=h(ne.nextSibling),oe=z.nextSibling,[ce,B]=h(oe.nextSibling),V=A.nextSibling,U=V.firstChild,W=U.nextSibling,G=W.nextSibling,K=V.nextSibling,q=K.firstChild,[J,Y]=h(q.nextSibling),ue=J.nextSibling.nextSibling,[de,fe]=h(ue.nextSibling);return a(r,o(u,{each:D,children:(t,n)=>(()=>{var r=f(se);return r.$$click=()=>P(`wave`,n()),a(r,t===`sawtooth`?`saw`:t===`triangle`?`tri`:t),e(e=>{var t=pe()===n(),i=pe()===n();return t!==e.e&&d(r,`aria-checked`,e.e=t),i!==e.t&&r.classList.toggle(`current`,e.t=i),e},{e:void 0,t:void 0}),s(),r})()})),a(i,o(H,{label:`Attack`,name:`attack`,get value(){return Z.attack}}),l,m),a(i,o(H,{label:`Release`,name:`release`,get value(){return Z.release}}),_,y),a(i,o(H,{label:`Filter`,name:`filter`,get value(){return Z.filter}}),x,S),a(i,o(H,{label:`Echo`,name:`echo`,get value(){return Z.echo}}),w,T),a(i,o(H,{label:`Space`,name:`space`,get value(){return Z.space}}),O,k),a(j,o(u,{each:ee,children:(t,n)=>(()=>{var r=f(se);return r.$$click=()=>P(`scene`,n()),a(r,t),e(e=>{var t=me()===n(),i=me()===n();return t!==e.e&&d(r,`aria-checked`,e.e=t),i!==e.t&&r.classList.toggle(`current`,e.t=i),e},{e:void 0,t:void 0}),s(),r})()})),a(M,o(H,{label:`Glow`,name:`glow`,get value(){return Z.glow}}),F,R),a(M,o(H,{label:`Detail`,name:`detail`,get value(){return Z.detail}}),z,ie),a(M,o(H,{label:`Speed`,name:`speed`,get value(){return Z.speed}}),ce,B),U.$$click=()=>te(!I()),a(U,()=>I()?`■ Stop`:`▶ Play for me`),W.$$click=()=>void v(),a(W,(()=>{var e=p(()=>L()===`on`);return()=>e()?`● Mic on`:L()===`denied`?`Mic blocked`:`○ Use mic`})()),G.$$click=_e,a(G,()=>le()?`Saved ✓`:`↓ Save poster`),a(K,()=>re().edited?`Edited from`:`Preset`,J,Y),a(K,()=>re().id,de,fe),e(e=>{var t=!!I(),n=L()===`on`;return t!==e.e&&U.classList.toggle(`current`,e.e=t),n!==e.t&&W.classList.toggle(`current`,e.t=n),e},{e:void 0,t:void 0}),s(),t}}),x,S),C.addEventListener(`pointerleave`,$),a(w,o(u,{each:K,children:t=>(()=>{var n=f(ce),r=n.firstChild;return n.addEventListener(`pointerenter`,e=>e.buttons>0&&ve(t.midi)),n.$$pointerdown=e=>{e.preventDefault(),e.target.releasePointerCapture?.(e.pointerId),ve(t.midi)},a(r,()=>he(t.midi)),e(e=>{var r=!!t.black,i=!!j().has(t.midi),a=t.color,o=t.black?J.get(t.midi-1)+1:J.get(t.midi),s=`Note ${t.midi}`;return r!==e.e&&n.classList.toggle(`black`,e.e=r),i!==e.t&&n.classList.toggle(`on`,e.t=i),a!==e.a&&c(n,`--hue`,e.a=a),o!==e.o&&c(n,`--at`,e.o=o),s!==e.i&&d(n,`aria-label`,e.i=s),e},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0}),s(),n})()})),a(T,()=>V()>=0?`+`:``,O,k),a(T,V,M,N),e(e=>{var n=!!F(),r=q.length;return n!==e.e&&t.classList.toggle(`syn-live`,e.e=n),r!==e.t&&c(w,`--whites`,e.t=r),e},{e:void 0,t:void 0}),s(),t})()}g([`pointerdown`,`pointermove`,`keydown`,`click`]);export{Y as default};