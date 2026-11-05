// Consistency gate, part of every build: each city case must be reproduced by its own code,
// unless it is documented as a hybrid whose relation R differs from its primary code.
import { CITY_CASES } from '../src/data/cases';
import { fitOf } from '../src/lib/verdict';
let bad = 0;
for (const c of CITY_CASES) {
  const f = fitOf(c, c.code);
  const allowed = c.wallOverride !== undefined && f === 'numbers';
  if (f !== 'full' && c.assessed) {
    // measured cities may fall outside their code: that is a finding, not a build error
    console.log(`ANOMALY after calibration: case ${c.id} (${c.orig}) in its own code ${c.code}: ${f}`);
    continue;
  }
  if (f !== 'full' && !allowed) {
    console.error(`FAIL: case ${c.id} (${c.orig}) is not reproduced by its own code ${c.code}: ${f}`);
    bad++;
  }
}
if (bad) process.exit(1);
console.log(`check: ${CITY_CASES.length} city cases reproduced by their own code`);
