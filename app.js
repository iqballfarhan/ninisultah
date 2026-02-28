// Minimal WebAudio-based backsound (no external audio files)
let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let scheduled = [];
let audioElement = null;
let audioSourceNode = null;

const notes = [
  {f: 523.25, d: 0.45}, // C5
  {f: 659.25, d: 0.45}, // E5
  {f: 783.99, d: 0.45}, // G5
  {f: 1046.5, d: 0.7}, // C6
];

function ensureAudio(){
  if (!audioCtx){
    console.log('[audio] creating AudioContext');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = parseFloat(document.getElementById('volume').value || '0.6');
    masterGain.connect(audioCtx.destination);
    console.log('[audio] masterGain initialized, volume=', masterGain.gain.value, 'state=', audioCtx.state);
    // If there's an <audio> element with a src, connect it to the AudioContext so
    // we can control its volume via masterGain and obey resume policies.
    audioElement = document.getElementById('bgAudio');
    if (audioElement && audioElement.getAttribute('src')){
      try{
        audioSourceNode = audioCtx.createMediaElementSource(audioElement);
        audioSourceNode.connect(masterGain);
        console.log('[audio] media element source connected for', audioElement.getAttribute('src'));
      }catch(e){
        console.warn('[audio] could not createMediaElementSource:', e);
        audioSourceNode = null;
      }
    }
  }
}

function scheduleLoop(){
  if (!audioCtx) return;
  const start = audioCtx.currentTime + 0.05;
  console.log('[audio] scheduleLoop starting at', start);
  let t = start;
  for (let i=0;i<notes.length;i++){
    const n = notes[i];
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.f;
    console.log('[audio] scheduling note', i, 'freq=', n.f, 'dur=', n.d, 'at', t.toFixed(3));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t+0.01);
    g.gain.linearRampToValueAtTime(0.0, t + n.d - 0.03);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + n.d);
    scheduled.push(osc);
    t += n.d;
  }
  // schedule repeating call
  const total = t - start;
  const id = setTimeout(()=>{
    if (isPlaying) scheduleLoop();
  }, total*1000 - 10);
  scheduled.push({_timeout:id});
}

function startMusic(){
  if (isPlaying) return;
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  console.log('[audio] startMusic called; audioCtx.state=', audioCtx.state);
  isPlaying = true;
  // Prefer playing local MP3 from assets; fall back to synth only if play fails.
  const src = audioElement && audioElement.getAttribute('src');
  if (src){
    const sourceLabel = document.getElementById('audioSource');
    sourceLabel && (sourceLabel.textContent = 'Sumber audio: file lokal (assets)');
    audioElement.play().then(()=>{
      console.log('[audio] playing media element');
      document.getElementById('playBtn').textContent = 'Playing...';
    }).catch((err)=>{
      console.warn('[audio] media play failed, falling back to synth:', err);
      sourceLabel && (sourceLabel.textContent = 'Sumber audio: synth (gagal putar file)');
      scheduleLoop();
      document.getElementById('playBtn').textContent = 'Playing...';
    });
  } else {
    // no src given — use synth
    document.getElementById('audioSource') && (document.getElementById('audioSource').textContent = 'Sumber audio: synth (tidak ada file)');
    scheduleLoop();
    document.getElementById('playBtn').textContent = 'Playing...';
  }
}

function stopMusic(){
  isPlaying = false;
  // stop oscillators
  console.log('[audio] stopMusic called; scheduled count=', scheduled.length);
  for (const s of scheduled){
    // Avoid using instanceof (can fail across realms). Stop anything with a stop() function.
    if (s && typeof s.stop === 'function'){
      try{ s.stop(); }catch(e){ /* ignore if already stopped */ }
    } else if (s && s._timeout) {
      clearTimeout(s._timeout);
    }
  }
  scheduled = [];
  // Pause/reset media element if present
  if (audioElement && !audioElement.paused){
    try{ audioElement.pause(); audioElement.currentTime = 0; console.log('[audio] paused media element'); }catch(e){}
  }
  document.getElementById('playBtn').textContent = 'Play Music';
}

// confetti
function runConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  const pieces = [];
  const colors = ['#ff6b6b','#ffd93d','#6bf0c3','#6b8bff','#d46bff'];
  for (let i=0;i<120;i++){
    pieces.push({x:Math.random()*w,y:Math.random()*-h, r:Math.random()*6+4, c:colors[Math.floor(Math.random()*colors.length)], vx:(Math.random()-0.5)*1.6, vy:Math.random()*2+1, rot:Math.random()*360});
  }
  let raf;
  function draw(){
    ctx.clearRect(0,0,w,h);
    for (const p of pieces){
      p.x += p.vx; p.y += p.vy; p.rot += 6;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
      ctx.restore();
      if (p.y > h + 20) { p.y = Math.random()*-h; p.x = Math.random()*w; }
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  setTimeout(()=>{ cancelAnimationFrame(raf); ctx.clearRect(0,0,w,h); }, 6000);
}

function setupPhotoSlider(){
  const slides = Array.from(document.querySelectorAll('.photo-frame .photo'));
  const prevBtn = document.getElementById('prevSlide');
  const nextBtn = document.getElementById('nextSlide');
  if (!slides.length || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let autoSlideTimer = null;

  function showSlide(index){
    slides.forEach((slide, i)=>{
      slide.classList.toggle('is-active', i === index);
    });
  }

  function nextSlide(){
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }

  function prevSlide(){
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    showSlide(currentIndex);
  }

  function restartAutoSlide(){
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(()=>{
      nextSlide();
    }, 3000);
  }

  prevBtn.addEventListener('click', ()=>{
    prevSlide();
    restartAutoSlide();
  });

  nextBtn.addEventListener('click', ()=>{
    nextSlide();
    restartAutoSlide();
  });

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      autoSlideTimer = null;
      return;
    }
    restartAutoSlide();
  });

  showSlide(currentIndex);
  restartAutoSlide();
}

function setupIntroGate(){
  const gate = document.getElementById('introGate');
  const cake = gate && gate.querySelector('.intro-cake');
  const subtitle = gate && gate.querySelector('.intro-subtitle');
  const signature = document.getElementById('introSignature');
  if (!gate || !cake) return;

  const INTRO_STEP = {
    REVEAL_MESSAGE: 0,
    ENTER_PAGE: 1,
  };
  let currentStep = INTRO_STEP.REVEAL_MESSAGE;

  const enterPage = ()=>{
    document.body.classList.remove('has-intro');
    document.body.classList.add('entered');
    setTimeout(()=>{
      gate.remove();
    }, 500);
  };

  cake.addEventListener('click', ()=>{
    if (currentStep === INTRO_STEP.REVEAL_MESSAGE){
      currentStep = INTRO_STEP.ENTER_PAGE;
      if (signature){
        signature.hidden = false;
        requestAnimationFrame(()=> signature.classList.add('show'));
      }
      if (subtitle) subtitle.textContent = 'Sekali lagi klik kuenya untuk masuk 💖';
      return;
    }
    enterPage();
    startMusic();
    runConfetti();
  });
}

// wire UI
document.addEventListener('DOMContentLoaded', ()=>{
  setupIntroGate();
  setupPhotoSlider();
  document.getElementById('playBtn').addEventListener('click', ()=>{
    // user gesture required to start audio on many browsers
    startMusic();
  });
  document.getElementById('stopBtn').addEventListener('click', ()=>{
    stopMusic();
  });
  document.getElementById('volume').addEventListener('input', (e)=>{
    const v = parseFloat(e.target.value);
    if (masterGain) masterGain.gain.value = v;
    // If we couldn't connect the media element to the AudioContext, adjust audioElement.volume as a fallback
    if (audioElement && !audioSourceNode){
      audioElement.volume = v;
    }
  });
  document.getElementById('confettiBtn').addEventListener('click', ()=> runConfetti());
  window.addEventListener('resize', ()=>{
    const c=document.getElementById('confettiCanvas'); c.width=window.innerWidth; c.height=window.innerHeight;
  });
});
