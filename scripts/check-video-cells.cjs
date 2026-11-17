const fs = require('node:fs')
const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/check-video-cells.cjs <measurements.json>')
const result = JSON.parse(fs.readFileSync(file, 'utf8'))
const failures = []
let count = 0
for (const [id, steps] of Object.entries(result.videos)) {
  for (const [i, step] of steps.entries()) {
    count++
    const [left, top, right, bottom] = step.world
    step.cellsOutside = step.cells.filter(({ rect }) => rect[0] < left - 1 || rect[1] < top - 1 || rect[2] > right + 1 || rect[3] > bottom + 1).map(({ id }) => id)
    step.allCellsVisible = step.cells.length > 0 && step.cellsOutside.length === 0
    if (!step.allCellsVisible) failures.push({ id, step: i + 1, cells: step.cellsOutside })
  }
}
result.visibilityFailures = failures
fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
console.log(`${Object.keys(result.videos).length} videos, ${count} steps, ${failures.length} cell visibility failures`)
if (!count || failures.length || result.errors.length) { console.error(JSON.stringify({ failures, errors: result.errors }, null, 2)); process.exitCode = 1 }
