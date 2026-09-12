import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Game, targets } from './game';

type Piece = { position: THREE.Vector3; velocity: THREE.Vector3; rotation: THREE.Euler; spin: number; size: number; life: number; paper: boolean };
export class OfficeScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, .1, 90);
  building = new THREE.Group();
  floors: THREE.Group[] = [];
  targetGroups: THREE.Group[] = [];
  cake = new THREE.Group();
  stamp = new THREE.Group();
  particles: THREE.InstancedMesh;
  pieces: Piece[] = [];
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  point = new THREE.PointLight(0xd8ff80, 0, 15);
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  sign: THREE.Mesh;
  targetKinds = [-1, -1, -1, -1, -1, -1];
  kicks = [0, 0, 0, 0, 0, 0];
  clock = 0; exploded = false; reduced = false; birthday = false; quality = 1;
  private probeFrames = 0; private probeTime = 0;
  private dummy = new THREE.Object3D();
  private meshes = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private raycaster = new THREE.Raycaster();
  private pickMeshes: THREE.Mesh[] = [];
  private resizeObserver: ResizeObserver;
  private project = new THREE.Vector3();
  private size = { w: 1, h: 1 };
  constructor(public container: HTMLElement, public onHit: (index: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x14171c, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', '3층짜리 미니어처 사무실. 표적 버튼을 눌러 부술 수 있습니다.');
    container.prepend(this.renderer.domElement);
    this.camera.position.set(10, 8.2, 14);
    this.camera.lookAt(0, 2.6, 0);
    this.scene.add(new THREE.HemisphereLight(0xe6e5ff, 0x3a354f, 2.8));
    const sun = new THREE.DirectionalLight(0xffeed0, 4.5); sun.position.set(-3, 10, 7); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -6;
    sun.shadow.bias = -.001; this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa19aff, 3); rim.position.set(6, 5, -5); this.scene.add(rim);
    this.scene.add(this.point); this.point.position.set(0, 4, 5);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .22 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -.25; ground.receiveShadow = true; this.scene.add(ground);
    this.scene.add(this.building);
    this.box(this.building, [8.2, .32, 5.2], [0, -.12, 0], 0x313b3e, .15);
    this.box(this.building, [7.9, .08, 4.9], [0, .08, 0], 0x5b6870);
    // The model is assembled from shared low-poly geometry and materials.
    for (let floor = 0; floor < 3; floor++) {
      const group = new THREE.Group(); group.position.y = floor * 1.8 + .18; this.building.add(group); this.floors.push(group);
      this.box(group, [6.6, .22, 3.8], [0, 0, 0], 0xe5dece);
      this.box(group, [6.6, 1.65, .16], [0, .9, -1.8], [0x8e9caa, 0x94a695, 0xa8a0bb][floor]);
      for (const x of [-3.16, 3.16]) {
        this.box(group, [.22, 1.8, 3.8], [x, .85, 0], 0xd9d3c7);
        this.box(group, [.26, 1.8, .26], [x, .85, 1.78], 0xeae4d7);
      }
      this.box(group, [6.5, .12, .14], [0, 1.58, -1.6], 0xf9e8a2);
      for (const x of [-2.15, -.72, .72, 2.15]) {
        this.box(group, [1.12, .77, .05], [x, 1.03, -1.68], 0x36494b);
        this.box(group, [.025, .8, .06], [x, 1.03, -1.64], 0xc2d4c5);
        this.box(group, [1.12, .025, .06], [x, 1.03, -1.64], 0xc2d4c5);
      }
      const plate = this.label(`0${floor + 1}F  /  ${['PRINT ROOM', 'OVERTIME', 'MEETING'][floor]}`, '#2c353b', '#f5eedc', 512, 90);
      plate.scale.set(1.7, .30, 1); plate.position.set(-2.1, -.025, 1.94); group.add(plate);
      for (let side = 0; side < 2; side++) {
        const index = floor * 2 + side;
        const target = new THREE.Group(); target.position.set(side === 0 ? -1.5 : 1.45, .18, .18);
        group.add(target); this.targetGroups.push(target);
        const pick = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.25, 2.1), new THREE.MeshBasicMaterial({ visible: false }));
        pick.position.set(target.position.x, .75, .2); pick.userData.index = index; group.add(pick); this.pickMeshes.push(pick);
      }
      this.plant(group, 2.6, .12, -1.2, .65);
      this.box(group, [.45, .7, .42], [-2.6, .44, -1.15], 0xdac79c);
    }
    const roof = new THREE.Group(); roof.position.y = 5.68; this.building.add(roof); this.floors.push(roof);
    this.box(roof, [6.8, .26, 4], [0, 0, 0], 0xe7e2d6);
    this.box(roof, [2, .6, 1.3], [1.5, .4, -.4], 0x819194);
    for (let i = 0; i < 6; i++) this.box(roof, [1.65, .04, .07], [1.5, .72, -.87 + i * .18], 0x3d4d51);
    this.box(roof, [.07, 1.1, .07], [-2.4, .7, -.8], 0xa8b3b0);
    this.box(roof, [.9, .06, .06], [-2.4, 1.14, -.8], 0xa8b3b0);
    this.box(roof, [4.5, .8, .16], [-.4, .69, 1.65], 0x212b2a);
    this.sign = this.label('주식회사 내일부터', '#d5fc71', '#212b2a', 1024, 180);
    this.sign.scale.set(4.23, .74, 1); this.sign.position.set(-.4, .69, 1.75); roof.add(this.sign);
    this.plant(this.building, -3.7, .1, 1.4, 1.2);
    this.plant(this.building, 3.7, .1, -1.35, 1.4);
    for (let i = 0; i < 3; i++) this.box(this.building, [.4, .12, .7], [1.8 + i * .6, .1, 2.25], 0xd7daaf);
    // A restrained city backdrop gives scale without distracting from the office.
    const city = new THREE.Group(); this.scene.add(city);
    for (let i = 0; i < 12; i++) {
      const h = 1 + ((i * 7) % 5) * .45;
      this.box(city, [.9 + i % 2 * .35, h, 1], [(i - 5.5) * 1.5, h / 2 - .1, -5 - i % 3], 0x242d32);
    }
    this.particles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .65 }), 500);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false; this.particles.count = 0; this.scene.add(this.particles);
    const beamMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, opacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; uniform float time; uniform float opacity; void main(){float core=pow(1.-abs(vUv.x-.5)*2.,2.); float pulse=.85+.15*sin(vUv.y*45.-time*12.); gl_FragColor=vec4(mix(vec3(.53,.35,1.),vec3(.88,1.,.5),core)*2.,core*pulse*opacity);}' });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.7, 1.4, 20, 32, 1, true), beamMaterial); this.beam.position.set(0, 7, 0); this.beam.visible = false; this.scene.add(this.beam);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, .035, 8, 80), new THREE.MeshBasicMaterial({ color: 0xdbff8c, transparent: true, opacity: 0 }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 1.5; this.scene.add(this.ring);
    this.createCake(); this.cake.visible = false; this.scene.add(this.cake);
    this.createStamp(); this.stamp.visible = false; this.scene.add(this.stamp);
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .32, .35, 1.5); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    this.renderer.domElement.addEventListener('pointerdown', event => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      const hits = this.raycaster.intersectObjects(this.pickMeshes, false); if (hits.length) this.onHit(hits[0].object.userData.index);
    });
  }
  private mat(color: number) { if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .68 })); return this.materials.get(color)!; }
  private box(parent: THREE.Group, dimensions: number[], position: number[], color: number, radius = .035) {
    const key = [...dimensions, radius].join('/');
    if (!this.meshes.has(key)) this.meshes.set(key, new RoundedBoxGeometry(dimensions[0], dimensions[1], dimensions[2], 1, radius));
    const mesh = new THREE.Mesh(this.meshes.get(key), this.mat(color)); mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  private plant(parent: THREE.Group, x: number, y: number, z: number, size: number) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(size); parent.add(group);
    this.box(group, [.36, .42, .36], [0, .21, 0], 0xccbdaa, .06);
    for (let i = 0; i < 5; i++) {
      const leaf = this.box(group, [.13, .6, .2], [Math.sin(i * 2) * .15, .65 + (i % 2) * .08, Math.cos(i * 2) * .15], [0x6fa883, 0xa6bc88][i % 2], .055);
      leaf.rotation.z = Math.sin(i * 2) * .4;
    }
  }
  private label(text: string, color: string, background: string, w: number, h: number) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = color; ctx.font = `800 ${h * .52}px "Malgun Gothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2, w * .93);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture, transparent: !background }));
  }
  setName(name: string) {
    const material = this.sign.material as THREE.MeshBasicMaterial;
    const canvas = material.map!.image as HTMLCanvasElement; const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#212b2a'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#d5fc71'; ctx.fillText(name, canvas.width / 2, canvas.height / 2, canvas.width * .93); material.map!.needsUpdate = true;
  }
  private createCake() {
    for (const [radius, height, y, color] of [[1.1, .15, .2, 0xe9e5d1], [.9, .65, .6, 0xb6a0e2], [.92, .15, .98, 0xffe9be]]) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), this.mat(color)); mesh.position.y = y; this.cake.add(mesh);
    }
    for (let i = 0; i < 5; i++) {
      const x = Math.sin(i * 1.26) * .5; const z = Math.cos(i * 1.26) * .5;
      this.box(this.cake, [.07, .4, .07], [x, 1.22, z], 0xe9fbaa);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdc78 })); flame.scale.y = 1.6; flame.position.set(x, 1.5, z); this.cake.add(flame);
    }
  }
  // Normal mode ends with a leaving-work stamp instead of the birthday cake.
  private createStamp() {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, .14, 40), this.mat(0xff665a)); plate.position.y = .2; this.stamp.add(plate);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .05, 40), this.mat(0xfff0e6)); inner.position.y = .29; this.stamp.add(inner);
    const text = this.label('퇴근', '#ff665a', '', 256, 256); text.rotation.x = -Math.PI / 2; text.scale.setScalar(1.2); text.position.y = .33; this.stamp.add(text);
    this.box(this.stamp, [.34, .9, .34], [0, .72, 0], 0x2f3437, .08);
    this.box(this.stamp, [.62, .22, .62], [0, 1.25, 0], 0xd5fc71, .08);
  }
  private createTarget(index: number, kind: number) {
    const group = this.targetGroups[index]; group.clear();
    if (kind === 0) {
      this.box(group, [1.9, .11, 1.05], [0, .61, 0], 0xb39572);
      for (const x of [-.72, .72]) this.box(group, [.1, .55, .75], [x, .3, 0], 0x485557);
      for (let i = 0; i < 5; i++) this.box(group, [.63, .05, .48], [-.3 + i * .04, .71 + i * .05, .02], i % 2 ? 0xf1ede0 : 0xffd48b);
      this.box(group, [.38, .025, .55], [.57, .71, .08], 0xd1a19a);
      this.box(group, [.15, .21, .15], [.65, .83, -.3], 0xf2e8cf);
    } else if (kind === 1) {
      this.box(group, [1.3, .65, .88], [0, .38, 0], 0x9a93b7);
      this.box(group, [1.4, .15, .98], [0, .77, 0], 0xd4cce5);
      this.box(group, [.74, .055, .56], [-.16, .88, -.02], 0x333e4a);
      this.box(group, [.86, .09, .08], [0, .37, .46], 0x35434d);
      this.box(group, [.66, .025, .45], [0, .33, .62], 0xfff0cd);
      this.box(group, [.18, .04, .13], [.48, .87, .24], 0xd7ff7d);
    } else {
      this.box(group, [1.9, .12, 1.04], [0, .64, 0], 0x7fa99a);
      for (const x of [-.76, .76]) this.box(group, [.1, .59, .82], [x, .31, 0], 0x465457);
      this.box(group, [.88, .58, .11], [-.12, 1.08, -.26], 0x334348);
      this.box(group, [.75, .45, .015], [-.12, 1.08, -.196], 0xa5d6bf);
      for (let i = 0; i < 3; i++) this.box(group, [.39 - i * .07, .025, .018], [-.2, 1.2 - i * .1, -.18], 0x426e64);
      this.box(group, [.08, .2, .1], [-.12, .77, -.26], 0x334348);
      this.box(group, [.66, .04, .26], [-.12, .74, .29], 0xc4d3b7);
      this.box(group, [.2, .25, .2], [.65, .82, -.2], 0xffd691);
    }
    this.targetKinds[index] = kind;
  }
  reset() {
    this.exploded = false; this.pieces.length = 0; this.cake.visible = this.stamp.visible = false; this.beam.visible = false; this.point.intensity = 0;
    this.floors.forEach((floor, i) => { floor.position.set(0, i === 3 ? 5.68 : i * 1.8 + .18, 0); floor.rotation.set(0, 0, 0); floor.scale.setScalar(1); });
    this.building.rotation.set(0, 0, 0); this.kicks.fill(0);
  }
  burst(position: THREE.Vector3, count: number, color: number, force = 1) {
    const cap = this.quality === 0 ? 80 : 240;
    for (let i = 0; i < count && this.pieces.length < cap; i++) {
      const paper = i % 3 === 0;
      this.pieces.push({ position: position.clone(), velocity: new THREE.Vector3((Math.random() - .5) * 5, 2 + Math.random() * 4, (Math.random() - .5) * 5).multiplyScalar(force), rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), spin: (Math.random() - .5) * 10, size: paper ? .15 : .09 + Math.random() * .18, life: 1.2 + Math.random() * 1.2, paper });
      this.particles.setColorAt(this.pieces.length - 1, new THREE.Color(i % 4 === 0 ? 0xd5fc71 : i % 4 === 1 ? 0xf5e9cd : color));
    }
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
  }
  hit(index: number, broken: boolean, kind: number) {
    this.kicks[index] = 1; this.point.intensity = broken ? 12 : 5;
    this.point.color.set(targets[kind].color);
    const origin = this.targetGroups[index].getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .65, .6));
    this.burst(origin, this.reduced ? 3 : broken ? 22 : 5, targets[kind].color);
  }
  resize() {
    this.size.w = this.container.clientWidth; this.size.h = this.container.clientHeight;
    this.camera.aspect = this.size.w / Math.max(this.size.h, 1);
    this.camera.fov = this.camera.aspect < .85 ? 44 : 35; this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.size.w, this.size.h); this.composer.setSize(this.size.w, this.size.h);
  }
  update(dt: number, game: Game, anchors: HTMLButtonElement[]) {
    const motionDt = Math.min(dt, .05); this.clock += motionDt;
    if (game.phase === 'paused') { this.render(); return; }
    this.probeTime += dt; this.probeFrames++;
    if (this.probeTime > 3 && this.probeFrames > 20) {
      if (this.probeTime / this.probeFrames > .024 && this.quality > 0) { this.quality = 0; this.bloom.enabled = false; this.renderer.shadowMap.enabled = false; this.renderer.setPixelRatio(1); this.resize(); }
      this.probeTime = 0; this.probeFrames = 0;
    }
    for (let i = 0; i < 6; i++) {
      const slot = game.slots[i]; const group = this.targetGroups[i];
      if (slot.kind !== this.targetKinds[i]) this.createTarget(i, slot.kind);
      group.visible = slot.hp > 0 && !this.exploded;
      this.kicks[i] *= Math.exp(-motionDt * 13);
      group.scale.set(1 + this.kicks[i] * .13, 1 - this.kicks[i] * .19, 1 + this.kicks[i] * .1);
      group.rotation.z = Math.sin(this.clock * 60) * this.kicks[i] * .07;
      group.getWorldPosition(this.project); this.project.y += .35; this.project.z += .9; this.project.project(this.camera);
      anchors[i].style.left = `${(this.project.x * .5 + .5) * this.size.w}px`;
      anchors[i].style.top = `${(-this.project.y * .5 + .5) * this.size.h}px`;
    }
    const finale = game.phase === 'finale' || game.phase === 'result';
    let distance = 1;
    if (finale) {
      const t = game.finaleTime;
      distance = this.reduced ? 1 : t < .9 ? 1 - .07 * Math.min(t / .6, 1) : 1 + Math.min((t - .9) / 2, 1) * .1;
      this.beam.visible = t > .6 && t < 2.4;
      const material = this.beam.material as THREE.ShaderMaterial; material.uniforms.time.value = this.clock;
      material.uniforms.opacity.value = Math.min(1, Math.max(0, (2.4 - t) / .7));
      this.beam.scale.x = this.beam.scale.z = .3 + game.rage / 100;
      this.point.intensity = t < .9 ? t * 30 : Math.max(0, 25 - t * 8);
      if (t >= .9 && !this.exploded) {
        this.exploded = true;
        for (let i = 0; i < 6; i++) this.burst(this.targetGroups[i].getWorldPosition(new THREE.Vector3()), this.reduced ? 4 : 30, targets[i % 3].color, 1.5);
      }
      if (this.exploded) {
        this.floors.forEach((floor, i) => {
          const p = Math.max(0, t - .9 - i * .12);
          floor.position.x = (i % 2 ? -1 : 1) * p * (this.reduced ? .2 : 2.5);
          floor.position.y = (i === 3 ? 5.68 : i * 1.8 + .18) + p * 2 - p * p * 2;
          floor.rotation.z = this.reduced ? 0 : p * (i % 2 ? -.3 : .3);
          floor.scale.setScalar(Math.max(0, 1 - Math.max(0, p - .3) * .7));
        });
        this.ring.scale.setScalar(1 + Math.max(0, t - .9) * 9);
        (this.ring.material as THREE.MeshBasicMaterial).opacity = this.reduced ? 0 : Math.max(0, 1 - (t - .9) * 1.5);
      }
      const prop = this.birthday ? this.cake : this.stamp;
      prop.visible = t > 2.7; prop.scale.setScalar(Math.min(1, Math.max(0, (t - 2.7) * 2.5)));
      prop.rotation.y = this.reduced ? 0 : this.clock * .25;
    } else {
      this.point.intensity *= Math.exp(-motionDt * 8);
      this.building.rotation.y = game.phase === 'ready' && !this.reduced ? Math.sin(this.clock * .35) * .025 : 0;
      this.sign.rotation.z = !this.reduced ? Math.sin(this.clock * 2) * Math.min(game.destroyed / 500, .035) : 0;
    }
    this.camera.position.set(10 * distance, 8.2 * distance, 14 * distance); this.camera.lookAt(0, 2.6, 0);
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]; piece.life -= motionDt;
      if (piece.life <= 0) { const last = this.pieces.length - 1; this.pieces[i] = this.pieces[last]; const color = new THREE.Color(); this.particles.getColorAt(last, color); this.particles.setColorAt(i, color); this.pieces.pop(); continue; }
      piece.velocity.y -= (piece.paper ? 2.5 : 8) * motionDt; piece.position.addScaledVector(piece.velocity, motionDt);
      if (piece.position.y < .1) { piece.position.y = .1; piece.velocity.y *= -.3; piece.velocity.x *= .8; piece.velocity.z *= .8; }
      piece.rotation.x += motionDt * piece.spin; piece.rotation.z += motionDt * piece.spin * .6;
      this.dummy.position.copy(piece.position); this.dummy.rotation.copy(piece.rotation);
      const scale = piece.size * Math.min(1, piece.life * 3); this.dummy.scale.set(scale, piece.paper ? scale * .08 : scale, scale); this.dummy.updateMatrix();
      this.particles.setMatrixAt(i, this.dummy.matrix);
    }
    this.particles.count = this.pieces.length; this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    this.render();
  }
  render() { this.composer.render(); }
  capture() { this.render(); return this.renderer.domElement.toDataURL('image/png'); }
}
