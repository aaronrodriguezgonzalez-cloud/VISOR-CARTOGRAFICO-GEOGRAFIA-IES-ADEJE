/* ANAMBRO · Aula — utilidades comunes de las animaciones: Tierra real (Natural Earth), globo ortográfico
   iluminado píxel a píxel, posición del Sol (algoritmo de baja precisión del Almanaque Náutico, error < 0,01°)
   y husos horarios oficiales rasterizados. Todo se calcula en el navegador, sin servicios externos. */
(function(){
'use strict';
const D2R=Math.PI/180,R2D=180/Math.PI,EPS=23.4393;
const V={
 add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}
};
/* Sol: longitud eclíptica aparente, distancia (UA), declinación, ecuación del tiempo (min) para una fecha UTC */
function sun(date){
 const d=(date.getTime()/86400000)+2440587.5-2451545.0;
 const g=((357.529+0.98560028*d)%360+360)%360,q=((280.459+0.98564736*d)%360+360)%360;
 const L=(q+1.915*Math.sin(g*D2R)+0.020*Math.sin(2*g*D2R)+360)%360,R=1.00014-0.01671*Math.cos(g*D2R)-0.00014*Math.cos(2*g*D2R);
 const e=(23.439-0.00000036*d)*D2R,ra=Math.atan2(Math.cos(e)*Math.sin(L*D2R),Math.cos(L*D2R))*R2D,dec=Math.asin(Math.sin(e)*Math.sin(L*D2R))*R2D;
 let eqt=(q-((ra+360)%360));eqt=((eqt+540)%360)-180;
 const gmst=((280.46061837+360.98564736629*d)%360+360)%360;
 return {lambda:L,R,dec,eqtMin:eqt*4,ra:(ra+360)%360,gmst,subLon:((ra-gmst+540)%360)-180};
}
/* duración del día (h) con refracción y semidiámetro (−0,833°) y altura del Sol al mediodía */
function dayLength(lat,dec){const h0=-0.833*D2R,c=(Math.sin(h0)-Math.sin(lat*D2R)*Math.sin(dec*D2R))/(Math.cos(lat*D2R)*Math.cos(dec*D2R));if(c<=-1)return 24;if(c>=1)return 0;return 2*Math.acos(c)*R2D/15}
const noonAltitude=(lat,dec)=>90-Math.abs(lat-dec);
/* máscaras raster (equirrectangulares) */
function loadRaster(src){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data,a=new Uint8Array(c.width*c.height);for(let i=0;i<a.length;i++)a[i]=d[i*4];res({w:c.width,h:c.height,a})};im.onerror=rej;im.src=src})}
const BASE=(()=>{const s=document.currentScript?.src||'';return s.slice(0,s.lastIndexOf('/')+1)})();
let landP=null,tzP=null;
const land=()=>landP||(landP=loadRaster(BASE+'tierra.png'));
const zones=()=>tzP||(tzP=loadRaster(BASE+'husos.png'));
const sample=(r,lat,lon)=>{let x=Math.floor((((lon+180)%360+360)%360)/360*r.w),y=Math.floor((90-lat)/180*r.h);if(y<0)y=0;if(y>=r.h)y=r.h-1;if(x>=r.w)x=r.w-1;return r.a[y*r.w+x]};
const zoneAt=(r,lat,lon)=>{const v=sample(r,lat,lon);return v===255?Math.round(lon/15):v/4-12};
/* Globo ortográfico. o = {cx,cy,R,right,up,toward (vectores del observador, mundo), N (eje), E0 (dirección del
   meridiano 0 en el ecuador), sun (vector unitario hacia el Sol), land (raster), night (0–1 oscuridad),
   grid (paso en grados o 0), highlightLat, tz (raster de husos, colorea franjas) } */
function globe(ctx,o){
 const dpr=o.dpr||1,R=o.R*dpr,cx=o.cx*dpr,cy=o.cy*dpr,x0=Math.max(0,Math.floor(cx-R-1)),y0=Math.max(0,Math.floor(cy-R-1)),W=Math.min(ctx.canvas.width,Math.ceil(cx+R+1))-x0,H=Math.min(ctx.canvas.height,Math.ceil(cy+R+1))-y0;if(W<=0||H<=0)return;
 const img=ctx.getImageData(x0,y0,W,H),px=img.data,E90=V.cross(o.N,o.E0),r=o.right,u=o.up,t=o.toward,N=o.N,E0=o.E0,S=o.sun;
 const L=o.land,grid=o.grid||0,pix=1/R,gw=grid?Math.max(.18,1.1*pix*R2D):0,night=o.night??.78,tz=o.tz,tzAlpha=o.tzAlpha??.38;
 for(let j=0;j<H;j++){const v=(cy-(y0+j+.5))/R;for(let i=0;i<W;i++){const uu=((x0+i+.5)-cx)/R,rr=uu*uu+v*v;if(rr>1)continue;const w=Math.sqrt(1-rr);
  const p0=uu*r[0]+v*u[0]+w*t[0],p1=uu*r[1]+v*u[1]+w*t[1],p2=uu*r[2]+v*u[2]+w*t[2];
  const z=p0*N[0]+p1*N[1]+p2*N[2],lat=Math.asin(Math.max(-1,Math.min(1,z)))*R2D,lon=Math.atan2(p0*E90[0]+p1*E90[1]+p2*E90[2],p0*E0[0]+p1*E0[1]+p2*E0[2])*R2D;
  const isLand=L?sample(L,lat,lon)>127:false;let cr,cg,cb;
  if(isLand){if(lat<-60||(lat>59&&lon>-75&&lon<-10)){cr=232;cg=238;cb=242}else{const k=Math.min(1,Math.abs(lat)/55);cr=118-10*k;cg=160-25*k;cb=92+10*k}}else{cr=34;cg=98;cb=146}
  if(o.tzMode&&(tz||o.tzMode==='teoricos')){const zz=o.tzMode==='teoricos'?Math.max(-12,Math.min(12,Math.round(lon/15))):zoneAt(tz,lat,lon),c=zoneColor(zz),al=isLand?(o.tzAlpha??.6):.16;if(isLand){cr=cr*(1-al)+c[0]*al;cg=cg*(1-al)+c[1]*al;cb=cb*(1-al)+c[2]*al}else if(((Math.floor(zz)%2)+2)%2){cr=cr*(1-al)+90*al;cg=cg*(1-al)+150*al;cb=cb*(1-al)+200*al}}
  if(grid){const fl=Math.abs(((lat%grid)+grid*1.5)%grid-grid/2),fo=Math.abs(((lon%grid)+grid*1.5)%grid-grid/2),cl=Math.max(.1,Math.cos(lat*D2R));if(fl>grid/2-gw||fo>grid/2-gw/cl){cr=cr*.72+255*.28;cg=cg*.72+255*.28;cb=cb*.72+255*.28}}
  if(o.highlightLat!=null&&Math.abs(lat-o.highlightLat)<Math.max(.35,1.5*pix*R2D)){cr=255;cg=90;cb=60}
  const cosI=p0*S[0]+p1*S[1]+p2*S[2],day=Math.max(0,Math.min(1,(cosI+0.035)/0.07)),shade=(0.62+0.38*Math.max(0,cosI))*day+(1-night)*(1-day);
  const k=(j*W+i)*4,edge=Math.min(1,(1-Math.sqrt(rr))*R*1.2+.15);
  px[k]=px[k]*(1-edge)+Math.min(255,cr*shade+(1-day)*6)*edge;px[k+1]=px[k+1]*(1-edge)+Math.min(255,cg*shade+(1-day)*10)*edge;px[k+2]=px[k+2]*(1-edge)+Math.min(255,cb*shade+(1-day)*28)*edge;px[k+3]=255}}
 ctx.putImageData(img,x0,y0);
}
/* proyección de un punto geográfico en el globo: devuelve {x,y,front} */
function project(o,lat,lon){const E90=V.cross(o.N,o.E0),c=Math.cos(lat*D2R),p=V.add(V.add(V.mul(o.E0,c*Math.cos(lon*D2R)),V.mul(E90,c*Math.sin(lon*D2R))),V.mul(o.N,Math.sin(lat*D2R)));return {x:o.cx+o.R*V.dot(p,o.right),y:o.cy-o.R*V.dot(p,o.up),front:V.dot(p,o.toward)>0,p}}
/* colores de husos: paleta cíclica suave; husos de media hora y de 3/4 en rosa */
const ZC=[[244,201,107],[150,203,138],[129,182,224],[226,150,120],[183,160,214],[118,196,186]];
function zoneColor(z){if(z!==Math.round(z))return [240,120,170];return ZC[((Math.round(z)%6)+6)%6]}
/* planisferio equirrectangular */
function flatMap(ctx,o){
 const dpr=o.dpr||1,x0=Math.round(o.x*dpr),y0=Math.round(o.y*dpr),W=Math.round(o.w*dpr),H=Math.round(o.h*dpr),img=ctx.createImageData(W,H),px=img.data,L=o.land,tz=o.tz,S=o.sunLatLon;
 const sd=S?S.lat*D2R:0,sl=S?S.lon:0,sinD=Math.sin(sd),cosD=Math.cos(sd);
 for(let j=0;j<H;j++){const lat=o.north-(j+.5)/H*(o.north-o.south),sinL=Math.sin(lat*D2R),cosL=Math.cos(lat*D2R);for(let i=0;i<W;i++){const lon=o.west+(i+.5)/W*(o.east-o.west);
  const isLand=L?sample(L,lat,lon)>127:false;let cr,cg,cb;if(isLand){if(lat<-60||(lat>59&&lon>-75&&lon<-10)){cr=226;cg=232;cb=236}else{cr=124;cg=166;cb=98}}else{cr=40;cg=104;cb=150}
  if(o.tzMode&&(tz||o.tzMode==='teoricos')){const z=o.tzMode==='teoricos'?Math.max(-12,Math.min(12,Math.round(lon/15))):zoneAt(tz,lat,lon),c=zoneColor(z),a=isLand?(o.tzAlpha??.6):.16;if(isLand){cr=cr*(1-a)+c[0]*a;cg=cg*(1-a)+c[1]*a;cb=cb*(1-a)+c[2]*a}else{const odd=((Math.floor(z)%2)+2)%2;if(odd){cr=cr*(1-a)+90*a;cg=cg*(1-a)+150*a;cb=cb*(1-a)+200*a}}}
  let shade=1;if(S){const cosI=sinL*sinD+cosL*cosD*Math.cos((lon-sl)*D2R),day=Math.max(0,Math.min(1,(cosI+0.06)/0.12));shade=0.34+0.66*day}
  const k=(j*W+i)*4;px[k]=cr*shade;px[k+1]=cg*shade;px[k+2]=cb*shade+(1-shade)*30;px[k+3]=255}}
 ctx.putImageData(img,x0,y0);
}
window.AulaTierra={zoneColor,V,D2R,R2D,EPS,sun,dayLength,noonAltitude,land,zones,sample,zoneAt,globe,project,flatMap};
})();
