/* ANAMBRO · Aula — bloques diagrama 2,5D para animaciones de geomorfología.
   Un relieve se define con una función de altura z(u,v) (u: izquierda→derecha, v: fondo→frente, ambos 0–1)
   y opcionalmente una superficie de agua o hielo. Se dibuja en perspectiva caballera, con sombreado
   y con los cortes frontal y lateral mostrando las capas del subsuelo. */
(function(){
'use strict';
const clamp=(a,b,c)=>Math.max(b,Math.min(c,a));
function noise(seed){const P=new Uint8Array(512),p=[...Array(256).keys()];let s=seed*9301+49297;for(let i=255;i>0;i--){s=(s*9301+49297)%233280;const j=Math.floor(s/233280*(i+1));[p[i],p[j]]=[p[j],p[i]]}for(let i=0;i<512;i++)P[i]=p[i&255];
 const f=t=>t*t*t*(t*(t*6-15)+10),g=(h,x,y)=>((h&1)?-x:x)+((h&2)?-y:y);
 const n=(x,y)=>{const X=Math.floor(x)&255,Y=Math.floor(y)&255;x-=Math.floor(x);y-=Math.floor(y);const u=f(x),v=f(y),a=P[X]+Y,b=P[X+1]+Y,l=(a1,b1,t)=>a1+t*(b1-a1);return l(l(g(P[a],x,y),g(P[b],x-1,y),u),l(g(P[a+1],x,y-1),g(P[b+1],x-1,y-1),u),v)};
 return (x,y,o=4)=>{let s=0,a=1,t=0;for(let i=0;i<o;i++){s+=a*n(x,y);t+=a;x*=2.02;y*=2.02;a*=.5}return s/t}}
/* geometría de la vista: devuelve proyección */
function view(w,h,o={}){const sk=o.skew??.42,dep=o.depth??.5,hz=o.hz??.32,mx=o.margin??.04;
 const W=w*(1-2*mx)/(1+sk*dep),D=W*dep,x0=w*mx,y0=h*(o.top??.3),Hs=h*hz;
 return {W,D,sk,x0,y0,Hs,P:(u,v,z)=>[x0+u*W+(1-v)*D*sk,y0+v*D*.9-z*Hs]}}
/* dibuja el bloque. o={z(u,v), color(u,v,z,slope)→[r,g,b], water(u,v)→nivel|null, wcolor, N, M, strata:[[prof,color]], base:-.4, light} */
function block(x,w,h,o){const V=o.view||view(w,h,o.v),N=Math.max(o.N||110,170),M=Math.max(o.M||70,150),P=V.P,base=o.base??-.35;
 const Z=new Float32Array((N+1)*(M+1));for(let j=0;j<=M;j++)for(let i=0;i<=N;i++)Z[j*(N+1)+i]=o.z(i/N,j/M);
 const WG=o.water?new Float32Array((N+1)*(M+1)):null;if(WG)for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const q=o.water(i/N,j/M);WG[j*(N+1)+i]=q==null?-1e9:q}
 x.lineWidth=.7;x.lineJoin='round';const L=o.light||[-.55,-.5,.67],ln=Math.hypot(...L),Lx=L[0]/ln,Ly=L[1]/ln,Lz=L[2]/ln,zs=o.zscale||3;
 // cara frontal (v=1) y lateral (u=1) con estratos
 const side=(pts,isFront)=>{for(const [d,col] of (o.strata||[[0,'#7a6650'],[.25,'#5e4d3d'],[.6,'#46392e']])){x.fillStyle=col;x.beginPath();pts.forEach((q,k)=>{const [px,py]=P(q[0],q[1],Math.max(base,q[2]-d));k?x.lineTo(px,py):x.moveTo(px,py)});for(let k=pts.length-1;k>=0;k--){const q=pts[k];const [px,py]=P(q[0],q[1],base);x.lineTo(px,py)}x.closePath();x.fill()}
  if(o.sideExtra)o.sideExtra(x,P,isFront)};
 for(let j=0;j<M;j++){const v0=j/M,v1=(j+1)/M;for(let i=0;i<N;i++){const u0=i/N,u1=(i+1)/N,a=Z[j*(N+1)+i],b=Z[j*(N+1)+i+1],c=Z[(j+1)*(N+1)+i+1],d=Z[(j+1)*(N+1)+i];
   const dzu=(b-a+c-d)/2*N/zs,dzv=(d-a+c-b)/2*M/zs*.8,nl=1/Math.hypot(dzu,dzv,1),sh=clamp((-dzu*Lx-dzv*Ly+Lz)*nl,0,1);const zm=(a+b+c+d)/4,slope=Math.hypot(dzu,dzv);
   let col=o.color((u0+u1)/2,(v0+v1)/2,zm,slope);const wa=WG?WG[j*(N+1)+i]:-1e9,wb=WG?WG[j*(N+1)+i+1]:-1e9,wc_=WG?WG[(j+1)*(N+1)+i+1]:-1e9,wd=WG?WG[(j+1)*(N+1)+i]:-1e9,wet=wa>a||wb>b||wc_>c||wd>d,wl=wet?Math.max(wa,wb,wc_,wd):null;let k=.42+.78*sh;
   if(wet){const A=Math.max(a,wa),B=Math.max(b,wb),C=Math.max(c,wc_),Dd=Math.max(d,wd),cov=clamp(((wa>a)+(wb>b)+(wc_>c)+(wd>d))/4*.8+.2*clamp(((A-a)+(B-b)+(C-c)+(Dd-d))*40,0,1),0,1),dep=clamp(((A+B+C+Dd)/4-zm)*6,0,1),wc=o.wcolor||[46,110,160],f=Math.pow(cov,.7)*(.6+.4*dep);
     const wu=(B-A+C-Dd)/2*N/zs,wv=(Dd-A+C-B)/2*M/zs*.8,wn=1/Math.hypot(wu,wv,1),ws=clamp((-wu*Lx-wv*Ly+Lz)*wn,0,1),kw=.8+.3*ws;
     col=[col[0]*k*(1-f)+wc[0]*kw*f,col[1]*k*(1-f)+wc[1]*kw*f,col[2]*k*(1-f)+wc[2]*kw*f];
     const q1=P(u0,v0,A),q2=P(u1,v0,B),q3=P(u1,v1,C),q4=P(u0,v1,Dd);x.fillStyle=x.strokeStyle=`rgb(${Math.min(255,col[0])|0},${Math.min(255,col[1])|0},${Math.min(255,col[2])|0})`;x.beginPath();x.moveTo(...q1);x.lineTo(...q2);x.lineTo(...q3);x.lineTo(...q4);x.closePath();x.fill();x.stroke();continue}
   const p1=P(u0,v0,a),p2=P(u1,v0,b),p3=P(u1,v1,c),p4=P(u0,v1,d);x.fillStyle=x.strokeStyle=`rgb(${Math.min(255,col[0]*k)|0},${Math.min(255,col[1]*k)|0},${Math.min(255,col[2]*k)|0})`;x.beginPath();x.moveTo(...p1);x.lineTo(...p2);x.lineTo(...p3);x.lineTo(...p4);x.closePath();x.fill();x.stroke()}}
 const front=[];for(let i=0;i<=N;i++)front.push([i/N,1,Z[M*(N+1)+i]]);side(front,true);
 const right=[];for(let j=0;j<=M;j++)right.push([1,j/M,Z[j*(N+1)+N]]);side(right,false);
 // agua en los cortes
 if(o.water){const wc=o.wcolor||[46,110,160];x.fillStyle=`rgba(${wc[0]*.8|0},${wc[1]*.8|0},${wc[2]*.85|0},.9)`;let run=[];const flush=()=>{if(run.length>1){x.beginPath();run.forEach((r,k)=>{const q=P(r[0],1,r[1]);k?x.lineTo(...q):x.moveTo(...q)});for(let k=run.length-1;k>=0;k--)x.lineTo(...P(run[k][0],1,run[k][2]));x.closePath();x.fill()}run=[]};
  for(let i=0;i<=N;i++){const u=i/N,wl=WG?WG[M*(N+1)+i]:o.water(u,1),zz=Z[M*(N+1)+i];if(wl!=null&&wl>zz)run.push([u,wl,zz]);else{if(run.length){run.push([u,zz,zz]);}flush()}}flush()}
 x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;x.beginPath();x.moveTo(...P(0,1,base));x.lineTo(...P(1,1,base));x.lineTo(...P(1,0,base));x.stroke();
 return {V,P,Z,N,M,zAt:(u,v)=>{const i=clamp(Math.round(u*N),0,N),j=clamp(Math.round(v*M),0,M);return Z[j*(N+1)+i]}}}
function cached(key,w,h,d,fn){const c=cached.m[key];if(c&&c.w===w&&c.h===h&&c.d===d)return c;const cv=document.createElement('canvas');cv.width=Math.round(w*d);cv.height=Math.round(h*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);const r=fn(x);const o={cv,w,h,d,r};const ks=Object.keys(cached.m);if(ks.length>40)delete cached.m[ks[0]];cached.m[key]=o;return o}
cached.m={};
window.AulaRelieve={noise,view,block,cached,clamp};
})();
