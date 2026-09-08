/* Canvas 2D: overhead flow, accelerated gathering, sinking browser, floating paper.
 * All timings, density and motion controls live here. No external libraries.
 */
(() => {
  'use strict';
  const SETTINGS = Object.freeze({
    stages: [ ['water', 2.8], ['browser-gather', 2.7], ['browser-hold', 2.3],
      ['browser-sink', 3.0], ['water-gap', 1.4], ['paper-gather', 2.7],
      ['paper-hold', 3.0], ['paper-lift', 3.3], ['water-return', 2.8] ],
    // Slow attraction / rapid pull / brief landing. Interpolated positions, not opacity.
    gathering: [[0,0],[.4,.065],[.76,.91],[1,1]],
    areaPerParticle: 155, mobileAreaPerParticle: 115,
    maxParticles: 15000, mobileMaxParticles: 4200, shapeFraction: .40,
    desktopDpr: 1.5, mobileDpr: 1.3, fps: 40, mobileFps: 30,
    flowCell: 72, maskCell: 14, flowSpeed: 12, edgeFade: 78,
    textPadding: 22, attractionStrength: 1, browserDrop: .17, paperRise: .20
  });
  const art = document.querySelector('.particle-art');
  const canvas = document.querySelector('#particles');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const TAU = Math.PI * 2;
  const total = SETTINGS.stages.reduce((sum, s) => sum + s[1], 0);
  const clamp = v => Math.max(0, Math.min(1, v));
  const smooth = v => { const x=clamp(v); return x*x*(3-2*x); };
  const mix = (a,b,t) => a+(b-a)*t;
  let width=0,height=0,mobile=false,points=[],flowX,flowY,flowCols,flowRows;
  let density,maskCols,maskRows,frame=0,last=0,elapsed=0,visible=true,layoutFrame=0;
  let pointer={x:-10000,y:-10000},seed=7301;
  const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const browser=[],paper=[];
  function line(target,x1,y1,x2,y2,step=.011) {
    const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/step);
    for(let i=0;i<=n;i++)target.push([mix(x1,x2,i/n),mix(y1,y2,i/n)]);
  }
  // Browser outline, title bar, three dots, headline, image and text columns.
  [[-1,-.66,1,-.66],[1,-.66,1,.66],[1,.66,-1,.66],[-1,.66,-1,-.66],[-1,-.47,1,-.47],[-.82,-.28,.16,-.28],[-.82,-.23,-.1,-.23]].forEach(v=>line(browser,...v));
  for(let k=0;k<3;k++)for(let i=0;i<16;i++){const a=i/16*TAU;browser.push([-.87+k*.09+Math.cos(a)*.021,-.565+Math.sin(a)*.021]);}
  for(let y=-.1;y<.53;y+=.055)line(browser,-.82,y,y<.12?.12:.83,y,.021);
  for(let y=-.29;y<.08;y+=.035)line(browser,.34,y,.83,y,.035);
  [[-.59,-.87,.34,-.87],[.34,-.87,.60,-.61],[.60,-.61,.60,.87],[.60,.87,-.59,.87],[-.59,.87,-.59,-.87],[.34,-.87,.34,-.61],[.34,-.61,.60,-.61]].forEach(v=>line(paper,...v));
  for(let y=-.51;y<-.32;y+=.04)line(paper,-.42,y,.39,y);
  for(let y=-.13;y<.68;y+=.052)line(paper,-.42,y,y>.58?.19:.43,y,.021);

  function phaseAt(time) {
    let t=time%total;
    for(const [name,duration] of SETTINGS.stages){if(t<duration)return{name,progress:t/duration};t-=duration;}
    return{name:'water',progress:0};
  }
  function gather(progress) {
    const keys=SETTINGS.gathering;
    for(let i=1;i<keys.length;i++)if(progress<=keys[i][0]){
      const a=keys[i-1],b=keys[i];return mix(a[1],b[1],smooth((progress-a[0])/(b[0]-a[0])));
    }
    return 1;
  }
  // A continuous 2D curl field sampled on a coarse grid, plus slow local convergence.
  // It fills the plane: no wave bands, rows or side-view sea surfaces.
  function updateFlow(time) {
    const cell=SETTINGS.flowCell;
    for(let j=0;j<flowRows;j++)for(let i=0;i<flowCols;i++){
      // Periodic potential makes opposite boundaries agree, preventing long-run
      // accumulation at the wrap seam. The curl preserves area; breathing is bounded.
      const x=i*cell/width*TAU,y=j*cell/height*TAU,t=time*.10;
      const a=x+2*y+t,b=2*x-y-t*.73,c=3*x+3*y+t*.46;
      const scale=Math.min(width,height);
      let vx=(Math.cos(a)*2-Math.cos(b)*.57+Math.cos(c)*3*.18)*scale/height;
      let vy=(-Math.cos(a)-Math.cos(b)*2*.57-Math.cos(c)*3*.18)*scale/width;
      const breathing=Math.sin(time*.13)*.10;
      vx+=Math.sin(x)*breathing;vy+=Math.cos(y)*breathing;
      flowX[j*flowCols+i]=vx*SETTINGS.flowSpeed;flowY[j*flowCols+i]=vy*SETTINGS.flowSpeed;
    }
  }
  function sample(grid,cols,rows,x,y,cell) {
    const gx=Math.max(0,Math.min(cols-1.001,x/cell)),gy=Math.max(0,Math.min(rows-1.001,y/cell));
    const ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy,k=iy*cols+ix;
    return mix(mix(grid[k],grid[k+1],u),mix(grid[k+cols],grid[k+cols+1],u),v);
  }
  function textRegions() {
    const origin=art.getBoundingClientRect(),regions=[];
    for(const el of document.querySelectorAll('.hero h1,.hero-description,.site-header .header-product,.site-header .logo')){
      let rects;
      if(el.classList.contains('logo'))rects=[el.getBoundingClientRect()];
      else {const range=document.createRange();range.selectNodeContents(el);rects=[...range.getClientRects()];}
      for(const r of rects)if(r.width>2&&r.height>2)regions.push({
        x:r.left-origin.left+r.width/2,y:r.top-origin.top+r.height/2,
        rx:r.width*.56+SETTINGS.textPadding,ry:r.height*.67+SETTINGS.textPadding
      });
    }
    return regions;
  }
  function rebuildMask() {
    const regions=textRegions(),cell=SETTINGS.maskCell;
    maskCols=Math.ceil(width/cell)+2;maskRows=Math.ceil(height/cell)+2;
    density=new Float32Array(maskCols*maskRows);
    const edge=Math.min(SETTINGS.edgeFade,width*.12,height*.10);
    for(let j=0;j<maskRows;j++)for(let i=0;i<maskCols;i++){
      const x=i*cell,y=j*cell;
      let value=smooth(x/edge)*smooth((width-x)/edge)*smooth(y/edge)*smooth((height-y)/edge);
      for(const r of regions){
        const distance=Math.hypot((x-r.x)/r.rx,(y-r.y)/r.ry);
        value*=.025+.975*smooth((distance-.64)/.65);
      }
      density[j*maskCols+i]=value;
    }
  }
  function resize() {
    const nextW=art.clientWidth,nextH=art.clientHeight;
    const changed=nextW!==width||nextH!==height;
    width=nextW;height=nextH;mobile=width<600;
    if(changed){
      const dpr=Math.min(devicePixelRatio||1,mobile?SETTINGS.mobileDpr:SETTINGS.desktopDpr);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
      const count=Math.min(mobile?SETTINGS.mobileMaxParticles:SETTINGS.maxParticles,Math.round(width*height/(mobile?SETTINGS.mobileAreaPerParticle:SETTINGS.areaPerParticle)));
      seed=7301;
      points=Array.from({length:count},(_,i)=>({
        x:random()*width,y:random()*height,r:.6+random()*.83,opacity:.25+random()*.43,
        rank:random(),phase:random()*TAU,drift:random(),
        shape:i<count*SETTINGS.shapeFraction,
        browser:browser[Math.floor(i/Math.ceil(count*SETTINGS.shapeFraction)*browser.length)%browser.length],
        paper:paper[Math.floor(i/Math.ceil(count*SETTINGS.shapeFraction)*paper.length)%paper.length]
      }));
      flowCols=Math.ceil(width/SETTINGS.flowCell)+2;flowRows=Math.ceil(height/SETTINGS.flowCell)+2;
      flowX=new Float32Array(flowCols*flowRows);flowY=new Float32Array(flowCols*flowRows);
    }
    rebuildMask();draw(0);
  }
  function draw(dt) {
    const time=reduced.matches?14.7:elapsed;
    const stage=reduced.matches?{name:'paper-hold',progress:.45}:phaseAt(time);
    art.dataset.phase=stage.name;
    const isBrowser=stage.name.startsWith('browser'),isPaper=stage.name.startsWith('paper');
    const assembling=stage.name.endsWith('gather'),leaving=stage.name.endsWith('sink')||stage.name.endsWith('lift');
    const exit=leaving?stage.progress:0;
    let weight=(isBrowser||isPaper)?1:0;
    if(assembling)weight=gather(stage.progress)*SETTINGS.attractionStrength;
    if(leaving)weight=1-smooth((exit-.58)/.42);
    updateFlow(time);
    ctx.clearRect(0,0,width,height);
    const scale=Math.min(width*(mobile?.42:.29),height*.37,420);
    const centerX=width*(mobile?.57:.76),centerY=height*.48;
    const angle=isPaper?Math.sin(time*.85)*.12+Math.sin(time*.31)*.055:0;
    for(const p of points){
      if(dt>0){
        p.x+=sample(flowX,flowCols,flowRows,p.x,p.y,SETTINGS.flowCell)*dt;
        p.y+=sample(flowY,flowCols,flowRows,p.x,p.y,SETTINGS.flowCell)*dt;
        // Wrapped particles are fully transparent at the edges on both sides.
        if(p.x<0)p.x+=width;else if(p.x>width)p.x-=width;
        if(p.y<0)p.y+=height;else if(p.y>height)p.y-=height;
      }
      let x=p.x,y=p.y,alpha=p.opacity;
      if(p.shape&&weight>0){
        const pair=isBrowser?p.browser:p.paper;
        let sx=pair[0],sy=pair[1];
        if(isPaper){
          const yaw=Math.sin(time*.63)*.24;
          const z=Math.sin(sy*2.4+time*.8)*.10+sx*sx*Math.sin(time*.5)*.10;
          sx=sx*Math.cos(yaw)+z*Math.sin(yaw);
          const px=sx*Math.cos(angle)-sy*Math.sin(angle);
          sy=sx*Math.sin(angle)+sy*Math.cos(angle);sx=px;
          sy+=Math.sin(time*.9)*.025;
        }
        if(leaving){
          const expansion=exit*exit;
          sx+=Math.cos(p.phase+time*.15)*expansion*.65;
          sy+=Math.sin(p.phase+time*.19)*expansion*.38;
        }
        const targetX=centerX+sx*scale;
        const targetY=centerY+sy*scale+(isBrowser?1:-1)*height*(isBrowser?SETTINGS.browserDrop:SETTINGS.paperRise)*smooth(exit);
        x=mix(p.x,targetX,weight);y=mix(p.y,targetY,weight);
        alpha*=1+weight*.24;
        if(leaving)alpha*=mix(1-smooth(exit/.85),1,smooth((exit-.73)/.27));
      }
      if(finePointer.matches&&!reduced.matches){const dx=x-pointer.x,dy=y-pointer.y,d=Math.hypot(dx,dy);if(d>0&&d<110){const push=Math.pow(1-d/110,2)*12;x+=dx/d*push;y+=dy/d*push;}}
      const local=sample(density,maskCols,maskRows,x,y,SETTINGS.maskCell);
      // Each particle has a stable rank: fewer particles remain visible in sparse
      // regions, with smooth alpha transitions instead of threshold popping.
      alpha*=smooth((local-p.rank*.72)/.28)*(.32+.68*local);
      if(alpha<.003)continue;
      ctx.fillStyle=`rgba(35,35,35,${alpha})`;
      ctx.beginPath();ctx.arc(x,y,p.r*(mobile?.84:1),0,TAU);ctx.fill();
    }
  }
  function tick(now) {
    frame=0;
    if(document.hidden||!visible||reduced.matches){last=0;return;}
    const interval=1000/(mobile?SETTINGS.mobileFps:SETTINGS.fps);
    if(!last||now-last>=interval){
      const dt=last?Math.min((now-last)/1000,.10):0;last=now;elapsed+=dt;draw(dt);
    }
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);last=0;frame=0;draw(0);
    if(!document.hidden&&visible&&!reduced.matches)frame=requestAnimationFrame(tick);
  }
  function scheduleLayout(){cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(resize);}
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  document.querySelector('.hero').addEventListener('pointermove',event=>{
    if(!finePointer.matches||reduced.matches)return;
    const r=art.getBoundingClientRect();pointer={x:event.clientX-r.left,y:event.clientY-r.top};
  },{passive:true});
  document.querySelector('.hero').addEventListener('pointerleave',()=>{pointer={x:-10000,y:-10000};});
  if('ResizeObserver' in window){const observer=new ResizeObserver(scheduleLayout);observer.observe(art);document.querySelectorAll('.hero-copy,.site-header').forEach(el=>observer.observe(el));}
  else window.addEventListener('resize',scheduleLayout,{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(art);
  document.fonts.ready.then(scheduleLayout);
  resize();art.classList.add('ready');sync();
})();
