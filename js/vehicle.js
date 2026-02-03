import * as THREE from 'three';

export class Vehicle {
    constructor(scene, camera, color = 0x00ffcc) {
        this.scene = scene;
        this.camera = camera;
        this.color = color;

        this.mesh = this.createMesh(color);
        this.scene.add(this.mesh);

        this.position = new THREE.Vector3(0, 1, 0);
        this.velocity = new THREE.Vector3();
        this.rotation = 0;

        // Atributos de performance (Ajustados para 250 KM/H)
        this.maxSpeed = 25;
        this.accel = 65;
        this.decel = 0.97;
        this.turnSpeed = 2.8;

        this.isBoosting = false;
        this.boostTimer = 0;
        this.isDriftingManual = false;
        this.manualDriftTime = 0;

        this.keys = { w: false, a: false, s: false, d: false, e: false };

        if (this.camera) {
            window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
            window.addEventListener('keyup', (e) => {
                const key = e.key.toLowerCase();
                if (key === 'e' && this.isDriftingManual) this.releaseDrift();
                this.keys[key] = false;
            });
        }

        // Sistema de Faíscas
        this.sparks = [];
        this.createSparkPool();
    }

    createMesh(color) {
        const group = new THREE.Group();
        let mat;
        try {
            mat = new THREE.MeshPhongMaterial({ color: color, flatShading: true });
        } catch (e) {
            mat = new THREE.MeshBasicMaterial({ color: color });
        }

        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4), mat);
        group.add(body);

        const cockpit = new THREE.Mesh(
            new THREE.BoxGeometry(1, 0.4, 1.2),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
        );
        cockpit.position.set(0, 0.4, 0.5);
        group.add(cockpit);

        const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.5), new THREE.MeshBasicMaterial({ color: color }));
        lWing.position.set(-1.1, 0.2, -1);
        group.add(lWing);

        const rWing = lWing.clone();
        rWing.position.set(1.1, 0.2, -1);
        group.add(rWing);

        return group;
    }

    createSparkPool() {
        const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        for (let i = 0; i < 20; i++) {
            const s = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            s.visible = false;
            this.scene.add(s);
            this.sparks.push({ mesh: s, life: 0 });
        }
    }

    update(delta, track, gamepad = null) {
        if (this.boostTimer > 0) {
            this.boostTimer -= delta;
            this.isBoosting = true;
        } else {
            this.isBoosting = false;
        }

        // Steering Physics settings
        let currentTurnSpeed = this.turnSpeed;
        let sideSlipFactor = 0.9; // Default side friction (high = less slide)

        // Read Inputs (Keyboard fallback)
        let turnInput = 0;
        let accelInput = 0;
        let brakeInput = 0;
        let driftInput = this.keys.e;

        if (this.keys.a) turnInput = 1;
        if (this.keys.d) turnInput = -1;
        if (this.keys.w) accelInput = 1;
        if (this.keys.s) brakeInput = 1;

        // Gamepad Override
        if (gamepad) {
            // Right Stick Horizontal (Axis 2 or 3 depending on browser, usually 2 for Right Stick X)
            const stickX = gamepad.axes[2] || 0;
            if (Math.abs(stickX) > 0.15) { // Deadzone 0.15
                turnInput = -stickX; // Invert to match 'a'/'d' logic
            }

            if (gamepad.buttons[0].pressed) accelInput = 1; // 'A'
            if (gamepad.buttons[1].pressed) brakeInput = 1; // 'B'
            if (gamepad.buttons[3].pressed) driftInput = true; // 'Y'
        }

        // Drift Mechanic (Y Button or E Key)
        if (driftInput && this.velocity.length() > 20) {
            this.isDriftingManual = true;
            this.manualDriftTime += delta;
            this.updateSparks(delta);

            sideSlipFactor = 0.45; // Reduce sideFriction by 50% (0.9 -> 0.45)
            currentTurnSpeed *= 1.5; // Increase steering sensitivity

            // Visual feedback: extreme tilt
            this.mesh.children[0].rotation.z = THREE.MathUtils.lerp(this.mesh.children[0].rotation.z, -turnInput * 0.6, 0.2);
        } else {
            if (this.isDriftingManual && !driftInput) this.releaseDrift();
            this.isDriftingManual = false;
            this.mesh.children[0].rotation.z = THREE.MathUtils.lerp(this.mesh.children[0].rotation.z, 0, 0.1);
        }

        if (this.isBoosting) {
            currentTurnSpeed *= 0.5; // High speed compensation
        }

        this.rotation += turnInput * currentTurnSpeed * delta;
        this.mesh.rotation.y = this.rotation;

        // Advanced Physics: Side-Slip
        const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);

        // Project velocity onto forward and right
        const dotForward = this.velocity.dot(forward);
        const dotRight = this.velocity.dot(right);

        const vForward = forward.clone().multiplyScalar(dotForward);
        const vRight = right.clone().multiplyScalar(dotRight);

        // Apply forces
        if (accelInput > 0) vForward.addScaledVector(forward, this.accel * delta);
        if (brakeInput > 0) vForward.addScaledVector(forward, -this.accel * 0.5 * delta);

        // Damping
        vForward.multiplyScalar(this.decel);
        vRight.multiplyScalar(sideSlipFactor);

        this.velocity.copy(vForward).add(vRight);

        // Limit Speed
        const limit = this.isBoosting ? this.maxSpeed * 1.8 : this.maxSpeed;
        if (this.velocity.length() > limit) this.velocity.setLength(limit);

        // Guardrails Collision
        if (track && track.guardrails) {
            const nextPos = this.position.clone().addScaledVector(this.velocity, delta);
            const box = new THREE.Box3().setFromCenterAndSize(nextPos, new THREE.Vector3(2, 1, 4));
            for (let rail of track.guardrails) {
                if (new THREE.Box3().setFromObject(rail).intersectsBox(box)) {
                    this.velocity.multiplyScalar(-0.4);
                    break;
                }
            }
        }

        this.position.addScaledVector(this.velocity, delta);
        this.mesh.position.copy(this.position);

        if (this.position.y < -10) this.position.set(0, 1, 0);

        if (this.camera) {
            const offset = new THREE.Vector3(0, 5, -12).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
            this.camera.position.lerp(this.position.clone().add(offset), 0.1);
            this.camera.lookAt(this.position.clone().add(new THREE.Vector3(0, 1, 5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation)));
        }
    }

    updateSparks(delta) {
        let color = 0x00ffff; // Blue
        if (this.manualDriftTime > 1.0) color = 0xffaa00; // Orange
        if (this.manualDriftTime > 2.0) color = 0xff00ff; // Purple

        this.sparks.forEach(s => {
            if (!s.mesh.visible && Math.random() < 0.2) {
                s.mesh.visible = true;
                s.life = 0.3;
                s.mesh.position.copy(this.position);
                s.mesh.material.color.setHex(color);

                const jitter = new THREE.Vector3((Math.random() - 0.5) * 2, 0, -2).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotation);
                s.mesh.position.add(jitter);
            }
            if (s.mesh.visible) {
                s.life -= delta;
                if (s.life <= 0) s.mesh.visible = false;
            }
        });
    }

    releaseDrift() {
        if (this.manualDriftTime > 0.5) {
            const duration = Math.min(this.manualDriftTime * 1.5, 7.0);
            this.applyBoost(duration);
        }
        this.isDriftingManual = false;
        this.manualDriftTime = 0;
        this.sparks.forEach(s => s.mesh.visible = false);
    }

    applyBoost(duration = 2.0) {
        this.boostTimer = duration;
    }
}
