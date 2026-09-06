(() => {
  'use strict';
  document.querySelector('#year').textContent = new Date().getFullYear();
  const urls = window.MIENGIEH_DOWNLOAD_URLS || {};
  let activeLinks = 0;
  document.querySelectorAll('[data-download]').forEach(button => {
    const url = urls[button.dataset.download];
    if (typeof url === 'string' && /^https:\/\//i.test(url)) {
      try {
        const parsed = new URL(url);
        if (!parsed.hostname) return;
        const link = document.createElement('a');
        link.className = button.className;
        link.href = parsed.href;
        link.innerHTML = button.innerHTML;
        button.replaceWith(link);
        activeLinks++;
      } catch (_) { /* Keep the safe placeholder if configuration is invalid. */ }
    } else {
      button.addEventListener('click', () => {
        document.querySelector('#download-status').textContent =
          button.dataset.download === 'github' ? 'The GitHub download link is not available yet.' : 'The Chrome Web Store link is not available yet.';
      });
    }
  });
  if (activeLinks === 2) document.querySelector('#download-status').textContent = '';
  else if (activeLinks === 1) document.querySelector('#download-status').textContent = 'One download link is not available yet.';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!reduced.matches) entry.target.classList.add('entered');
        reveal.unobserve(entry.target);
      }
    }), { threshold: .12 });
    document.querySelectorAll('.reveal').forEach(el => reveal.observe(el));
  }
  const canvas = document.querySelector('#particles');
  const context = canvas.getContext('2d');
  if (!context) return;
  const art = canvas.parentElement;
  const hero = document.querySelector('.hero');
  const finePointer = matchMedia('(pointer: fine)');
  const TAU = Math.PI * 2;
  let width = 0, height = 0, frame = 0, visible = true, points = [], time = 0, last = 0;
  let pointer = { x: -10000, y: -10000 };
  let seed = 43;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const t = clamp(x); return t*t*(3-2*t); };
  const mix = (a,b,t) => a+(b-a)*t;
  const browser = [], paper = [];
  function line(target,x1,y1,x2,y2,step=.018) {
    const n = Math.ceil(Math.hypot(x2-x1,y2-y1)/step);
    for(let i=0;i<=n;i++) target.push([mix(x1,x2,i/n),mix(y1,y2,i/n)]);
  }
  [[-1,-.61,1,-.61],[1,-.61,1,.61],[1,.61,-1,.61],[-1,.61,-1,-.61],[-1,-.45,1,-.45]].forEach(v=>line(browser,...v));
  for(let y=-.28;y<.48;y+=.06)line(browser,-.85,y,y<.06?.1:.78,y,.025);
  for(let y=-.28;y<.01;y+=.04)line(browser,.3,y,.82,y,.03);
  [[-.55,-.88,.32,-.88],[.32,-.88,.59,-.61],[.59,-.61,.59,.88],[.59,.88,-.55,.88],[-.55,.88,-.55,-.88],[.32,-.88,.32,-.61],[.32,-.61,.59,-.61]].forEach(v=>line(paper,...v));
  for(let y=-.5;y<-.28;y+=.04)line(paper,-.43,y,.4,y);
  for(let y=-.1;y<.69;y+=.055)line(paper,-.43,y,y>.6?.2:.44,y,.025);
  function resize() {
    width=art.clientWidth;height=art.clientHeight;
    const mobile=width<600;
    const dpr=Math.min(devicePixelRatio||1,mobile?1.4:1.65);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    context.setTransform(dpr,0,0,dpr,0,0);
    seed=43;
    // Linear draw cost; no pairwise particle calculations or external libraries.
    const shapeCount=mobile?680:1500, ribbonCount=mobile?480:1800;
    points=Array.from({length:shapeCount+ribbonCount},(_,i)=>({
      kind:i<shapeCount?0:1,
      a:browser[Math.floor((i%shapeCount)/shapeCount*browser.length)],
      b:paper[Math.floor((i%shapeCount)/shapeCount*paper.length)],
      u:i<shapeCount?random():((i-shapeCount)%(mobile?60:100))/(mobile?59:99),
      v:i<shapeCount?random():Math.floor((i-shapeCount)/(mobile?60:100))/(mobile?7:17),
      phase:random()*TAU,depth:random(),
      r:.55+random()*1.05,alpha:.22+random()*.52
    }));
    draw();
  }
  function draw() {
    context.clearRect(0,0,width,height);
    const seconds=reduced.matches?8:time/1000;
    const cycle=seconds%18;
    const morph=smooth((cycle-2.4)/4.8)*(1-smooth((cycle-14)/4));
    const dissolve=smooth((cycle-10)/3)*(1-smooth((cycle-15)/3));
    const scale=Math.min(width*.37,height*.43);
    const rotation=Math.sin(seconds*.29)*.15;
    let previous=null;
    for(const p of points) {
      let x,y,z,alpha=p.alpha;
      if(p.kind===0) {
        const t=smooth(morph*1.2-p.depth*.2);
        const flow=Math.sin(t*Math.PI);
        let sx=mix(p.a[0],p.b[0],t),sy=mix(p.a[1],p.b[1],t);
        sx+=Math.sin(sy*4+p.phase+seconds*.7)*flow*.27;
        sy+=Math.cos(sx*3+p.phase+seconds*.4)*flow*.2;
        const angle=p.phase+seconds*.22;
        sx=mix(sx,Math.cos(angle)*(1+p.u*1.1),dissolve);
        sy=mix(sy,Math.sin(angle)*(.5+p.v),dissolve);
        z=Math.sin(sy*2.2+seconds*.5)*(.08+flow*.32)+p.depth*.08;
        x=(sx*Math.cos(rotation)+z*Math.sin(rotation))*scale+width*.5;
        y=sy*scale+height*.48;
        alpha*=.65+.35*(1-dissolve);
      } else {
        // A broad, layered ribbon sweeps across the entire first screen.
        const u=p.u, lane=(p.v-.5);
        const wave=u*TAU*1.22+seconds*.24;
        x=(u*1.3-.15)*width;
        y=height*(.5+Math.sin(wave)*.29)+lane*height*(.12+.12*Math.pow(Math.cos(wave),2));
        y+=Math.sin(u*13-seconds*.35+lane*3)*height*.045;
        x+=Math.sin(lane*6+seconds*.18)*height*.035;
        z=(Math.cos(wave+lane*2)+1)*.5;
        alpha*=.42+z*.4;
      }
      if(!reduced.matches){x+=Math.sin(seconds*.8+p.phase)*2;y+=Math.cos(seconds*.6+p.phase)*2;}
      if(finePointer.matches&&!reduced.matches){
        const dx=x-pointer.x,dy=y-pointer.y,d=Math.hypot(dx,dy);
        if(d>0&&d<150){const push=Math.pow(1-d/150,2)*28;x+=dx/d*push;y+=dy/d*push;}
      }
      // Tone down particles under the reading area, in addition to the CSS veil.
      const textDistance=Math.pow((x-width*.5)/(width*.35),2)+Math.pow((y-height*.46)/(height*.24),2);
      alpha*=.25+.75*smooth(textDistance);
      const radius=p.r*(.7+(z||0)*.35)*(width<600?.8:1);
      context.fillStyle=`rgba(30,30,30,${alpha})`;
      context.beginPath();context.arc(x,y,radius,0,TAU);context.fill();
      if(p.kind===1&&previous&&p.u<.1&&Math.hypot(x-previous.x,y-previous.y)<65){
        context.strokeStyle=`rgba(70,70,70,${alpha*.13})`;context.lineWidth=.5;
        context.beginPath();context.moveTo(previous.x,previous.y);context.lineTo(x,y);context.stroke();
      }
      previous={x,y};
    }
  }
  function tick(now) {
    frame=0;
    if(document.hidden||!visible||reduced.matches){last=0;return;}
    // Cap painting at 40fps; time remains based on elapsed milliseconds.
    if(!last||now-last>=25){if(last)time+=Math.min(now-last,100);last=now;draw();}
    frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame);frame=0;last=0;
    draw();
    if(!document.hidden&&visible&&!reduced.matches)frame=requestAnimationFrame(tick);
  }
  hero.addEventListener('pointermove',event=>{
    if(!finePointer.matches||reduced.matches)return;
    const bounds=art.getBoundingClientRect();pointer={x:event.clientX-bounds.left,y:event.clientY-bounds.top};
  },{passive:true});
  hero.addEventListener('pointerleave',()=>{pointer={x:-10000,y:-10000};});
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(art);
  else window.addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(art);
  resize();art.classList.add('ready');sync();
})();
