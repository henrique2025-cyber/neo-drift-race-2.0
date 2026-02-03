import * as THREE from 'three';

export class Track {
    constructor(scene) {
        this.scene = scene;
        this.width = 50;

        this.points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 300),
            new THREE.Vector3(150, 0, 450),
            new THREE.Vector3(400, 0, 450),
            new THREE.Vector3(550, 0, 300),
            new THREE.Vector3(550, 0, 0),
            new THREE.Vector3(275, 0, -150),
            new THREE.Vector3(0, 0, 0)
        ];

        this.curve = new THREE.CatmullRomCurve3(this.points, true);
        this.guardrails = [];
        this.itemBoxes = [];

        this.createTrack();
    }

    createTrack() {
        const resolution = 200;

        // Textura Neon Pixelada para o chão (Remove a "linha preta")
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0a25'; ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 62, 62);
        ctx.fillStyle = '#110033'; ctx.fillRect(10, 10, 44, 44);

        const roadTex = new THREE.CanvasTexture(canvas);
        roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
        roadTex.repeat.set(2, 400);
        roadTex.magFilter = THREE.NearestFilter;

        const tubeGeo = new THREE.TubeGeometry(this.curve, resolution, 35, 8, true);
        const roadMat = new THREE.MeshPhongMaterial({
            map: roadTex,
            side: THREE.DoubleSide,
            emissive: 0x00ffff,
            emissiveIntensity: 0.1
        });
        this.mesh = new THREE.Mesh(tubeGeo, roadMat);
        this.scene.add(this.mesh);

        // Muretas visíveis e sólidas
        const wallGeo = new THREE.BoxGeometry(2, 5, 10);
        const wallMat = new THREE.MeshPhongMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.3 });

        for (let i = 0; i < resolution; i++) {
            const t = i / resolution;
            const p = this.curve.getPointAt(t);
            const tan = this.curve.getTangentAt(t);
            const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize().multiplyScalar(this.width / 2);

            const wallL = new THREE.Mesh(wallGeo, wallMat);
            wallL.position.copy(p).sub(side);
            wallL.lookAt(p.clone().sub(side).add(tan));
            this.scene.add(wallL);
            this.guardrails.push(wallL);

            const wallR = new THREE.Mesh(wallGeo, wallMat);
            wallR.position.copy(p).add(side);
            wallR.lookAt(p.clone().add(side).add(tan));
            this.scene.add(wallR);
            this.guardrails.push(wallR);

            // Cubos da Sorte (a cada X distância)
            if (i % 25 === 0) {
                this.addItemBox(p.clone().add(new THREE.Vector3(0, 3, 0)));
            }
        }

        // Grid Helping Ground
        const grid = new THREE.GridHelper(10000, 100, 0x00ffff, 0x110022);
        grid.position.y = -5;
        this.scene.add(grid);
    }

    addItemBox(pos) {
        const geo = new THREE.BoxGeometry(3, 3, 3);
        const mat = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.8
        });
        const box = new THREE.Mesh(geo, mat);
        box.position.copy(pos);
        this.scene.add(box);
        this.itemBoxes.push(box);
    }

    update(time) {
        this.itemBoxes.forEach(box => {
            box.rotation.y += 0.05;
            box.rotation.x += 0.02;
            box.position.y = 3 + Math.sin(time * 3) * 0.5;
        });
    }
}
