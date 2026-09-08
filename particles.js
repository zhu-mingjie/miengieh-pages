/* Continuous monochrome particle swells. No document shapes or text masks. */
(() => {
  'use strict';
  const SETTINGS = Object.freeze({spacing:10,mobileSpacing:11,dpr:1.5,mobileDpr:1.3,fps:40,mobileFps:30,edgeFade:65});
  const art=document.querySelector('.particle-art'),canvas=document.querySelector('#particles');
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
  const buckets=Array.from({length:16},()=>[]);
  let width=0,height=0,points=[],frame=0,last=0,elapsed=0,visible=true,mobile=false;
  function resize(){
    width=art.clientWidth;height=art.clientHeight;mobile=width<600;
    const dpr=Math.min(devicePixelRatio||1,mobile?SETTINGS.mobileDpr:SETTINGS.dpr);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const gap=mobile?SETTINGS.mobileSpacing:SETTINGS.spacing;points=[];
    let seed=7301;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
    // A broad, continuous sheet extending beyond the viewport. Its folds compress
    // and spread the dots, creating rolling density rather than moving flat noise.
    for(let y=-height*.35;y<height*1.35;y+=gap)for(let x=-width*.2;x<width*1.2;x+=gap){
      points.push({x:x+(random()-.5)*gap*.42,y:y+(random()-.5)*gap*.42,r:.45+random()*.65,tone:Math.floor(25+random()*100),alpha:.18+random()*.28});
    }
    draw();
  }
  function draw(){
    const t=reduced.matches?0:elapsed*.30;
    ctx.clearRect(0,0,width,height);art.dataset.phase='continuous-swells';
    for(const bucket of buckets)bucket.length=0;
    const scale=Math.min(width,1300),edge=Math.min(SETTINGS.edgeFade,width*.08);
    for(const p of points){
      const u=p.x/width,v=p.y/height;
      const a=u*7.6+v*2.8-t,b=v*8.4-u*3.2+t*.73;
      const fold=Math.sin(a+Math.sin(b)*.75),cross=Math.cos(b+Math.cos(a)*.55);
      const x=p.x+scale*.075*cross+scale*.035*Math.sin(v*5.7+t*.61);
      const y=p.y+height*.115*fold+height*.045*Math.sin(u*11-v*4+t*.84);
      if(x<0||x>width||y<0||y>height)continue;
      const crest=(fold+1)*.5;
      const fade=smooth(x/edge)*smooth((width-x)/edge)*smooth(y/edge)*smooth((height-y)/edge);
      const alpha=p.alpha*(.24+.76*crest)*fade;
      const shade=Math.round(alpha*(1-p.tone/255)*40);
      if(shade>0)buckets[Math.min(15,shade)].push(x,y,p.r*(.7+crest*.55));
    }
    // Batch equal grey levels: one fill per shade, not one per particle.
    for(let i=1;i<buckets.length;i++){
      ctx.fillStyle=`rgba(0,0,0,${i/40})`;ctx.beginPath();const bucket=buckets[i];
      for(let j=0;j<bucket.length;j+=3){ctx.moveTo(bucket[j]+bucket[j+2],bucket[j+1]);ctx.arc(bucket[j],bucket[j+1],bucket[j+2],0,Math.PI*2);}
      ctx.fill();
    }
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
