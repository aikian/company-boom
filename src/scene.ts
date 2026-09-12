import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BONUS, Game, targets } from './game';

type Piece = { position: THREE.Vector3; velocity: THREE.Vector3; rotation: THREE.Euler; spin: THREE.Vector3; dims: THREE.Vector3; life: number; paper: boolean };
type Flash = { sprite: THREE.Sprite; life: number; maxLife: number; size: number };
type Ring = { mesh: THREE.Mesh; life: number };
export type SceneEvent = 'crash';
const WINDOW = 0x36494b; const BROKEN_WINDOW = 0x171d21;
const rand = (spread: number) => (Math.random() - .5) * spread;

export class OfficeScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, .1, 90);
  building = new THREE.Group();
  floors: THREE.Group[] = [];
  targetGroups: THREE.Group[] = [];
  stamp = new THREE.Group();
  particles: THREE.InstancedMesh;
  pieces: Piece[] = [];
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  point = new THREE.PointLight(0xffd84d, 0, 16);
  beam: THREE.Mesh;
  ring: THREE.Mesh;
  sign: THREE.Mesh;
  windows: THREE.Mesh[] = [];
  props: THREE.Mesh[] = [];
  flashes: Flash[] = [];
  rings: Ring[] = [];
  targetKinds = [-1, -1, -1, -1, -1, -1];
  kicks = [0, 0, 0, 0, 0, 0];
  clock = 0; stage = 0; reduced = false; quality = 1; shake = 0; hitstop = 0; damage = 0; beamLife = 0;
  onEvent?: (event: SceneEvent) => void;
  private probeFrames = 0; private probeTime = 0;
  private dummy = new THREE.Object3D();
  private meshes = new Map<string, THREE.BufferGeometry>();
  private materials = new Map<number, THREE.MeshStandardMaterial>();
  private raycaster = new THREE.Raycaster();
  private pickMeshes: THREE.Mesh[] = [];
  private resizeObserver: ResizeObserver;
  private project = new THREE.Vector3();
  private look = new THREE.Vector3(0, 2.2, 0);
  private tmp = new THREE.Vector3();
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
    this.camera.position.set(11, 9, 15.4);
    this.camera.lookAt(this.look);
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
    // The model is assembled from shared low-poly geometry; every box remembers its size so it can fly apart later.
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
        this.windows.push(this.box(group, [1.12, .77, .05], [x, 1.03, -1.68], WINDOW));
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
        pick.position.set(target.position.x, .75, .2); pick.userData.index = index; pick.userData.pick = true; group.add(pick); this.pickMeshes.push(pick);
      }
      this.plant(group, 2.6, .12, -1.2, .65);
      this.props.push(this.box(group, [.45, .7, .42], [-2.6, .44, -1.15], 0xdac79c));
    }
    const roof = new THREE.Group(); roof.position.y = 5.68; this.building.add(roof); this.floors.push(roof);
    this.box(roof, [6.8, .26, 4], [0, 0, 0], 0xe7e2d6);
    this.box(roof, [2, .6, 1.3], [1.5, .4, -.4], 0x819194);
    for (let i = 0; i < 6; i++) this.box(roof, [1.65, .04, .07], [1.5, .72, -.87 + i * .18], 0x3d4d51);
    this.props.push(this.box(roof, [.07, 1.1, .07], [-2.4, .7, -.8], 0xa8b3b0));
    this.box(roof, [.9, .06, .06], [-2.4, 1.14, -.8], 0xa8b3b0);
    this.box(roof, [4.5, .8, .16], [-.4, .69, 1.65], 0x212b2a);
    this.sign = this.label('주식회사 내일부터', '#d5fc71', '#212b2a', 1024, 180);
    this.sign.scale.set(4.23, .74, 1); this.sign.position.set(-.4, .69, 1.75); roof.add(this.sign);
    this.plant(this.building, -3.7, .1, 1.4, 1.2);
    this.plant(this.building, 3.7, .1, -1.35, 1.4);
    for (let i = 0; i < 3; i++) this.box(this.building, [.4, .12, .7], [1.8 + i * .6, .1, 2.25], 0xd7daaf);
    for (const prop of this.props) prop.userData.rz = prop.rotation.z;
    // A restrained city backdrop gives scale without distracting from the office.
    const city = new THREE.Group(); this.scene.add(city);
    for (let i = 0; i < 12; i++) {
      const h = 1 + ((i * 7) % 5) * .45;
      this.box(city, [.9 + i % 2 * .35, h, 1], [(i - 5.5) * 1.5, h / 2 - .1, -5 - i % 3], 0x242d32);
    }
    this.particles = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .65 }), 700);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false; this.particles.count = 0; this.particles.castShadow = true; this.scene.add(this.particles);
    const glow = document.createElement('canvas'); glow.width = glow.height = 64;
    const g = glow.getContext('2d')!; const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.35, 'rgba(255,255,255,.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
    const glowTexture = new THREE.CanvasTexture(glow);
    for (let i = 0; i < 14; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sprite.visible = false; this.scene.add(sprite); this.flashes.push({ sprite, life: 0, maxLife: 1, size: 1 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.rotation.x = Math.PI / 2; mesh.visible = false; this.scene.add(mesh); this.rings.push({ mesh, life: 0 });
    }
    const beamMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, opacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; uniform float time; uniform float opacity; void main(){float core=pow(1.-abs(vUv.x-.5)*2.,2.); float pulse=.85+.15*sin(vUv.y*45.-time*12.); gl_FragColor=vec4(mix(vec3(.53,.35,1.),vec3(.88,1.,.5),core)*2.,core*pulse*opacity);}' });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(.7, 1.4, 20, 32, 1, true), beamMaterial); this.beam.position.set(0, 7, 0); this.beam.visible = false; this.scene.add(this.beam);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, .035, 8, 80), new THREE.MeshBasicMaterial({ color: 0xdbff8c, transparent: true, opacity: 0 }));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 1.5; this.scene.add(this.ring);
    this.createStamp(); this.stamp.visible = false; this.scene.add(this.stamp);
    this.composer = new EffectComposer(this.renderer); this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .38, .35, 1.7); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(container); this.resize();
    this.renderer.domElement.addEventListener('pointerdown', event => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this.camera);
      const hits = this.raycaster.intersectObjects(this.pickMeshes, false); if (hits.length) this.onHit(hits[0].object.userData.index);
    });
  }
  private mat(color: number) { if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .68 })); return this.materials.get(color)!; }
  private box(parent: THREE.Object3D, dimensions: number[], position: number[], color: number, radius = .035) {
    const key = [...dimensions, radius].join('/');
    if (!this.meshes.has(key)) this.meshes.set(key, new RoundedBoxGeometry(dimensions[0], dimensions[1], dimensions[2], 1, radius));
    const mesh = new THREE.Mesh(this.meshes.get(key), this.mat(color)); mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.dims = dimensions; parent.add(mesh); return mesh;
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
  // The finale leaves a leaving-work stamp where the building stood.
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
    } else if (kind === BONUS) {
      // Golden "urgent request": a gilded tray piled with red-flagged papers and a desk bell.
      this.box(group, [1.5, .1, .95], [0, .6, 0], 0xe0b23a);
      for (const x of [-.55, .55]) this.box(group, [.12, .5, .7], [x, .3, 0], 0x8a6d1f);
      for (let i = 0; i < 6; i++) this.box(group, [.7, .045, .5], [-.1 + i * .03, .69 + i * .05, .02], i % 2 ? 0xfff4d6 : 0xff665a);
      this.box(group, [.2, .12, .2], [.5, .72, -.25], 0xffd84d);
      this.box(group, [.3, .05, .3], [.5, .64, -.25], 0xe0b23a);
      this.box(group, [.06, .18, .06], [.5, .86, -.25], 0xffe9a3);
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
    this.stage = 0; this.pieces.length = 0; this.stamp.visible = false; this.beam.visible = false; this.point.intensity = 0;
    this.shake = this.hitstop = this.damage = this.beamLife = 0; this.building.visible = true; this.building.rotation.set(0, 0, 0);
    this.building.traverse(object => { object.visible = true; });
    for (const window of this.windows) { window.material = this.mat(WINDOW); window.rotation.set(0, 0, 0); }
    for (const prop of this.props) prop.rotation.z = prop.userData.rz;
    for (const flash of this.flashes) { flash.life = 0; flash.sprite.visible = false; }
    for (const ring of this.rings) { ring.life = 0; ring.mesh.visible = false; }
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    this.targetKinds.fill(-1); this.kicks.fill(0); this.sign.rotation.z = 0; this.look.set(0, 2.2, 0);
  }
  private get cap() { return this.reduced ? 90 : this.quality === 0 ? 220 : 700; }
  private spawn(position: THREE.Vector3, dims: THREE.Vector3, color: number, velocity: THREE.Vector3, life: number, paper: boolean) {
    if (this.pieces.length >= this.cap) return;
    this.pieces.push({ position: position.clone(), velocity, rotation: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3(rand(16), rand(16), rand(16)), dims, life, paper });
    this.particles.setColorAt(this.pieces.length - 1, new THREE.Color(color));
  }
  private sparks(position: THREE.Vector3, count: number, color: number, force = 1) {
    for (let i = 0; i < count; i++) {
      const size = .05 + Math.random() * .07;
      this.spawn(position, new THREE.Vector3(size, size, size), i % 3 === 0 ? 0xffffff : i % 3 === 1 ? 0xffd84d : color, new THREE.Vector3(rand(9), 2 + Math.random() * 6, rand(9) + 2).multiplyScalar(force), .45 + Math.random() * .5, false);
    }
  }
  private papers(position: THREE.Vector3, count: number) {
    for (let i = 0; i < count; i++) this.spawn(position, new THREE.Vector3(.2 + Math.random() * .12, .012, .28), i % 2 ? 0xf5f0e0 : 0xffd48b, new THREE.Vector3(rand(5), 3 + Math.random() * 4, rand(5) + 1.5), 2.2 + Math.random() * 1.8, true);
  }
  // Turns one modelled box into a flying chunk with the same size and colour, then hides the original.
  private shatterMesh(mesh: THREE.Mesh, center: THREE.Vector3, force: number) {
    const dims = mesh.userData.dims as number[] | undefined;
    if (mesh.userData.pick) return;
    mesh.visible = false;
    if (!dims) return;
    const position = mesh.getWorldPosition(new THREE.Vector3()); const scale = mesh.getWorldScale(this.tmp);
    const size = new THREE.Vector3(dims[0] * scale.x, dims[1] * scale.y, dims[2] * scale.z);
    const direction = position.clone().sub(center); direction.y = 0;
    if (direction.lengthSq() < 1e-4) direction.set(rand(1), 0, rand(1)); direction.normalize();
    const mass = Math.min(size.x * size.y * size.z, 2);
    const kick = (2.5 + Math.random() * 3.5) * force / (.4 + mass * 2);
    const velocity = new THREE.Vector3(direction.x * kick + rand(2), (2.5 + Math.random() * 4) * force / (.6 + mass), direction.z * kick + rand(2) + 1.2 * force);
    this.spawn(position, size, (mesh.material as THREE.MeshStandardMaterial).color.getHex(), velocity, 2.4 + Math.random() * 2.2, size.y < .06 && Math.max(size.x, size.z) > .3);
  }
  private shatter(root: THREE.Object3D, force = 1) {
    root.updateWorldMatrix(true, true);
    const center = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    const list: THREE.Mesh[] = [];
    root.traverse(object => { if ((object as THREE.Mesh).isMesh && object.visible) list.push(object as THREE.Mesh); });
    for (const mesh of list) this.shatterMesh(mesh, center, force);
    return center;
  }
  private flash(position: THREE.Vector3, size: number, color: number, life = .16) {
    const flash = this.flashes.find(f => f.life <= 0) ?? this.flashes[0];
    flash.life = flash.maxLife = life; flash.size = size; flash.sprite.visible = true; flash.sprite.position.copy(position);
    (flash.sprite.material as THREE.SpriteMaterial).color.set(color).multiplyScalar(3);
  }
  private shockwave(position: THREE.Vector3, color: number) {
    const ring = this.rings.find(r => r.life <= 0) ?? this.rings[0];
    ring.life = .45; ring.mesh.visible = true; ring.mesh.position.copy(position); (ring.mesh.material as THREE.MeshBasicMaterial).color.set(color);
  }
  private wreck() {
    this.damage++;
    const intact = this.windows.filter(window => window.material === this.mat(WINDOW));
    if (intact.length) { const window = intact[Math.floor(Math.random() * intact.length)]; window.material = this.mat(BROKEN_WINDOW); window.rotation.z = rand(.16); }
    const prop = this.props[Math.floor(Math.random() * this.props.length)]; prop.rotation.z = THREE.MathUtils.clamp(prop.rotation.z + rand(.9), -.7, .7);
  }
  hit(index: number, broken: boolean, kind: number) {
    const color = targets[kind].color; const group = this.targetGroups[index];
    this.kicks[index] = 1; this.point.intensity = broken ? 16 : 6; this.point.color.set(color);
    const origin = group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .6, .5));
    const few = this.reduced || this.quality === 0;
    if (broken) {
      this.shatter(group, 1.1);
      this.sparks(origin, few ? 6 : 16, color, 1.2); this.papers(origin, few ? 3 : kind === 0 ? 14 : 6);
      this.flash(origin, 2.8, color, .2); this.shockwave(origin, color); this.wreck();
      if (!this.reduced) { this.shake += .9; this.hitstop = .045; }
    } else {
      // Knock a loose part off so damage is visible before the target finally breaks.
      const parts = group.children.filter((child, i) => i > 2 && child.visible) as THREE.Mesh[];
      if (parts.length) this.shatterMesh(parts[Math.floor(Math.random() * parts.length)], group.getWorldPosition(this.tmp.clone()), .8);
      this.sparks(origin, few ? 3 : 7, color, .8); this.flash(origin, 1.4, color, .12);
      if (!this.reduced) this.shake += .3;
    }
  }
  // Mid-round exit beam: a short vertical blast that shatters every live target at once.
  strike(indices: number[]) {
    for (const index of indices) {
      const group = this.targetGroups[index]; const color = targets[Math.max(0, this.targetKinds[index])].color;
      const origin = group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .6, .5));
      this.shatter(group, 1.6); this.sparks(origin, this.reduced ? 4 : 12, color, 1.5); this.papers(origin, this.reduced ? 2 : 6);
      this.flash(origin, 2.4, color, .2); this.shockwave(origin, color); this.kicks[index] = 1;
    }
    this.flash(new THREE.Vector3(0, 3.2, 1), 7, 0xd5c8ff, .35); this.shockwave(new THREE.Vector3(0, .2, 0), 0xd5fc71);
    this.point.intensity = 40; this.point.color.set(0xd5fc71); this.wreck(); this.wreck();
    if (!this.reduced) { this.shake += 1.4; this.hitstop = .07; }
    this.beamLife = .55; this.beam.scale.x = this.beam.scale.z = .75;
  }
  resize() {
    this.size.w = this.container.clientWidth; this.size.h = this.container.clientHeight;
    this.camera.aspect = this.size.w / Math.max(this.size.h, 1);
    this.camera.fov = this.camera.aspect < .85 ? 48 : 35; this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.size.w, this.size.h); this.composer.setSize(this.size.w, this.size.h);
  }
  update(dt: number, game: Game, anchors: HTMLButtonElement[]) {
    let motionDt = Math.min(dt, .05); this.clock += motionDt;
    if (game.phase === 'paused') { this.render(); return; }
    if (this.hitstop > 0) { this.hitstop -= dt; motionDt = 0; }
    this.probeTime += dt; this.probeFrames++;
    if (this.probeTime > 3 && this.probeFrames > 20) {
      if (this.probeTime / this.probeFrames > .024 && this.quality > 0) { this.quality = 0; this.bloom.enabled = false; this.renderer.shadowMap.enabled = false; this.renderer.setPixelRatio(1); this.resize(); }
      this.probeTime = 0; this.probeFrames = 0;
    }
    for (let i = 0; i < 6; i++) {
      const slot = game.slots[i]; const group = this.targetGroups[i];
      if (slot.kind !== this.targetKinds[i]) this.createTarget(i, slot.kind);
      group.visible = slot.hp > 0 && this.stage === 0;
      this.kicks[i] *= Math.exp(-motionDt * 13);
      group.scale.set(1 + this.kicks[i] * .16, 1 - this.kicks[i] * .24, 1 + this.kicks[i] * .12);
      group.rotation.z = Math.sin(this.clock * 60) * this.kicks[i] * .09;
      group.position.y = slot.kind === BONUS && slot.hp > 0 && !this.reduced ? .18 + Math.abs(Math.sin(this.clock * 5)) * .12 : .18;
      group.getWorldPosition(this.project); this.project.y += .35; this.project.z += .9; this.project.project(this.camera);
      anchors[i].style.left = `${(this.project.x * .5 + .5) * this.size.w}px`;
      anchors[i].style.top = `${(-this.project.y * .5 + .5) * this.size.h}px`;
    }
    const finale = game.phase === 'finale' || game.phase === 'result';
    let distance = 1;
    if (finale) {
      const t = game.finaleTime; const power = game.beams > 0 ? 100 : game.rage;
      distance = this.reduced ? 1 : t < .9 ? 1 - .08 * Math.min(t / .6, 1) : 1 + Math.min((t - .9) / 2, 1) * .14;
      this.beam.visible = t > .6 && t < 2.4;
      const material = this.beam.material as THREE.ShaderMaterial; material.uniforms.time.value = this.clock;
      material.uniforms.opacity.value = Math.min(1, Math.max(0, (2.4 - t) / .7));
      this.beam.scale.x = this.beam.scale.z = .3 + power / 100;
      this.point.intensity = t < .9 ? t * 30 : Math.max(0, 30 - t * 8);
      // The beam strips the building top-down: roof, three floors, then the base and everything left.
      const stages = power >= 100 ? 5 : Math.max(1, Math.round(power / 25));
      const order = [this.floors[3], this.floors[2], this.floors[1], this.floors[0], this.building];
      while (this.stage < stages && t >= .9 + this.stage * .14) {
        const center = this.shatter(order[this.stage], 1.5 + power / 100); order[this.stage].visible = false;
        this.sparks(center, this.reduced ? 4 : 24, 0xd5fc71, 2); this.papers(center, this.reduced ? 4 : 18);
        this.flash(center, 5, 0xe0c8ff, .3); this.shockwave(center, 0xb8a4ff);
        if (!this.reduced) this.shake += .8;
        this.stage++; this.onEvent?.('crash');
      }
      if (t >= .9) { this.ring.scale.setScalar(1 + (t - .9) * 9); (this.ring.material as THREE.MeshBasicMaterial).opacity = this.reduced ? 0 : Math.max(0, 1 - (t - .9) * 1.5); }
      this.stamp.position.set(0, -.25, this.building.visible ? 3.6 : 0);
      this.stamp.visible = t > 2.7; this.stamp.scale.setScalar(Math.min(1, Math.max(0, (t - 2.7) * 2.5)));
      this.stamp.rotation.y = this.reduced ? 0 : this.clock * .25;
    } else {
      this.beamLife -= dt; this.beam.visible = this.beamLife > 0;
      if (this.beam.visible) { const material = this.beam.material as THREE.ShaderMaterial; material.uniforms.time.value = this.clock; material.uniforms.opacity.value = Math.min(1, this.beamLife / .35); }
      this.point.intensity *= Math.exp(-motionDt * 8);
      this.building.rotation.y = game.phase === 'ready' && !this.reduced ? Math.sin(this.clock * .35) * .025 : 0;
      this.sign.rotation.z = this.reduced ? 0 : Math.sin(this.clock * 2.2) * Math.min(this.damage * .006, .05) - Math.min(this.damage * .005, .08);
    }
    // The building sits higher on the landing page and drops toward the stamp once it is gone.
    const lookTarget = finale && !this.building.visible ? 1.1 : game.phase === 'ready' ? 2.2 : 1.85;
    this.look.y += (lookTarget - this.look.y) * Math.min(1, dt * 3);
    distance *= 1 - Math.min(this.shake, 1) * .03;
    this.camera.position.set(11 * distance + rand(this.shake * .7), 9 * distance + rand(this.shake * .6), 15.4 * distance);
    this.camera.lookAt(this.look); this.shake *= Math.exp(-dt * 7);
    for (const flash of this.flashes) {
      if (flash.life <= 0) continue;
      flash.life -= dt; const k = Math.max(0, flash.life / flash.maxLife);
      flash.sprite.scale.setScalar(flash.size * (1 + (1 - k) * 1.8)); (flash.sprite.material as THREE.SpriteMaterial).opacity = k * k;
      if (flash.life <= 0) flash.sprite.visible = false;
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      ring.life -= dt; const k = Math.max(0, ring.life / .45);
      ring.mesh.scale.setScalar(.3 + (1 - k) * 2.6); (ring.mesh.material as THREE.MeshBasicMaterial).opacity = k;
      if (ring.life <= 0) ring.mesh.visible = false;
    }
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i]; piece.life -= motionDt;
      if (piece.life <= 0) { const last = this.pieces.length - 1; this.pieces[i] = this.pieces[last]; const color = new THREE.Color(); this.particles.getColorAt(last, color); this.particles.setColorAt(i, color); this.pieces.pop(); continue; }
      if (piece.paper) { piece.velocity.y -= 2.2 * motionDt; piece.velocity.multiplyScalar(1 - motionDt * 1.6); piece.velocity.x += Math.sin(this.clock * 6 + i) * motionDt * 2.5; }
      else piece.velocity.y -= 16 * motionDt;
      piece.position.addScaledVector(piece.velocity, motionDt);
      const floor = Math.max(piece.dims.x, piece.dims.z) * .5 * (piece.paper ? .05 : .7) - .2;
      if (piece.position.y < floor) {
        piece.position.y = floor;
        if (piece.paper || Math.abs(piece.velocity.y) < 1.2) { piece.velocity.y = 0; piece.spin.multiplyScalar(0); piece.velocity.x *= .85; piece.velocity.z *= .85; }
        else { piece.velocity.y *= -.38; piece.velocity.x *= .6; piece.velocity.z *= .6; piece.spin.multiplyScalar(.45); }
      }
      piece.rotation.x += motionDt * piece.spin.x; piece.rotation.y += motionDt * piece.spin.y; piece.rotation.z += motionDt * piece.spin.z;
      this.dummy.position.copy(piece.position); this.dummy.rotation.copy(piece.rotation);
      const fade = Math.min(1, piece.life * 2.5); this.dummy.scale.set(piece.dims.x * fade, piece.dims.y * fade, piece.dims.z * fade); this.dummy.updateMatrix();
      this.particles.setMatrixAt(i, this.dummy.matrix);
    }
    this.particles.count = this.pieces.length; this.particles.instanceMatrix.needsUpdate = true;
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    this.render();
  }
  render() { this.composer.render(); }
  capture() { this.render(); return this.renderer.domElement.toDataURL('image/png'); }
}
