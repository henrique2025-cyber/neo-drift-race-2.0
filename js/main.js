import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { Track } from './track.js';
import { ItemSystem } from './items.js';

let racers = [];

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.speedElem = document.getElementById('speedometer');
        this.posElem = document.getElementById('race-position');
        this.countElem = document.getElementById('countdown');
        this.lapElem = document.getElementById('lap-counter');

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020205);
        this.scene.fog = new THREE.FogExp2(0x020205, 0.001);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        this.clock = new THREE.Clock();

        this.gameState = 'COUNTDOWN';
        this.countValue = 5;
        this.countTimer = 1.0;
        this.gpButtonPressed = false;

        this.init();
    }

    init() {
        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0x00ffff, 1);
        sun.position.set(50, 100, 50);
        this.scene.add(sun);

        // Core Systems
        this.track = new Track(this.scene);

        // Spawn AI
        const colors = [
            0xff0055, 0x00ff55, 0x5500ff, 0xffff00,
            0xff8800, 0x00ffff, 0xff00ff, 0xffffff, 0x888888
        ];

        for (let i = 0; i < 9; i++) {
            const ai = new Vehicle(this.scene, null, colors[i]);
            ai.isAI = true;
            ai.maxSpeed = 24.8;
            ai.laneOffset = (Math.random() - 0.5) * 40;
            ai.lap = 1;
            ai.lastNodeIndex = 1;

            ai.position.set(-18 + (i * 4.5), 1, 0);
            ai.targetNodeIndex = 1;
            racers.push(ai);
        }

        // Player (250 KM/H)
        this.player = new Vehicle(this.scene, this.camera, 0x00ffff);
        this.player.maxSpeed = 25.0;
        this.player.position.set(-22.5, 1, 0);
        this.player.lap = 1;
        this.player.lastNodeIndex = 1;
        this.totalLaps = 3;
        racers.push(this.player);

        this.items = new ItemSystem(this.scene, this.player);

        // Input Listeners
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'q' || key === 'enter') {
                this.items.useItem(this.player);
            }
        });

        this.animate();
        console.log('MAIN_JS_RESTORED_V4');
    }

    updateHUD() {
        if (this.speedElem) {
            const speed = Math.round(this.player.velocity.length() * 10);
            this.speedElem.innerText = `${speed} KM/H`;
        }

        if (this.posElem) {
            racers.forEach(r => {
                const nodeIdx = r.targetNodeIndex || 0;
                const prevIdx = (nodeIdx - 1 + 200) % 200;
                const p1 = this.track.curve.getPointAt(prevIdx / 200);
                const p2 = this.track.curve.getPointAt(nodeIdx / 200);
                const segmentLen = p1.distanceTo(p2);
                const distToTarget = r.position.distanceTo(p2);
                r.progress = ((r.lap - 1) * 200) + nodeIdx + (1 - Math.min(distToTarget / Math.max(0.001, segmentLen), 1));
            });

            const sorted = [...racers].sort((a, b) => b.progress - a.progress);
            const rank = sorted.indexOf(this.player) + 1;
            this.posElem.innerText = `${rank}°`;
        }

        if (this.lapElem) {
            this.lapElem.innerText = `LAP ${Math.min(this.player.lap, this.totalLaps)}/${this.totalLaps}`;
        }
    }

    showMessage(text) {
        const msg = document.getElementById('hud-messages');
        if (msg) {
            msg.innerText = text;
            setTimeout(() => { if (msg.innerText === text) msg.innerText = ''; }, 2000);
        }
    }

    updateAI(ai, delta) {
        const t = ai.targetNodeIndex / 200;
        const targetPoint = this.track.curve.getPointAt(t);
        const tangent = this.track.curve.getTangentAt(t);
        const side = new THREE.Vector3(0, 1, 0).cross(tangent).normalize();

        const target = targetPoint.clone().addScaledVector(side, ai.laneOffset || 0);
        const dist = ai.position.distanceTo(target);

        if (dist < 25) {
            ai.targetNodeIndex = (ai.targetNodeIndex + 1) % 200;
        }

        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), ai.rotation);
        const toTarget = target.clone().sub(ai.position).normalize();
        const cross = new THREE.Vector3().crossVectors(forward, toTarget);

        ai.keys.w = true;
        ai.keys.a = cross.y > 0.05;
        ai.keys.d = cross.y < -0.05;

        if (ai.currentItem) {
            const distToPlayer = ai.position.distanceTo(this.player.position);
            if (ai.currentItem === 'MISSILE') {
                const toPlayer = this.player.position.clone().sub(ai.position).normalize();
                const dot = forward.dot(toPlayer);
                if (distToPlayer < 120 && dot > 0.8) this.items.useItem(ai);
            } else if (ai.currentItem === 'MINE') {
                const toPlayer = this.player.position.clone().sub(ai.position).normalize();
                const dot = forward.dot(toPlayer);
                if (distToPlayer < 40 && dot < -0.5) this.items.useItem(ai);
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = Math.min(this.clock.getDelta(), 0.1);
        const time = this.clock.getElapsedTime();

        if (this.gameState === 'COUNTDOWN') {
            this.countTimer -= delta;
            if (this.countTimer <= 0) {
                this.countValue--;
                this.countTimer = 1.0;
                if (this.countValue === 0) {
                    if (this.countElem) this.countElem.innerText = "GO!";
                } else if (this.countValue < 0) {
                    if (this.countElem) this.countElem.style.display = 'none';
                    this.gameState = 'RACING';
                } else {
                    if (this.countElem) this.countElem.innerText = this.countValue;
                }
            }
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const gamepads = navigator.getGamepads();
        const gp = gamepads[0];

        racers.forEach(r => {
            if (r.isAI) {
                this.updateAI(r, delta);
                r.update(delta, this.track);
            } else {
                r.update(delta, this.track, gp);
                if (gp && gp.buttons[2].pressed && !this.gpButtonPressed) {
                    this.items.useItem(r);
                    this.gpButtonPressed = true;
                }
                if (gp && !gp.buttons[2].pressed) this.gpButtonPressed = false;
            }

            if (!r.isAI) {
                let minDist = Infinity;
                let bestIdx = r.targetNodeIndex || 0;
                for (let i = 0; i < 30; i++) {
                    const idx = (bestIdx + i) % 200;
                    const p = this.track.curve.getPointAt(idx / 200);
                    const d = r.position.distanceTo(p);
                    if (d < minDist) {
                        minDist = d;
                        bestIdx = idx;
                    }
                }
                r.targetNodeIndex = bestIdx;
            }

            if (r.lastNodeIndex > 180 && r.targetNodeIndex < 20) {
                r.lap++;
                if (r === this.player) {
                    if (this.player.lap > this.totalLaps) {
                        this.gameState = 'FINISHED';
                        this.showMessage("FINISH!");
                    } else if (this.player.lap === this.totalLaps) {
                        this.showMessage("FINAL LAP!");
                    } else {
                        this.showMessage("LAP COMPLETED!");
                    }
                }
            }
            r.lastNodeIndex = r.targetNodeIndex;
        });

        if (this.gameState === 'FINISHED') {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        this.track.itemBoxes.forEach(box => {
            if (box.visible) {
                racers.forEach(r => {
                    if (r.position.distanceTo(box.position) < 8) {
                        box.visible = false;
                        this.items.collectItem(r);
                        setTimeout(() => box.visible = true, 5000);
                    }
                });
            }
        });

        this.items.update(time, delta, racers);
        this.updateHUD();
        this.track.update(time);
        this.renderer.render(this.scene, this.camera);
    }
}

window.onload = () => new Game();
