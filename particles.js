/* Continuous monochrome particle swells. No document shapes or text masks. */
(() => {
  'use strict';
  const SETTINGS = Object.freeze({spacing:3.5,mobileSpacing:3,dpr:1.5,mobileDpr:1.3,fps:40,mobileFps:30,edgeFade:160,speed:.65,blankFraction:.5});
  const art=document.querySelector('.particle-art'),canvas=document.querySelector('#particles');
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const buckets=Array.from({length:32},()=>[]);
  let width=0,height=0,points=[],frame=0,last=0,elapsed=0,visible=true,mobile=false;
  function resize(){
    width=art.clientWidth;height=art.clientHeight;mobile=width<600;
    const dpr=Math.min(devicePixelRatio||1,mobile?SETTINGS.mobileDpr:SETTINGS.dpr);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const gap=Math.max(mobile?SETTINGS.mobileSpacing:SETTINGS.spacing,Math.sqrt(width*height*1.44/(mobile?65000:150000)));points=[];
    let seed=7301;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    // A broad, continuous sheet extending beyond the viewport. Its folds compress
    // and spread the dots, creating rolling density rather than moving flat noise.
    for(let y=-height*.1;y<height*1.1;y+=gap)for(let x=-width*.1;x<width*1.1;x+=gap){
      points.push({x:x+(random()-.5)*gap*.16,y:y+(random()-.5)*gap*.16,r:.72,tone:25,alpha:.92});
    }
    draw();
  }
  function draw(){
    const t=reduced.matches?0:elapsed*SETTINGS.speed;
    ctx.clearRect(0,0,width,height);art.dataset.phase='continuous-swells';
    // Continuous water-ripple field, with its lower half left transparent;
    // the rest remains completely transparent, including the background tint.
    const cols=65,rows=49,field=new Float32Array(cols*rows);
    // Independent swelling eddies: unequal footprints, speeds and curved paths.
    // No shared travelling-wave direction or fixed-size repeating bands.
    const eddies=Array.from({length:7},(_,i)=>{
      const phase=i*2.399963,rate=.48+(i%4)*.13;
      const pulse=.5+.5*Math.sin(t*rate+phase);
      return {x:.5+.39*Math.sin(phase+t*(.10+(i%3)*.055))+.08*Math.cos(t*.7+phase),
        y:.5+.36*Math.cos(phase*1.71-t*(.14+(i%4)*.035))+.07*Math.sin(t*.58+phase),
        rx:.13+(i%3)*.025+pulse*.09,ry:.105+(i%4)*.019+pulse*.07,
        angle:phase+Math.sin(t*.36+phase)*1.1,amplitude:.7+pulse*.65};
    });
    function cloud(u,v){
      const x=u+.012*Math.sin(v*10+t*.73)+.008*Math.cos(u*8-v*6-t*.61);
      const y=v+.012*Math.cos(u*9-t*.67)+.008*Math.sin(v*11+u*5+t*.81);
      let value=0;
      for(const e of eddies){const dx=x-e.x,dy=y-e.y,c=Math.cos(e.angle),s=Math.sin(e.angle);const px=(dx*c+dy*s)/e.rx,py=(-dx*s+dy*c)/e.ry;value+=e.amplitude*Math.exp(-(px*px+py*py)*1.5);}
      return value;
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)field[j*cols+i]=cloud(i/(cols-1),j/(rows-1));
    const sorted=Array.from(field).sort((a,b)=>a-b),threshold=sorted[Math.floor(sorted.length*SETTINGS.blankFraction)];
    function density(x,y){const gx=Math.min(cols-1.001,Math.max(0,x/width*(cols-1))),gy=Math.min(rows-1.001,Math.max(0,y/height*(rows-1)));const i=Math.floor(gx),j=Math.floor(gy),u=gx-i,v=gy-j,k=j*cols+i;const value=(field[k]*(1-u)+field[k+1]*u)*(1-v)+(field[k+cols]*(1-u)+field[k+cols+1]*u)*v;return smooth((value-threshold)/.65);}
    for(const bucket of buckets)bucket.length=0;
    const scale=Math.min(width,1300),edge=Math.min(SETTINGS.edgeFade,width*.22,height*.24);
    for(const p of points){
      const u=p.x/width,v=p.y/height;
      const a=u*17.5+v*6.4-t,b=v*19.3-u*7.4+t*.73;
      const fold=Math.sin(a+Math.sin(b)*.75),cross=Math.cos(b+Math.cos(a)*.55);
      const x=p.x+scale*.0095*cross+scale*.0052*Math.sin(v*13.1+t*.61);
      const y=p.y+height*.0152*fold+height*.0078*Math.sin(u*25.3-v*9.2+t*.84);
      if(x<0||x>width||y<0||y>height)continue;
      const cloudDensity=density(x,y);if(cloudDensity<=0)continue;
      const crest=cloudDensity;
      const fade=smooth(x/edge)*smooth((width-x)/edge)*smooth(y/edge)*smooth((height-y)/edge);
      const alpha=p.alpha*crest*fade;
      const shade=Math.round(alpha*(1-p.tone/255)*40);
      if(shade>0)buckets[Math.min(31,shade)].push(x,y,p.r*(.12+crest*1.55)*Math.sqrt(fade));
    }
    // Batch equal grey levels: one fill per shade, not one per particle.
    for(let i=1;i<buckets.length;i++){
      ctx.fillStyle=`rgba(0,0,0,${i/80})`;ctx.beginPath();const bucket=buckets[i];
      for(let j=0;j<bucket.length;j+=3){ctx.moveTo(bucket[j]+bucket[j+2],bucket[j+1]);ctx.arc(bucket[j],bucket[j+1],bucket[j+2],0,Math.PI*2);}
      ctx.fill();
    }
    ctx.globalCompositeOperation="destination-in";
    for(const horizontal of [true,false]){const span=horizontal?width:height;const g=ctx.createLinearGradient(0,0,horizontal?width:0,horizontal?0:height);const f=Math.min(.3,edge/span);g.addColorStop(0,"transparent");g.addColorStop(f,"black");g.addColorStop(1-f,"black");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);}
    ctx.globalCompositeOperation="source-over";
  }
  function tick(now){
    frame=0;if(document.hidden||!visible||reduced.matches){last=0;return;}
    if(!last||now-last>=1000/(mobile?SETTINGS.mobileFps:SETTINGS.fps)){
      elapsed+=last?Math.min((now-last)/1000,.1):0;last=now;draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){cancelAnimationFrame(frame);last=0;draw();if(!document.hidden&&visible&&!reduced.matches)frame=requestAnimationFrame(tick);}
  document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(art);else window.addEventListener('resize',resize,{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(art);
  resize();art.classList.add('ready');sync();
})();
