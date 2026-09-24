import * as THREE from 'three';
import { RENDER_CONFIG } from '../config.js';

// Owns the one WebGLRenderer and its canvas. Size changes go through resize().
export class Renderer {
  constructor(container) {
    this.container = container;
    this.webgl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.webgl.setClearColor(RENDER_CONFIG.clearColor);
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.webgl.domElement;
    this.canvas.dataset.testid = 'world-canvas';
    container.appendChild(this.canvas);
  }

  resize(width, height) {
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER_CONFIG.maxPixelRatio));
    this.webgl.setSize(width, height, false);
  }

  setAnimationLoop(callback) {
    this.webgl.setAnimationLoop(callback);
  }

  render(scene, camera) {
    this.webgl.render(scene, camera);
  }

  dispose() {
    this.webgl.setAnimationLoop(null);
    this.webgl.dispose();
    this.canvas.remove();
  }
}
