import * as THREE from 'three';

export class ItemSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.projectiles = [];
        this.mines = [];
        this.itemSlotElem = document.getElementById('item-slot');

        this.types = ['BOOST', 'MISSILE', 'MINE'];
    }

    // Agora aceita um racer (Player ou AI)
    collectItem(racer) {
        if (!racer.currentItem) {
            let item;
            if (racer.isAI) {
                // IAs não pegam Boost, apenas MISSILE ou MINE
                const aiTypes = ['MISSILE', 'MINE'];
                item = aiTypes[Math.floor(Math.random() * aiTypes.length)];
            } else {
                item = this.types[Math.floor(Math.random() * this.types.length)];
            }

            racer.currentItem = item;
            if (racer === this.player) this.updateHUD();
        }
    }

    useItem(racer) {
        if (!racer.currentItem) return;

        const item = racer.currentItem;

        if (item === 'BOOST') {
            racer.applyBoost(7.0);
            if (racer === this.player) this.showMessage("SUPER BOOST (7S)!");
        } else if (item === 'MISSILE') {
            this.fireMissile(racer);
            if (racer === this.player) this.showMessage("MISSILE FIRED!");
        } else if (item === 'MINE') {
            this.dropMine(racer);
            if (racer === this.player) this.showMessage("MINE DROPPED!");
        }

        racer.currentItem = null;
        if (racer === this.player) this.updateHUD();
    }

    fireMissile(racer) {
        const geo = new THREE.BoxGeometry(0.5, 0.5, 2);
        const mat = new THREE.MeshBasicMaterial({ color: racer.isAI ? 0xff0000 : 0xff4400 });
        const missile = new THREE.Mesh(geo, mat);

        missile.position.copy(racer.position);

        // Precisão de 48% para IAs
        let shootDirection = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), racer.rotation);

        if (racer.isAI) {
            const isAccurate = Math.random() < 0.48;
            if (!isAccurate) {
                // Erro de pontaria: desvio lateral entre 15 e 45 graus
                const errorAngle = (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.6);
                shootDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), errorAngle);
            }
        }

        missile.lookAt(missile.position.clone().add(shootDirection));
        this.scene.add(missile);

        this.projectiles.push({
            mesh: missile,
            velocity: shootDirection.clone().multiplyScalar(150),
            life: 3.0,
            owner: racer
        });
    }

    dropMine(racer) {
        const geo = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 8);
        const mat = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0xff0000 });
        const mine = new THREE.Mesh(geo, mat);

        // Solta um pouco atrás do carro
        const backward = new THREE.Vector3(0, 0, -3).applyAxisAngle(new THREE.Vector3(0, 1, 0), racer.rotation);
        mine.position.copy(racer.position).add(backward);
        mine.position.y = 0.2;

        this.scene.add(mine);
        this.mines.push({ mesh: mine, owner: racer });
    }

    updateHUD() {
        if (this.itemSlotElem) {
            this.itemSlotElem.innerText = this.player.currentItem || 'EMPTY';
        }
    }

    showMessage(text) {
        const msg = document.getElementById('hud-messages');
        if (msg) {
            msg.innerText = text;
            setTimeout(() => { if (msg.innerText === text) msg.innerText = ''; }, 2000);
        }
    }

    update(time, delta, allRacers) {
        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.addScaledVector(p.velocity, delta);
            p.life -= delta;

            // Collision with racers (não atinge o dono)
            allRacers.forEach(target => {
                if (target !== p.owner && p.mesh.position.distanceTo(target.position) < 8) {
                    target.velocity.multiplyScalar(0.2);
                    p.life = 0;
                }
            });

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            }
        }

        // Update mines
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            allRacers.forEach(target => {
                if (target !== m.owner && m.mesh.position.distanceTo(target.position) < 5) {
                    target.velocity.multiplyScalar(0.1);
                    this.scene.remove(m.mesh);
                    this.mines.splice(i, 1);
                }
            });
        }
    }
}
