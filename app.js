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
  const overlayContainer = document.getElementById('overlayInputs');
  const actionsWrap = document.querySelector('.actions');
  
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
        if (canvasWrap) canvasWrap.style.display = 'block';
        if (emptyPreview) emptyPreview.style.display = 'none';
        
        // Show zoom controls
        if(zoomControls) zoomControls.style.display = 'flex';
        if(zoomHint) zoomHint.style.display = 'block';
        if(actionsWrap) actionsWrap.style.display = 'grid';

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
    if (canvasWrap) canvasWrap.style.display = 'none';
    if (emptyPreview) emptyPreview.style.display = 'flex';
    if(zoomControls) zoomControls.style.display = 'none';
    if(zoomHint) zoomHint.style.display = 'none';
    if(overlayContainer) overlayContainer.style.display = 'none';
    if(actionsWrap) actionsWrap.style.display = 'none';
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
    // Background: Dark Gray/Black
    ctx.fillStyle = '#111111';
    ctx.fillRect(0,0,S,S);

    // Decorative Borders
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    roundRect(ctx, 24, 24, S-48, S-48, 40);
    ctx.stroke();

    ctx.strokeStyle = '#a3a3a3';
    ctx.lineWidth = 4;
    roundRect(ctx, 44, 44, S-88, S-88, 30);
    ctx.stroke();

    // Corner Accents
    ctx.fillStyle = '#ffffff';
    [44, S-44].forEach(x => {
      [44, S-44].forEach(y => {
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI*2); ctx.fill();
      });
    });

    // Draw Image (Center Circle)
    drawImageClamped(S, S, S/2, S/2, S*0.38);

    // Photo Ring
    ctx.save();
    const ringW = 16;
    ctx.lineWidth = ringW;
    ctx.strokeStyle = '#a3a3a3';
    ctx.beginPath();
    ctx.arc(S/2, S/2, S*0.38 + ringW/2, 0, Math.PI*2);
    ctx.stroke();
    
    // Inner white ring
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(S/2, S/2, S*0.38 - 8, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // Top Header: HACKER HOUSE
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `800 ${S*0.1}px 'Cinzel', 'Yatra One', serif`;
    ctx.fillText('HACKER HOUSE', S/2, S*0.18);

    // Pill (Top Rightish)
    ctx.fillStyle = '#333333';
    roundRect(ctx, S*0.75, S*0.11, 140, 50, 15);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText("गोवा", S*0.75 + 70, S*0.11 + 32);

    // Bottom Footer
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${S*0.06}px 'Syne', sans-serif`;
    ctx.fillText('GOA 2026', S/2, S*0.88);

    // Subtitle
    ctx.fillStyle = '#cccccc';
    ctx.font = `600 ${S*0.025}px 'Plus Jakarta Sans', sans-serif`;
    ctx.letterSpacing = "4px";
    ctx.fillText('LESS NOISE • MORE SIGNAL', S/2, S*0.93);
    ctx.letterSpacing = "0px";
  }

  // FORMAT B (Landscape ID Card) - 1024x784
  function renderFormatB(W, H){
    ctx.save();
    
    // Deep Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0,0,W,H);

    // Decorative Top/Bottom Borders
    ctx.fillStyle = '#4d4d4d';
    for(let i=0; i<W; i+=30) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i+15, 10); ctx.lineTo(i+30, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(i, H); ctx.lineTo(i+15, H-10); ctx.lineTo(i+30, H); ctx.fill();
    }

    // Main Inner Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, 16, 16, W-32, H-32, 16);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 24, 24, W-48, H-48, 12);
    ctx.stroke();

    // Wordmark: HACKER HOUSE
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 68px 'Cinzel', 'Yatra One', serif`;
    ctx.fillText('HACKER HOUSE', 48, 96);
    
    // Badge overlapping wordmark
    ctx.fillStyle = '#333333';
    roundRect(ctx, 330, 50, 70, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 18px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText("गोवा", 345, 75);

    // Subtitle
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 14px 'Space Mono', monospace`;
    ctx.fillText('GOA, INDIA  •  28 - 31 OCT 2026', 130, 120);

    // Vertical Left Text
    ctx.save();
    ctx.translate(32, H/2 + 100);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 14px 'Space Mono', monospace`;
    ctx.fillText('• BUILD • HACK • SHIP • CONNECT •', 0, 0);
    ctx.restore();

    // Draw Photo exactly in the designated template box
    const px = 65, py = 140, pw = 375, ph = 460;
    drawImageToRect(ctx, px, py, pw, ph, 18);

    // Photo Box Borders
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4d4d4d';
    roundRect(ctx, px-6, py-6, pw+12, ph+12, 22);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    roundRect(ctx, px-2, py-2, pw+4, ph+4, 18);
    ctx.stroke();

    // Photo Bottom Logo (HH)
    const logoR = 40;
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath(); ctx.arc(px + pw/2, py + ph, logoR, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px + pw/2, py + ph, logoR, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 28px 'Cinzel', serif`;
    ctx.fillText('HH', px + pw/2, py + ph + 2);

    // Under Photo Text
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = `700 16px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText("YOU'RE INSIDE THE ROOM.", 120, 650);
    ctx.fillStyle = '#cccccc';
    ctx.font = `400 14px 'Space Mono', monospace`;
    ctx.fillText("4 DAYS. ONE RHYTHM.", 120, 675);
    ctx.fillText("EVERYTHING INTENTIONAL.", 120, 700);

    // ==========================================
    // RIGHT COLUMN (Fields)
    // ==========================================
    const rx = 710;
    
    // Title: BUILDER PASS
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = `800 32px 'Cinzel', serif`;
    ctx.fillText('✦ BUILDER PASS ✦', 640, 90);

    // GOA 2026 Stamp
    ctx.save();
    ctx.translate(920, 100);
    ctx.rotate(10 * Math.PI / 180);
    ctx.strokeStyle = '#7a7a7a';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    roundRect(ctx, -50, -60, 100, 120, 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#4d4d4d';
    ctx.textAlign = 'center';
    ctx.font = `800 24px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('GOA', 0, -20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('2026 ✈', 0, 40);
    ctx.restore();
    
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

    const fields = [
      { label: 'BUILDER ID', value: bId, color: '#ffffff', iconCol: '#ffffff', y: 188 },
      { label: 'NAME', value: name || 'YOUR NAME', color: '#ffffff', iconCol: '#cccccc', y: 256 },
      { label: 'ROLE', value: role || 'YOUR ROLE', color: '#cccccc', iconCol: '#a3a3a3', y: 323 },
      { label: 'STACK', value: stack || 'HTML/CSS/JS', color: '#ffffff', iconCol: '#7a7a7a', y: 390 },
      { label: 'TEAM NAME', value: team || 'SOLO BUILDER', color: '#ffffff', iconCol: '#5c5c5c', y: 457 },
      { label: 'BUILDER CLASS', value: bClass, color: '#cccccc', iconCol: '#cccccc', y: 525 }
    ];

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    fields.forEach((f) => {
      // Icon Box
      ctx.strokeStyle = f.iconCol;
      ctx.lineWidth = 2;
      roundRect(ctx, rx - 60, f.y - 20, 40, 40, 8);
      ctx.stroke();
      
      // Icon pseudo-graphics
      ctx.fillStyle = f.iconCol;
      ctx.beginPath(); ctx.arc(rx-40, f.y, 6, 0, Math.PI*2); ctx.fill();
      
      // Label
      ctx.fillStyle = '#cccccc';
      ctx.font = `600 12px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(f.label, rx, f.y - 25);
      
      // Value
      ctx.fillStyle = f.color;
      ctx.font = f.label === 'NAME' ? `700 24px 'Plus Jakarta Sans', sans-serif` : 
                 f.label === 'BUILDER ID' ? `600 24px 'Plus Jakarta Sans', sans-serif` :
                 f.label === 'STACK' ? `600 18px 'Plus Jakarta Sans', sans-serif` :
                 `700 20px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(f.value.toUpperCase(), rx, f.y);

      // Separator line
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(rx - 60, f.y + 30); ctx.lineTo(W - 40, f.y + 30); ctx.stroke();
    });

    // Circular Stamp
    ctx.save();
    ctx.translate(880, 680);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0, 50, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0, 42, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = '#a3a3a3';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 12px 'Space Mono', monospace`;
    ctx.fillText('BUILT TOGETHER', 0, -10);
    ctx.fillText('INSIDE THE ROOM', 0, 10);
    ctx.restore();

    // Ticket Stub Bottom Right
    const stubX = 460, stubY = 620, stubW = 340, stubH = 100;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, stubX, stubY, stubW, stubH, 12);
    ctx.stroke();
    
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.font = `700 16px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('ENTER THE HOUSE.', stubX + 20, stubY + 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('LEAVE YOUR MARK.', stubX + 20, stubY + 55);
    
    // Vertical separator
    ctx.beginPath(); ctx.moveTo(stubX + 180, stubY+10); ctx.lineTo(stubX + 180, stubY + stubH - 10); ctx.stroke();

    ctx.save();
    ctx.translate(stubX + 200, stubY + stubH/2 + 30);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 12px 'Space Mono', monospace`;
    ctx.fillText('PASS TYPE', 0, 0);
    ctx.restore();

    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.font = `800 22px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('BUILDER', stubX + 220, stubY + 35);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 16px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillText('ADMIT ONE  ✈', stubX + 220, stubY + 65);

    ctx.restore();
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
