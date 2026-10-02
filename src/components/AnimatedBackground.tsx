import React, { useEffect, useRef } from 'react';
import { getAssetUrl } from '../utils/assets';

interface AnimatedBackgroundProps {
  imageSrc?: string;
  enableParticles?: boolean;
  isCelebrating?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  alpha: number;
  maxAlpha: number;
  pulseSpeed: number;
  color: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  imageSrc = '/background.png',
  enableParticles = true,
  isCelebrating = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enableParticles) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const getDims = () => {
      const p = canvas.parentElement;
      return {
        w: p?.clientWidth || 512,
        h: p?.clientHeight || 768,
      };
    };

    let { w: width, h: height } = getDims();
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      if (!canvas) return;
      const dims = getDims();
      width = canvas.width = dims.w;
      height = canvas.height = dims.h;
    };
    window.addEventListener('resize', handleResize);

    // Blue-White & Gentle Gold palette matching CKP school banner
    const particleColors = [
      '#FFFFFF', // Pure white jasmine petals
      '#F0FDF4', // Mint white
      '#E0F2FE', // Soft sky blue
      '#BAE6FD', // Cyan 200
      '#FEF08A', // Pale gold stardust
    ];

    const particleCount = Math.min(Math.floor((width * height) / 28000), 45);
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2.2 + 0.8,
        speedY: -(Math.random() * 0.35 + 0.12), // Gentle upward drift
        speedX: (Math.random() - 0.45) * 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        maxAlpha: Math.random() * 0.4 + 0.3,
        pulseSpeed: Math.random() * 0.015 + 0.005,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
      });
    }

    // Helper: draw 4-point twinkling star
    const drawStar = (c: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number, color = '#FDE68A') => {
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.shadowColor = '#F59E0B';
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(cx, cy - r);
      c.quadraticCurveTo(cx, cy, cx + r, cy);
      c.quadraticCurveTo(cx, cy, cx, cy + r);
      c.quadraticCurveTo(cx, cy, cx - r, cy);
      c.quadraticCurveTo(cx, cy, cx, cy - r);
      c.closePath();
      c.fill();
      c.restore();
    };

    let time = 0;

    const render = () => {
      time += 0.014;
      ctx.clearRect(0, 0, width, height);

      // --- Twinkling Stars on Chattra Umbrella Tips of Elephants ---
      // Left Chattra Tip (approx 8.5% X, 36% Y)
      const lTipX = width * 0.086;
      const lTipY = height * 0.36;
      const lPulse = Math.sin(time * 3) * 0.35 + 0.65;
      drawStar(ctx, lTipX, lTipY, 8 * lPulse, lPulse, '#FFFBEB');

      // Right Chattra Tip (approx 93.5% X, 38% Y)
      const rTipX = width * 0.936;
      const rTipY = height * 0.38;
      const rPulse = Math.cos(time * 2.8) * 0.35 + 0.65;
      drawStar(ctx, rTipX, rTipY, 8 * rPulse, rPulse, '#FFFBEB');

      // 32-Year Logo sparkle (approx 84.5% X, 20% Y)
      const logo32X = width * 0.845;
      const logo32Y = height * 0.20;
      const logoPulse = Math.sin(time * 2.2 + 1) * 0.3 + 0.6;
      drawStar(ctx, logo32X, logo32Y, 7 * logoPulse, logoPulse, '#BAE6FD');

      // School Logo sparkle (approx 16.5% X, 20% Y)
      const schoolLogoX = width * 0.165;
      const schoolLogoY = height * 0.20;
      const schoolPulse = Math.cos(time * 2.4 + 2) * 0.3 + 0.6;
      drawStar(ctx, schoolLogoX, schoolLogoY, 7 * schoolPulse, schoolPulse, '#FEF08A');

      // Extra festive celebratory bursts when donation popup is active
      if (isCelebrating) {
        const celebPulse = Math.sin(time * 8) * 0.4 + 0.6;
        drawStar(ctx, lTipX, lTipY, 16 * celebPulse, celebPulse, '#FFFFFF');
        drawStar(ctx, rTipX, rTipY, 16 * celebPulse, celebPulse, '#FFFFFF');
      }

      // --- Floating White Jasmine Petals & Sparkles ---
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(time + p.y * 0.008) * 0.2;

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        p.alpha += Math.sin(time * 2 + p.x) * p.pulseSpeed;
        const currentAlpha = Math.max(0.1, Math.min(p.maxAlpha, p.alpha));

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [enableParticles, isCelebrating]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none select-none z-0 ${className}`}>
      {/* Background container: fits 100% of the banner so school logo and 32-year logo are never cut off */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat transition-transform"
        style={{
          backgroundImage: `url(${getAssetUrl(imageSrc)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          imageRendering: '-webkit-optimize-contrast',
          animation: 'gentleBreathe 24s ease-in-out infinite alternate',
        }}
      />

      {/* Canvas for sparkling stars on logos, umbrellas and floating petals */}
      {enableParticles && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      )}
    </div>
  );
};
