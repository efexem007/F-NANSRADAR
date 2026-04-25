import React, { useEffect, useRef, useCallback } from 'react';

/**
 * ScrollCanvas — Scroll-driven canvas animation
 * Renders procedural visuals based on scroll position
 * Optimized with requestAnimationFrame + pre-calculation
 */

const GRADIENT_PAIRS = [
  ['#8b5cf6', '#06b6d4'], // purple → cyan
  ['#ec4899', '#8b5cf6'], // pink → purple
  ['#06b6d4', '#10b981'], // cyan → green
  ['#f59e0b', '#ef4444'], // amber → red
  ['#3b82f6', '#ec4899'], // blue → pink
  ['#10b981', '#06b6d4'], // green → cyan
  ['#ef4444', '#f59e0b'], // red → amber
  ['#8b5cf6', '#ec4899'], // purple → pink
];

function lerpColor(a, b, t) {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

export default function ScrollCanvas() {
  const canvasRef = useRef(null);
  const ticking = useRef(false);
  const scrollFraction = useRef(0);
  const particles = useRef([]);

  // Initialize particles once
  useEffect(() => {
    const p = [];
    for (let i = 0; i < 60; i++) {
      p.push({
        x: Math.random(),
        y: Math.random(),
        r: 1 + Math.random() * 3,
        speed: 0.0002 + Math.random() * 0.0008,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particles.current = p;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    const sf = scrollFraction.current;
    const colorIdx = Math.min(GRADIENT_PAIRS.length - 1, Math.floor(sf * GRADIENT_PAIRS.length));
    const nextColorIdx = Math.min(GRADIENT_PAIRS.length - 1, colorIdx + 1);
    const localT = (sf * GRADIENT_PAIRS.length) % 1;

    const c1 = lerpColor(GRADIENT_PAIRS[colorIdx][0], GRADIENT_PAIRS[nextColorIdx][0], localT);
    const c2 = lerpColor(GRADIENT_PAIRS[colorIdx][1], GRADIENT_PAIRS[nextColorIdx][1], localT);

    // Clear with slight trail effect
    ctx.fillStyle = 'rgba(12, 10, 26, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // Animated radial gradients
    const centerX = w * (0.3 + sf * 0.4);
    const centerY = h * (0.3 + Math.sin(sf * Math.PI * 2) * 0.2);

    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, w * 0.6);
    grad.addColorStop(0, c1 + '18'); // ~9% opacity
    grad.addColorStop(0.5, c2 + '08'); // ~3% opacity
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Second glow
    const grad2 = ctx.createRadialGradient(
      w * (0.7 - sf * 0.3), h * (0.6 + Math.cos(sf * Math.PI * 3) * 0.15),
      0, w * (0.7 - sf * 0.3), h * (0.6 + Math.cos(sf * Math.PI * 3) * 0.15), w * 0.5
    );
    grad2.addColorStop(0, c2 + '12');
    grad2.addColorStop(1, 'transparent');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, w, h);

    // Particles
    const t = Date.now() * 0.001;
    particles.current.forEach((pt, i) => {
      const px = ((pt.x + Math.sin(t * pt.speed * 1000 + pt.phase) * 0.05 + sf * 0.2) % 1) * w;
      const py = ((pt.y + Math.cos(t * pt.speed * 800 + pt.phase) * 0.05 + sf * 0.1) % 1) * h;
      const pr = pt.r * (1 + Math.sin(t + i) * 0.3);
      const alpha = 0.15 + Math.sin(t * 2 + i) * 0.1;

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Connection lines between close particles (only every 3rd for perf)
    ctx.strokeStyle = c1;
    ctx.globalAlpha = 0.04;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < particles.current.length; i += 3) {
      const p1 = particles.current[i];
      const px1 = ((p1.x + Math.sin(t * p1.speed * 1000 + p1.phase) * 0.05 + sf * 0.2) % 1) * w;
      const py1 = ((p1.y + Math.cos(t * p1.speed * 800 + p1.phase) * 0.05 + sf * 0.1) % 1) * h;
      for (let j = i + 3; j < particles.current.length; j += 5) {
        const p2 = particles.current[j];
        const px2 = ((p2.x + Math.sin(t * p2.speed * 1000 + p2.phase) * 0.05 + sf * 0.2) % 1) * w;
        const py2 = ((p2.y + Math.cos(t * p2.speed * 800 + p2.phase) * 0.05 + sf * 0.1) % 1) * h;
        const dist = Math.hypot(px1 - px2, py1 - py2);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(px1, py1);
          ctx.lineTo(px2, py2);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;

    // Animated wave at bottom
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) {
      const waveY = h - 40 - Math.sin(x * 0.01 + t * 2 + sf * 10) * 20 * (1 - sf * 0.5);
      ctx.lineTo(x, waveY);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const waveGrad = ctx.createLinearGradient(0, h - 60, 0, h);
    waveGrad.addColorStop(0, c1 + '10');
    waveGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = waveGrad;
    ctx.fill();

    ticking.current = false;
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          scrollFraction.current = maxScroll > 0 ? Math.min(1, Math.max(0, scrollTop / maxScroll)) : 0;
          draw();
        });
        ticking.current = true;
      }
    };

    // Animation loop for continuous particle movement
    let animId;
    const animate = () => {
      draw();
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', draw, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', draw);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.6,
      }}
    />
  );
}
