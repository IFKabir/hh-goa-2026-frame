(function(){
  "use strict";

  // ============================================================
  // CONFIG
  // ============================================================
  const HASHTAG = "#FrameInGoa";
  const SHARE_TEXT = "I'm building at HH Goa 2026 🌴⚡ " + HASHTAG;
  const DEPLOYED_DOMAIN = window.location.origin; 
  
  const isPFPMode = window.PFP_MODE === true;

  let overlayPFP = null;
  let overlayBuilder = null;

  const imgPFP = new Image();
  imgPFP.src = 'assets/PFP.png';
  imgPFP.onload = () => { overlayPFP = imgPFP; if(sourceImage) render(); };

  const imgBuilder = new Image();
  imgBuilder.src = 'assets/BuilderID.png';
  imgBuilder.onload = () => { overlayBuilder = imgBuilder; if(sourceImage) render(); };

  const BUILDER_TITLES = [
    "10x Engineer", "Code Artisan", "Vercel Fanboy", "Midnight Shipper",
    "Bug Hunter", "UI/UX Wizard", "Fullstack Ninja", "Goa Local"
  ];

  // ============================================================
  // STATE
  // ============================================================
  let sourceImage = null;
  let imgNaturalW = 0, imgNaturalH = 0;
  let offsetX = 0, offsetY = 0;
  let scale = 1;
  let baseCoverScale = 1;

  let dragging = false;
  let lastPointer = {x:0, y:0};
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let generatedTitle = BUILDER_TITLES[Math.floor(Math.random() * BUILDER_TITLES.length)];

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const canvasWrap = document.getElementById('canvasWrap');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('photoInput');
  const zoomSlider = document.getElementById('zoomSlider');
  const downloadBtn = document.getElementById('downloadBtn');
  const shareBtn = document.getElementById('shareBtn');
  const toast = document.getElementById('toast');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const emptyPreview = document.getElementById('emptyPreview');
  const zoomControls = document.getElementById('zoomControls');
  const zoomHint = document.getElementById('zoomHint');
  const overlayContainer = document.getElementById('overlayInputs');
  
  // Set initial random values
  let generatedId = "HH26-" + Math.floor(100 + Math.random()*899);
  
  if (document.getElementById('builderClassInput')) {
      document.getElementById('builderClassInput').value = generatedTitle;
  }
  if (document.getElementById('builderIdDisplay')) {
      document.getElementById('builderIdDisplay').value = generatedId;
  }

  document.fonts.ready.then(() => { if(sourceImage) render(); });

  const overlayInputIds = ['nameInput', 'roleInput', 'stackInput', 'teamInput', 'builderClassInput', 'builderIdDisplay'];
  overlayInputIds.forEach(id => {
      const el = document.getElementById(id);
      if(el) {
          el.addEventListener('input', () => { if(sourceImage) render(); });
      }
  });

  // ============================================================
  // TOAST
  // ============================================================
  let toastTimer = null;
  function showToast(msg, ms){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> toast.classList.remove('show'), ms || 2600);
  }

  // ============================================================
  // FILE INPUT
  // ============================================================
  if(fileInput) {
      fileInput.addEventListener('change', (e)=>{
        if(e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });
  }
  
  if (dropzone) {
      ['dragover','dragenter'].forEach(evt=>dropzone.addEventListener(evt, (e)=>{ e.preventDefault(); dropzone.style.opacity = 0.7; }));
      ['dragleave','dragend','drop'].forEach(evt=>dropzone.addEventListener(evt, (e)=>{ e.preventDefault(); dropzone.style.opacity = 1; }));
      dropzone.addEventListener('drop', (e)=>{
        e.preventDefault();
        if(e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      });
  }

  async function handleFile(file){
    if(!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)){
      showToast("That doesn't look like an image — try a JPG, PNG, or HEIC.");
      return;
    }

    loadingOverlay.classList.add('show');

    try{
      let blob = file;
      if(file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name)){
        blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      }

      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = ()=>{
        sourceImage = img;
        imgNaturalW = img.naturalWidth;
        imgNaturalH = img.naturalHeight;
        resetTransform();
        loadingOverlay.classList.remove('show');
        emptyPreview.style.display = 'none';
        
        // Show zoom controls
        if(zoomControls) zoomControls.style.display = 'flex';
        if(zoomHint) zoomHint.style.display = 'block';

        // Enable buttons
        downloadBtn.disabled = false;
        shareBtn.disabled = false;
        
        if (overlayContainer && !isPFPMode) {
            overlayContainer.style.display = 'block';
        }
        
        render();
      };
      img.onerror = ()=>{
        loadingOverlay.classList.remove('show');
        showToast("Couldn't read that image. Try a different file.");
        resetUI();
      };
      img.src = url;
    }catch(err){
      console.error(err);
      loadingOverlay.classList.remove('show');
      showToast("Something went wrong converting that photo. Try a JPG or PNG.");
      resetUI();
    }
  }

  function resetTransform(){
    const cw = canvas.width;
    const ch = canvas.height;
    
    let maskW = cw, maskH = ch;
    if (!isPFPMode) {
      // Photo mask is roughly 340x480 in Format B
      maskW = 340; 
      maskH = 480;
    }
    
    baseCoverScale = Math.max(maskW / imgNaturalW, maskH / imgNaturalH);
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    if(zoomSlider) zoomSlider.value = 100;
  }

  function resetUI(){
    fileInput.value = '';
    sourceImage = null;
    emptyPreview.style.display = 'flex';
    if(zoomControls) zoomControls.style.display = 'none';
    if(zoomHint) zoomHint.style.display = 'none';
    if(overlayContainer) overlayContainer.style.display = 'none';
    downloadBtn.disabled = true;
    shareBtn.disabled = true;
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }

  // ============================================================
  // RENDER
  // ============================================================
  function render(){
    if(!sourceImage) return;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0,0,cw,ch);

    if(isPFPMode) {
      renderFormatA(cw, ch);
    } else {
      renderFormatB(cw, ch);
    }
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawImageToRect(ctx, px, py, pw, ph, radius) {
    ctx.save();
    
    roundRect(ctx, px, py, pw, ph, radius);
    ctx.clip();
    
    const effScale = baseCoverScale * scale;
    const drawW = imgNaturalW * effScale;
    const drawH = imgNaturalH * effScale;
    
    const photoCx = px + pw/2;
    const photoCy = py + ph/2;
    
    let dx = photoCx - drawW/2 + offsetX;
    let dy = photoCy - drawH/2 + offsetY;
    
    dx = Math.min(px, Math.max(px + pw - drawW, dx));
    dy = Math.min(py, Math.max(py + ph - drawH, dy));
    
    offsetX = dx - (photoCx - drawW/2);
    offsetY = dy - (photoCy - drawH/2);
    
    ctx.drawImage(sourceImage, dx, dy, drawW, drawH);
    ctx.restore();
  }

  // FORMAT A (Square PFP Frame)
  function renderFormatA(S, _S){
    // Background fill to prevent transparency artifacts
    ctx.fillStyle = '#0b3d2e'; 
    ctx.fillRect(0,0,S,S);

    // Draw photo (full canvas, it will be masked by the overlay's window)
    drawImageToRect(ctx, 0, 0, S, S, 0);

    if (overlayPFP) {
      ctx.drawImage(overlayPFP, 0, 0, S, S);
    }
  }

  // FORMAT B (Landscape ID Card) - 1024x784
  function renderFormatB(W, H){
    ctx.fillStyle = '#0b3d2e';
    ctx.fillRect(0,0,W,H);

    // Draw Photo exactly in the designated template box
    drawImageToRect(ctx, 65, 140, 375, 460, 18);

    // Draw template overlay
    if (overlayBuilder) {
      ctx.drawImage(overlayBuilder, 0, 0, W, H);
    }

    // Right side text
    const rx = 710;
    
    const nameEl = document.getElementById('nameInput');
    const roleEl = document.getElementById('roleInput');
    const stackEl = document.getElementById('stackInput');
    const teamEl = document.getElementById('teamInput');
    const classEl = document.getElementById('builderClassInput');
    const idEl = document.getElementById('builderIdDisplay');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const role = roleEl ? roleEl.value.trim() : '';
    const stack = stackEl ? stackEl.value.trim() : '';
    const team = teamEl ? teamEl.value.trim() : '';
    const bClass = classEl ? classEl.value.trim() : generatedTitle;
    const bId = idEl ? idEl.value.trim() : generatedId;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // BUILDER ID
    ctx.fillStyle = '#FFC700'; // Yellow
    ctx.font = `600 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(bId.toUpperCase(), rx, 188);

    // NAME
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText((name || 'YOUR NAME').toUpperCase(), rx, 256);

    // ROLE
    ctx.fillStyle = '#FF297F'; // Pink
    ctx.font = `700 20px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText((role || 'YOUR ROLE').toUpperCase(), rx, 323);

    // STACK
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 18px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText((stack || 'HTML/CSS/JS').toUpperCase(), rx, 390);

    // TEAM
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 20px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText((team || 'SOLO BUILDER').toUpperCase(), rx, 457);

    // CLASS
    ctx.fillStyle = '#FF297F';
    ctx.font = `700 20px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(bClass.toUpperCase(), rx, 525);
  }

  // ============================================================
  // POINTER / DRAG
  // ============================================================
  if(canvasWrap) {
      canvasWrap.addEventListener('pointerdown', (e)=>{
        if(!sourceImage) return;
        dragging = true;
        lastPointer = {x:e.clientX, y:e.clientY};
        canvasWrap.setPointerCapture(e.pointerId);
      });
      canvasWrap.addEventListener('pointermove', (e)=>{
        if(!dragging || !sourceImage) return;
        const rect = canvasWrap.getBoundingClientRect();
        const scaleFactor = canvas.width / rect.width;
        const dx = (e.clientX - lastPointer.x) * scaleFactor;
        const dy = (e.clientY - lastPointer.y) * scaleFactor;
        offsetX += dx;
        offsetY += dy;
        lastPointer = {x:e.clientX, y:e.clientY};
        render();
      });
      ['pointerup','pointercancel','pointerleave'].forEach(evt=>{
        canvasWrap.addEventListener(evt, ()=>{ dragging = false; });
      });
      canvasWrap.addEventListener('touchstart', (e)=>{
        if(e.touches.length === 2){
          dragging = false;
          pinchStartDist = touchDist(e.touches);
          pinchStartScale = scale;
        }
      }, {passive:true});
      canvasWrap.addEventListener('touchmove', (e)=>{
        if(e.touches.length === 2 && sourceImage){
          e.preventDefault();
          const dist = touchDist(e.touches);
          const ratio = dist / pinchStartDist;
          scale = clampScale(pinchStartScale * ratio);
          if(zoomSlider) zoomSlider.value = Math.round(scale*100);
          render();
        }
      }, {passive:false});
  }

  function touchDist(touches){
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx,dy);
  }
  function clampScale(s){ return Math.min(3, Math.max(1, s)); }

  if(zoomSlider) {
      zoomSlider.addEventListener('input', (e)=>{
        scale = clampScale(Number(e.target.value)/100);
        render();
      });
  }

  // ============================================================
  // DOWNLOAD & SHARE
  // ============================================================
  if(downloadBtn) {
      downloadBtn.addEventListener('click', ()=>{
        if(!sourceImage) return;
        canvas.toBlob((blob)=>{
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = isPFPMode ? 'hh-goa-2026-frame.png' : 'hh-goa-2026-badge.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(()=>URL.revokeObjectURL(url), 3000);
          showToast("Saved to your downloads ✓");
        }, 'image/png', 1.0);
      });
  }

  if(shareBtn) {
      shareBtn.addEventListener('click', async ()=>{
        if(!sourceImage) return;

        if(navigator.canShare && navigator.share){
          canvas.toBlob(async (blob)=>{
            const file = new File([blob], 'hh-goa.png', {type:'image/png'});
            if(navigator.canShare({files:[file]})){
              try{
                await navigator.share({ files:[file], text: SHARE_TEXT });
                return;
              }catch(err){
                if(err.name === 'AbortError') return;
              }
            }
            await fallbackShareWithUpload();
          }, 'image/png', 1.0);
        } else {
          await fallbackShareWithUpload();
        }
      });
  }

  async function fallbackShareWithUpload() {
    shareBtn.classList.add('loading');
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.9));
      
      const formData = new FormData();
      formData.append('file', blob, 'frame.png');
      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if(data && data.data && data.data.url) {
        const directUrl = data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        const shareLink = `${DEPLOYED_DOMAIN}/api/share?img=${encodeURIComponent(directUrl)}`;
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareLink)}`;
        window.open(intentUrl, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error("Upload failed");
      }
    } catch(e) {
      console.error(e);
      showToast("Failed to generate share link. Tip: download the image and attach manually.");
      const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`;
      window.open(intentUrl, '_blank', 'noopener,noreferrer');
    } finally {
      shareBtn.classList.remove('loading');
    }
  }

  window.addEventListener('resize', ()=>{ if(sourceImage) render(); });

})();
