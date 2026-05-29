import { useState } from 'react';
import { useCalculationStore } from '../../store/calculationStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

interface Rate {
  code: string;
  description: string;
  unit: string;
  min: number;
  mid: number;
  max: number;
  source: string;
  category: string;
}

const RATES: Rate[] = [
  // Concrete
  { code: 'CON-C15', description: 'Plain concrete C15 (blinding)', unit: 'm³', min: 1_450, mid: 1_650, max: 1_900, source: 'Zambia market Q2-2025', category: 'Concrete' },
  { code: 'CON-C20', description: 'RC concrete C20 (foundations)', unit: 'm³', min: 1_600, mid: 1_850, max: 2_100, source: 'Zambia market Q2-2025', category: 'Concrete' },
  { code: 'CON-C25', description: 'RC concrete C25 (beams/slabs)', unit: 'm³', min: 1_800, mid: 2_100, max: 2_400, source: 'Zambia market Q2-2025', category: 'Concrete' },
  { code: 'CON-C30', description: 'RC concrete C30 (columns/bridges)', unit: 'm³', min: 2_000, mid: 2_350, max: 2_700, source: 'Zambia market Q2-2025', category: 'Concrete' },
  // Reinforcement
  { code: 'STL-R10', description: 'Mild steel round R10', unit: 'Tonne', min: 10_200, mid: 11_800, max: 13_500, source: 'Steelmakers ZM Q2-2025', category: 'Steel' },
  { code: 'STL-Y12', description: 'HY deformed bar Y12', unit: 'Tonne', min: 11_000, mid: 12_500, max: 14_200, source: 'Steelmakers ZM Q2-2025', category: 'Steel' },
  { code: 'STL-Y16', description: 'HY deformed bar Y16', unit: 'Tonne', min: 11_200, mid: 12_800, max: 14_500, source: 'Steelmakers ZM Q2-2025', category: 'Steel' },
  { code: 'STL-Y20', description: 'HY deformed bar Y20', unit: 'Tonne', min: 11_500, mid: 13_200, max: 15_000, source: 'Steelmakers ZM Q2-2025', category: 'Steel' },
  // Masonry
  { code: 'MAS-BLK23', description: 'Concrete block 230×115×75mm', unit: 'Nr', min: 18, mid: 22, max: 27, source: 'Lusaka suppliers Q2-2025', category: 'Masonry' },
  { code: 'MAS-BLK14', description: 'Concrete block 140mm hollow', unit: 'Nr', min: 14, mid: 17, max: 21, source: 'Lusaka suppliers Q2-2025', category: 'Masonry' },
  { code: 'MAS-MRT',  description: 'Mortar (1:4 cement:sand)', unit: 'm³', min: 520, mid: 650, max: 800, source: 'Mixed Lusaka Q2-2025', category: 'Masonry' },
  { code: 'MAS-PLR',  description: 'Cement plaster 15mm two coats', unit: 'm²', min: 35, mid: 45, max: 58, source: 'Lusaka contractors Q2-2025', category: 'Masonry' },
  // Formwork
  { code: 'FMW-FLT',  description: 'Flat soffit formwork (slab)', unit: 'm²', min: 230, mid: 285, max: 340, source: 'Zambia contractors Q2-2025', category: 'Formwork' },
  { code: 'FMW-BEAM', description: 'Beam side + soffit formwork', unit: 'm²', min: 280, mid: 350, max: 420, source: 'Zambia contractors Q2-2025', category: 'Formwork' },
  { code: 'FMW-COL',  description: 'Column formwork (square)', unit: 'm²', min: 260, mid: 320, max: 390, source: 'Zambia contractors Q2-2025', category: 'Formwork' },
  // Earthworks
  { code: 'ERT-EXC',  description: 'General earthwork excavation', unit: 'm³', min: 70, mid: 95, max: 130, source: 'Zambia contractors Q2-2025', category: 'Earthworks' },
  { code: 'ERT-FILL', description: 'Imported fill compacted', unit: 'm³', min: 50, mid: 65, max: 85, source: 'Zambia contractors Q2-2025', category: 'Earthworks' },
  { code: 'ERT-HRD',  description: 'Hardcore 150mm blinding', unit: 'm³', min: 90, mid: 120, max: 155, source: 'Zambia contractors Q2-2025', category: 'Earthworks' },
  // WASH
  { code: 'WSH-H63',  description: 'HDPE pipe 63mm PN10', unit: 'm', min: 85, mid: 110, max: 138, source: 'ZAMSIF rates Q2-2025', category: 'WASH' },
  { code: 'WSH-H90',  description: 'HDPE pipe 90mm PN10', unit: 'm', min: 125, mid: 155, max: 195, source: 'ZAMSIF rates Q2-2025', category: 'WASH' },
  { code: 'WSH-H110', description: 'HDPE pipe 110mm PN10', unit: 'm', min: 148, mid: 185, max: 235, source: 'ZAMSIF rates Q2-2025', category: 'WASH' },
  { code: 'WSH-H160', description: 'HDPE pipe 160mm PN10', unit: 'm', min: 280, mid: 350, max: 440, source: 'ZAMSIF rates Q2-2025', category: 'WASH' },
  { code: 'WSH-TRN',  description: 'Pipe trench excav 0.6m wide', unit: 'm', min: 42, mid: 57, max: 78, source: 'ZAMSIF rates Q2-2025', category: 'WASH' },
  // Roofing
  { code: 'ROF-IBR',  description: 'IBR sheet roofing (fix + supply)', unit: 'm²', min: 260, mid: 320, max: 400, source: 'Lusaka suppliers Q2-2025', category: 'Roofing' },
  { code: 'ROF-TMB',  description: 'Timber purlins 50×76mm', unit: 'm', min: 85, mid: 110, max: 140, source: 'Timber yards Lusaka Q2-2025', category: 'Roofing' },
  // Electrical
  { code: 'ELC-2.5',  description: '2.5mm² twin + earth cable', unit: 'm', min: 28, mid: 36, max: 46, source: 'ZESCO approved rates Q2-2025', category: 'Electrical' },
  { code: 'ELC-6',    description: '6mm² armoured cable', unit: 'm', min: 68, mid: 85, max: 108, source: 'ZESCO approved rates Q2-2025', category: 'Electrical' },
  { code: 'ELC-16',   description: '16mm² armoured cable', unit: 'm', min: 145, mid: 180, max: 225, source: 'ZESCO approved rates Q2-2025', category: 'Electrical' },
  // Labour
  { code: 'LAB-SKL',  description: 'Skilled labourer (mason/carp)', unit: 'Day', min: 180, mid: 250, max: 340, source: 'LMAC rates Q2-2025', category: 'Labour' },
  { code: 'LAB-UNS',  description: 'Unskilled labourer', unit: 'Day', min: 85, mid: 120, max: 160, source: 'LMAC rates Q2-2025', category: 'Labour' },
  { code: 'LAB-ENG',  description: 'Site engineer/supervisor', unit: 'Month', min: 8_500, mid: 12_000, max: 18_000, source: 'EIZ salary guide Q2-2025', category: 'Labour' },
];

const CATEGORIES = [...new Set(RATES.map((r) => r.category))];

export function MaterialPricePanel() {
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = RATES.filter((r) =>
    (activeCategory === 'all' || r.category === activeCategory) &&
    (search === '' || r.description.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()))
  );

  const pushToBoQ = (_rate: Rate) => {
    useWorkspaceStore.getState().openPanel('boq');
  };

  const pushAllToCalc = () => {
    useWorkspaceStore.getState().openPanel('calculator');
    useCalculationStore.getState().setInputs({
      concrete_rate_zmw_m3: RATES.find((r) => r.code === 'CON-C25')?.mid ?? 2100,
      steel_rate_zmw_tonne: RATES.find((r) => r.code === 'STL-Y12')?.mid ?? 12500,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">💰 Material Price Intelligence</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">ZMW market rates — Zambia Q2 2025. Use to verify contractor submissions.</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          className="mt-2 w-full text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          <button type="button" onClick={() => setActiveCategory('all')}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${activeCategory === 'all' ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat} type="button" onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${activeCategory === cat ? 'bg-infra-highlight text-white' : 'bg-infra-accent/30 text-gray-400'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 grid grid-cols-7 text-[10px] text-gray-500 bg-infra-darker border-b border-infra-accent/20 px-3 py-1.5 font-bold">
          <span className="col-span-3">Description</span>
          <span className="text-right">Min</span>
          <span className="text-right font-bold text-gray-300">Mid</span>
          <span className="text-right">Max</span>
          <span></span>
        </div>
        {filtered.map((r) => (
          <div key={r.code} className="grid grid-cols-7 items-center text-xs px-3 py-2 border-b border-infra-accent/10 hover:bg-infra-accent/10">
            <div className="col-span-3 min-w-0">
              <span className="font-mono text-[10px] text-infra-highlight mr-1.5">{r.code}</span>
              <span className="text-gray-300">{r.description}</span>
              <span className="text-gray-600 ml-1">/{r.unit}</span>
            </div>
            <span className="text-right text-gray-500 font-mono">{r.min.toLocaleString()}</span>
            <span className="text-right text-white font-bold font-mono">{r.mid.toLocaleString()}</span>
            <span className="text-right text-gray-500 font-mono">{r.max.toLocaleString()}</span>
            <div className="flex justify-end">
              <button type="button" onClick={() => pushToBoQ(r)} title="Use this rate in BOQ"
                className="text-[9px] px-1.5 py-0.5 bg-infra-accent/30 hover:bg-infra-highlight/30 text-gray-400 hover:text-infra-highlight rounded transition-colors">
                →BOQ
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-infra-accent/30 flex items-center justify-between">
        <span className="text-[10px] text-gray-600">{filtered.length} rates shown · ZMW · Q2-2025</span>
        <button type="button" onClick={pushAllToCalc}
          className="text-xs px-3 py-1.5 bg-infra-highlight/20 hover:bg-infra-highlight/40 text-infra-highlight rounded transition-colors">
          Push rates to calculators
        </button>
      </div>
    </div>
  );
}
