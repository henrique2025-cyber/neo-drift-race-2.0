import * as THREE from 'three';

export class SpeedParticles {
    constructor(scene) {
        this.scene = scene;
        this.count = 200;
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count * 3);

        for (let i = 0; i < this.count; i++) {
            this.resetParticle(i);
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.material = new THREE.PointsMaterial({
            color: 0x00ffcc,
            size: 0.5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);
    }

    resetParticle(i) {
        this.positions[i * 3] = (Math.random() - 0.5) * 100;
        this.positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
        this.positions[i * 3 + 2] = Math.random() * 200;

        this.velocities[i * 3 + 2] = -50 - Math.random() * 100;
    }

    update(delta, vehicle) {
        const speedMult = vehicle.velocity.length() / vehicle.maxSpeed;
        this.material.opacity = speedMult * 0.8;

        const pos = vehicle.position;
        const quat = vehicle.mesh.quaternion;

        this.points.position.copy(pos);
        this.points.quaternion.copy(quat);

        for (let i = 0; i < this.count; i++) {
            this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * delta * (1 + speedMult);

            if (this.positions[i * 3 + 2] < -50) {
                this.positions[i * 3 + 2] = 150;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
    }
}
