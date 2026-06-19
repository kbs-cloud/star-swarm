import React, { useRef, useEffect } from 'react';

interface StarNestBackgroundProps {
  screen: string;
  staticBg: boolean;
  onAutoDetectLowPerf: () => void;
}

export const StarNestBackground: React.FC<StarNestBackgroundProps> = ({
  screen,
  staticBg,
  onAutoDetectLowPerf
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef<number>(performance.now());
  const onAutoDetectLowPerfRef = useRef(onAutoDetectLowPerf);

  useEffect(() => {
    onAutoDetectLowPerfRef.current = onAutoDetectLowPerf;
  }, [onAutoDetectLowPerf]);

  const isVisible = ['menu', 'lobby', 'game-over', 'settings', 'terms', 'privacy'].includes(screen);

  // Define shaders as strings
  const vsSource = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0.0, 1.0); }
  `;

  const fsSource = `precision mediump float;

        uniform float iTime;
        uniform vec2 iResolution;
        uniform vec4 iMouse;

        // original settings
        #define iterations 17
        #define formuparam 0.53

        #define volsteps 20
        #define stepsize 0.1

        #define zoom        0.800
        #define tile        0.850
        #define speed       0.010 

        #define brightness  0.0015
        #define darkmatter  0.300
        #define distfading  0.730
        #define saturation  0.850

        void main() {
            // Get coords and direction
            vec2 uv = gl_FragCoord.xy / iResolution.xy - 0.5;
            uv.y *= iResolution.y / iResolution.x;
            vec3 dir = vec3(uv * zoom, 1.0);
            float time = iTime * speed + 0.25;

            // Mouse rotation
            float a1 = 0.5 + iMouse.x / iResolution.x * 2.0;
            float a2 = 0.8 + iMouse.y / iResolution.y * 2.0;
            mat2 rot1 = mat2(cos(a1), sin(a1), -sin(a1), cos(a1));
            mat2 rot2 = mat2(cos(a2), sin(a2), -sin(a2), cos(a2));
            dir.xz *= rot1;
            dir.xy *= rot2;
            vec3 from = vec3(1.0, 0.5, 0.5);
            from += vec3(time * 2.0, time, -2.0);
            from.xz *= rot1;
            from.xy *= rot2;
            
            // Volumetric rendering
            float s = 0.1, fade = 1.0;
            vec3 v = vec3(0.0);
            for (int r = 0; r < volsteps; r++) {
                vec3 p = from + s * dir * 0.5;
                p = abs(vec3(tile) - mod(p, vec3(tile * 2.0))); // Tiling fold
                float pa, a = pa = 0.0;
                for (int i = 0; i < iterations; i++) { 
                    p = abs(p) / dot(p, p) - formuparam; // The magic formula
                    a += abs(length(p) - pa); // Absolute sum of average change
                    pa = length(p);
                }
                float dm = max(0.0, darkmatter - a * a * 0.001); // Dark matter
                a *= a * a; // Add contrast
                if (r > 6) fade *= 1.0 - dm; // Dark matter, don't render near
                v += fade;
                v += vec3(s, s * s, s * s * s * s) * a * brightness * fade; // Coloring based on distance
                fade *= distfading; // Distance fading
                s += stepsize;
            }
            v = mix(vec3(length(v)), v, saturation); // Color adjust
            gl_FragColor = vec4(v * 0.01, 1.0);   
        }`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) return;

    gl.clearColor(0.0, 0.0, 0.0, 0.0); // R, G, B, Alpha (0 is transparent)
    gl.clear(gl.COLOR_BUFFER_BIT);

    // --- Shader Compilation & Program Setup ---
    function compile(source: string, type: number): WebGLShader | null {
      if (!gl) return null;
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vertexShader = compile(vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compile(fsSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    // --- Buffer Setup ---
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const timeLoc = gl.getUniformLocation(program, 'iTime');
    const resLoc = gl.getUniformLocation(program, 'iResolution');

    // --- Animation Loop ---
    let lastTime = performance.now();
    const frameTimes: number[] = [];
    const maxFrameWindow = 60;
    const startupDelayFrames = 120;
    let frameCount = 0;

    const render = (time: number) => {
      // Handle resize using parent element dimensions
      const parent = canvas.parentElement;
      if (parent) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
      }

      if (!staticBg) {
        timeRef.current = time;
      }

      gl.uniform1f(timeLoc, timeRef.current * 0.001);
      gl.uniform2f(resLoc, canvas.width, canvas.height);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!staticBg) {
        const now = performance.now();
        const delta = now - lastTime;
        lastTime = now;

        frameCount++;
        if (frameCount > startupDelayFrames) {
          frameTimes.push(delta);
          if (frameTimes.length > maxFrameWindow) {
            frameTimes.shift();
            const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
            if (avgFrameTime > 45) {
              onAutoDetectLowPerfRef.current();
            }
          }
        }
        requestRef.current = requestAnimationFrame(render);
      }
    };

    const handleResize = () => {
      render(performance.now());
    };

    if (staticBg) {
      render(performance.now());
      window.addEventListener('resize', handleResize);
    } else {
      requestRef.current = requestAnimationFrame(render);
    }

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(requestRef.current || 0);
      window.removeEventListener('resize', handleResize);
    };
  }, [isVisible, staticBg]); // Re-run if screen visibility or staticBg changes

  return isVisible ? (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: 'calc(100vh - 50px)', // End before footer
      zIndex: -1,
      pointerEvents: 'none'
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {/* Fade to black on the bottom portion of the canvas */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: 'linear-gradient(to bottom, transparent, #000000)',
        pointerEvents: 'none'
      }} />
      <div className="author-notice" style={{ pointerEvents: 'auto' }}>
        Star Nest by Pablo Roman Andrioli
      </div>
    </div>
  ) : null;
};
