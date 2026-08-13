(function(){
  "use strict";

  // ============================================================
  // CONFIG
  // ============================================================
  const HASHTAG = "#FrameInGoa";
  const SHARE_TEXT = "I'm building at HH Goa 2026 🌴⚡ " + HASHTAG;
  const DEPLOYED_DOMAIN = window.location.origin; 
  
  const isPFPMode = window.PFP_MODE === true;

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
  
  const inputName = document.getElementById('nameInput');
  const inputRole = document.getElementById('roleInput');

  document.fonts.ready.then(() => { if(sourceImage) render(); });

  if (inputName) inputName.addEventListener('input', () => { if(sourceImage) render(); });
  if (inputRole) inputRole.addEventListener('input', () => { if(sourceImage) render(); });

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
      maskW = 340 * 2; // Approximate photo mask size in format B
      maskH = 340 * 2;
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

  function drawImageClamped(cw, ch, maskCx, maskCy, maskR) {
    ctx.save();
    const effScale = baseCoverScale * scale;
    const drawW = imgNaturalW * effScale;
    const drawH = imgNaturalH * effScale;

    let dx = maskCx - drawW/2 + offsetX;
    let dy = maskCy - drawH/2 + offsetY;

    const minDx = maskCx + maskR - drawW;
    const maxDx = maskCx - maskR;
    const minDy = maskCy + maskR - drawH;
    const maxDy = maskCy - maskR;

    dx = Math.min(maxDx, Math.max(minDx, dx));
    dy = Math.min(maxDy, Math.max(minDy, dy));

    offsetX = dx - (maskCx - drawW/2);
    offsetY = dy - (maskCy - drawH/2);

    ctx.beginPath();
    ctx.arc(maskCx, maskCy, maskR, 0, Math.PI*2);
    ctx.clip(); 

    ctx.drawImage(sourceImage, dx, dy, drawW, drawH);
    ctx.restore();
  }

  // FORMAT A (Square PFP Frame)
  function renderFormatA(S, _S){
    drawImageClamped(S, S, S/2, S/2, S/2);

    ctx.save();
    const ringW = S * 0.055;
    const grad = ctx.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#ff297f');
    grad.addColorStop(1, '#ffc700');
    
    ctx.lineWidth = ringW;
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.arc(S/2, S/2, S/2 - ringW/2, 0, Math.PI*2);
    ctx.stroke();

    ctx.beginPath();
    ctx.rect(0,0,S,S);
    ctx.arc(S/2, S/2, S/2, 0, Math.PI*2, true);
    ctx.closePath();
    ctx.fillStyle = '#0a0410';
    ctx.fill('evenodd');

    ctx.lineWidth = S*0.006;
    ctx.strokeStyle = 'rgba(255,248,236,0.9)';
    ctx.beginPath();
    ctx.arc(S/2, S/2, S/2 - ringW - S*0.006, 0, Math.PI*2);
    ctx.stroke();

    const pillW = S*0.62, pillH = S*0.105;
    const pillX = S/2 - pillW/2;
    const pillY = S - ringW - pillH*0.55;
    const r = pillH/2;

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = S*0.02;
    ctx.shadowOffsetY = S*0.006;

    const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX+pillW, pillY);
    pillGrad.addColorStop(0, '#ff297f');
    pillGrad.addColorStop(1, '#ffc700');
    ctx.fillStyle = pillGrad;
    roundRect(ctx, pillX, pillY, pillW, pillH, r);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#1a0a00';
    ctx.font = `800 ${Math.round(S*0.052)}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HH GOA 2026', S/2, pillY + pillH/2 + S*0.002);

    ctx.restore();
  }

  // FORMAT B (Landscape ID Card, matching reference site proportions)
  // Canvas is 1024x784
  function renderFormatB(W, H){
    ctx.save();
    
    // Gradient Background
    const bgGrad = ctx.createLinearGradient(0,0,W,H);
    bgGrad.addColorStop(0, '#100B1A');
    bgGrad.addColorStop(1, '#1E1430');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0,0,W,H);

    // Grid pattern (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let i=0; i<W; i+=40) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
    for(let i=0; i<H; i+=40) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

    // Outer Border
    ctx.strokeStyle = '#FFC700';
    ctx.lineWidth = 12;
    roundRect(ctx, 6, 6, W-12, H-12, 32);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, W-48, H-48, 24);
    ctx.stroke();

    // Photo on left side
    const photoR = H * 0.35;
    const photoCx = W * 0.3;
    const photoCy = H * 0.5;

    drawImageClamped(W, H, photoCx, photoCy, photoR);

    // Photo Ring
    const ringW = 12;
    ctx.lineWidth = ringW;
    ctx.strokeStyle = '#FF297F';
    ctx.beginPath();
    ctx.arc(photoCx, photoCy, photoR + ringW/2, 0, Math.PI*2);
    ctx.stroke();

    // User Text (Right side)
    const name = inputName && inputName.value.trim() ? inputName.value.trim() : 'BUILDER NAME';
    const role = inputRole && inputRole.value.trim() ? inputRole.value.trim() : 'FULLSTACK DEVELOPER';

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    
    ctx.font = `800 64px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(name.toUpperCase(), W*0.58, H * 0.42);

    ctx.fillStyle = '#FFC700';
    ctx.font = `700 32px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText(role.toUpperCase(), W*0.58, H * 0.51);

    // Pill tag
    ctx.fillStyle = '#FF297F';
    roundRect(ctx, W*0.58, H*0.58, 280, 50, 25);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("✦ " + generatedTitle.toUpperCase() + " ✦", W*0.58 + 140, H*0.58 + 25);

    // Footer
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = `600 20px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HACKER HOUSE GOA 2026', W/2, H - 50);

    ctx.restore();
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
