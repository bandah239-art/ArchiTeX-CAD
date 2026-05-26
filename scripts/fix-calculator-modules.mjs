import fs from 'fs';
import path from 'path';

const dir = 'src/components/Calculator/modules';
const files = [
  'BiogasCalculator.tsx',
  'HydroCalculator.tsx',
  'WindWakeCalculator.tsx',
  'ConsolidationCalculator.tsx',
  'PilesCalculator.tsx',
  'SlopeStabilityCalculator.tsx',
  'GroundImprovementCalculator.tsx',
  'TunnelingCalculator.tsx',
  'StormwaterCalculator.tsx',
  'LandfillCalculator.tsx',
  'IrrigationCalculator.tsx',
  'WTPCalculator.tsx',
];

for (const name of files) {
  const fp = path.join(dir, name);
  let s = fs.readFileSync(fp, 'utf8');
  s = s.replace(/import \{ api \} from '\.\.\/\.\.\/\.\.\/services\/api';\r?\n\r?\n/, '');
  s = s.replace(/  const handleCalculate = async \(\) => \{[\s\S]*?  \};\r?\n\r?\n  return \(/, '  return (');
  s = s.replace(/onClick=\{handleCalculate\}/g, 'onClick={() => void runCalculation()}');
  s = s.replace(/Record<string, any>/g, 'Record<string, unknown>');
  s = s.replace(/\(key: string, value: any\)/g, '(key: string, value: unknown)');
  s = s.replace(/value=\{inputs\.(\w+) \|\| (\d+(?:\.\d+)?)\}/g, 'value={(inputs.$1 as number) || $2}');
  s = s.replace(/value=\{inputs\.(\w+) \|\| '([^']+)'\}/g, "value={(inputs.$1 as string) || '$2'}");
  fs.writeFileSync(fp, s);
  console.log('fixed', name);
}
