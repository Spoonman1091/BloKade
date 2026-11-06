// Writes e2e/fixtures/chest-plate.stl: a 254 x 305 x 6.4 mm plate with two raised blocks.
// Run: npx tsx scripts/make-split-fixture.ts
import { writeFileSync } from 'node:fs'
import { plateStl } from '../src/split/test-meshes'

const stl = plateStl({
  width: 254,
  depth: 305,
  base: 6.4,
  // Neither block touches the middle cuts (x = 0, y = 0), so joints still get made there.
  raised: [
    { x: [-90, -40], y: [40, 110], height: 8 },
    { x: [50, 100], y: [-120, -60], height: 5 },
  ],
})
writeFileSync('e2e/fixtures/chest-plate.stl', Buffer.from(stl))
