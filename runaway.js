document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.float-item').forEach(item => {
        // Wrap the contents in a span for transform isolation.
        const inner = document.createElement('span');
        inner.innerHTML = item.innerHTML;
        inner.style.display = 'inline-block';
        inner.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease';
        
        item.innerHTML = '';
        item.appendChild(inner);

        item.addEventListener('mouseenter', () => {
            // Randomly push away
            const moveX = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 80);
            const moveY = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 80);
            const rot = (Math.random() - 0.5) * 120;
            
            // Inner span runs away
            inner.style.transform = `translate(${moveX}px, ${moveY}px) rotate(${rot}deg) scale(0.6)`;
            inner.style.opacity = '0.0'; 
            
            setTimeout(() => {
                // Smoothly return
                inner.style.transition = 'transform 2s cubic-bezier(0.23, 1, 0.32, 1), opacity 1.5s ease';
                inner.style.transform = 'translate(0px, 0px) rotate(0deg) scale(1)';
                inner.style.opacity = '1';
                
                // Reset transition back to snappy for the next runaway
                setTimeout(() => {
                    inner.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease';
                }, 2000);
            }, 600); // stay away for a bit before returning
        });
    });
});
