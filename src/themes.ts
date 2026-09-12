// Office themes only restyle the diorama: floor names, wall/slab colours, sign colours, lighting and backdrop.
// Targets, rules and scoring are identical in every theme.
export interface Theme {
  id: string; name: string; desc: string; emoji: string;
  floors: [string, string, string]; walls: [number, number, number];
  slab: number; trim: number; base: number; deck: number; city: number;
  sign: { bg: string; fg: string }; sky: [number, number]; sun: number; rim: number; exposure: number;
}
export const themes: Theme[] = [
  { id: 'default', name: '주식회사 내일부터', desc: '평범한 사무실. 평범하게 터뜨리기.', emoji: '🏢', floors: ['PRINT ROOM', 'OVERTIME', 'MEETING'], walls: [0x8e9caa, 0x94a695, 0xa8a0bb], slab: 0xe5dece, trim: 0xd9d3c7, base: 0x313b3e, deck: 0x5b6870, city: 0x242d32, sign: { bg: '#212b2a', fg: '#d5fc71' }, sky: [0xe6e5ff, 0x3a354f], sun: 0xffeed0, rim: 0xa19aff, exposure: 1.25 },
  { id: 'meeting', name: '회의 지옥', desc: '모든 층이 회의실. 끝나지 않는 회의를 끝내자.', emoji: '🔥', floors: ['MEETING A', 'MEETING B', 'MEETING C'], walls: [0x9c5a5a, 0x8a4a55, 0xa8606a], slab: 0xf0dcd0, trim: 0xe2c4b8, base: 0x3a2a2c, deck: 0x6a4a4e, city: 0x2e2224, sign: { bg: '#3b1f24', fg: '#ffb3a7' }, sky: [0xffd6d0, 0x4a2a30], sun: 0xffd8c8, rim: 0xff8a7a, exposure: 1.2 },
  { id: 'deadline', name: '마감 전날', desc: '새벽 2시. 모니터만 켜져 있다.', emoji: '🌙', floors: ['DEADLINE', 'ALL-NIGHTER', 'CRUNCH'], walls: [0x2e3a5c, 0x334266, 0x3a4a70], slab: 0xc9d0e0, trim: 0xb0b8cc, base: 0x1c2234, deck: 0x2e3850, city: 0x141a2a, sign: { bg: '#101a33', fg: '#8fd3ff' }, sky: [0x8fa8ff, 0x141a33], sun: 0x9fb8ff, rim: 0x5aa0ff, exposure: 1.05 },
  { id: 'yearend', name: '연말 정산', desc: '영수증이 눈처럼 내린다.', emoji: '🧾', floors: ['RECEIPTS', 'TAX ROOM', 'ACCOUNTING'], walls: [0x3f7a5c, 0x4a8a66, 0x36705a], slab: 0xf3ead0, trim: 0xe8d9a8, base: 0x2a3a30, deck: 0x4a6a55, city: 0x1f2c26, sign: { bg: '#1f3a2a', fg: '#ffd84d' }, sky: [0xfff0c8, 0x2a3d30], sun: 0xffe6a8, rim: 0xd5fc71, exposure: 1.25 },
];
export const themeById = (id: string) => themes.find(theme => theme.id === id) ?? themes[0];
