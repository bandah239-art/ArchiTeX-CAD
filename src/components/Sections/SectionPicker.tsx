import { useState } from 'react';

const SANS_BEAMS: Record<string, any> = {
  "203x133x25": { mass: 25.1, A: 32.0, Ixx: 2340.0, Iyy: 308.0, Zxx: 231.0, Zyy: 46.3, h: 203, b: 133, tf: 7.8, tw: 5.7 },
  "254x146x31": { mass: 31.1, A: 39.7, Ixx: 4410.0, Iyy: 512.0, Zxx: 348.0, Zyy: 70.1, h: 254, b: 146, tf: 8.6, tw: 6.0 },
  "305x165x40": { mass: 40.3, A: 51.3, Ixx: 8500.0, Iyy: 945.0, Zxx: 561.0, Zyy: 115.0, h: 305, b: 165, tf: 10.2, tw: 6.0 },
  "356x171x45": { mass: 45.3, A: 57.7, Ixx: 12100.0, Iyy: 1120.0, Zxx: 681.0, Zyy: 131.0, h: 356, b: 171, tf: 9.7, tw: 7.0 },
};

const SANS_COLUMNS: Record<string, any> = {
  "152x152x23": { mass: 23.0, A: 29.3, Ixx: 1250.0, Iyy: 400.0, Zxx: 164.0, Zyy: 52.6, h: 152, b: 152, tf: 6.8, tw: 5.8 },
  "203x203x46": { mass: 46.1, A: 58.7, Ixx: 4570.0, Iyy: 1540.0, Zxx: 450.0, Zyy: 152.0, h: 203, b: 203, tf: 11.0, tw: 7.2 },
  "254x254x73": { mass: 73.1, A: 93.1, Ixx: 11400.0, Iyy: 3890.0, Zxx: 896.0, Zyy: 307.0, h: 254, b: 254, tf: 14.2, tw: 8.6 },
};

interface SectionPickerProps {
  onSectionSelect?: (props: { Wpl: number; Aw: number; sectionName: string }) => void;
}

export function SectionPicker({ onSectionSelect }: SectionPickerProps) {
  const [sectionType, setSectionType] = useState<'ub' | 'uc'>('ub');
  const [selectedSection, setSelectedSection] = useState('203x133x25');

  const activeDB = sectionType === 'ub' ? SANS_BEAMS : SANS_COLUMNS;
  const sectionData = activeDB[selectedSection] || activeDB[Object.keys(activeDB)[0]];

  const handleSelect = (sec: string) => {
    setSelectedSection(sec);
    if (onSectionSelect) {
      const data = activeDB[sec];
      // Convert Sxx (plastic modulus) and Web Area for Steel calculator
      const Sxx = data.Zxx * 1.12;  // approximate Sxx from Zxx
      const Aw = (data.h * data.tw) / 100.0; // cm2
      onSectionSelect({
        Wpl: Sxx,
        Aw: Aw,
        sectionName: `${sectionType.toUpperCase()} ${sec}`
      });
    }
  };

  const handleOptimize = () => {
    // Basic optimization loop (find section with mass < 45 and Ixx > 3000)
    const candidates = Object.entries(activeDB).filter(([_, data]: any) => data.Ixx >= 3000.0);
    if (candidates.length > 0) {
      const best = candidates.reduce((prev: any, curr: any) => (prev[1].mass < curr[1].mass ? prev : curr));
      handleSelect(best[0]);
      alert(`Optimised Section found: ${best[0]} (${best[1].mass} kg/m)`);
    } else {
      alert('No sections satisfy criteria.');
    }
  };

  return (
    <div className="bg-[#1a2238]/90 p-5 rounded-xl border border-infra-accent/30 text-white space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-infra-accent/20">
        <h3 className="text-xs font-bold text-infra-highlight uppercase tracking-wider">SANS Steel Sections</h3>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">SANS 10162</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column: Selector */}
        <div className="space-y-3">
          <div className="flex bg-[#11192e] border border-gray-700 rounded overflow-hidden">
            <button
              onClick={() => { setSectionType('ub'); handleSelect(Object.keys(SANS_BEAMS)[0]); }}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${sectionType === 'ub' ? 'bg-infra-accent text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              Universal Beams (UB)
            </button>
            <button
              onClick={() => { setSectionType('uc'); handleSelect(Object.keys(SANS_COLUMNS)[0]); }}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${sectionType === 'uc' ? 'bg-infra-accent text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
              Universal Columns (UC)
            </button>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Select Section Profile</label>
            <select
              value={selectedSection}
              onChange={(e) => handleSelect(e.target.value)}
              className="w-full bg-[#11192e] border border-infra-accent/40 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-infra-highlight"
            >
              {Object.keys(activeDB).map((sec) => (
                <option key={sec} value={sec}>{sec} SANS</option>
              ))}
            </select>
          </div>

          <div className="bg-[#11192e] p-3 rounded border border-infra-accent/20 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Section Weight:</span>
              <span className="font-mono font-bold text-white">{sectionData.mass} kg/m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cross Section Area:</span>
              <span className="font-mono font-bold text-white">{sectionData.A} cm²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Second Moment Ixx:</span>
              <span className="font-mono font-bold text-sky-400">{sectionData.Ixx} cm⁴</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Section Modulus Zxx:</span>
              <span className="font-mono font-bold text-sky-400">{sectionData.Zxx} cm³</span>
            </div>
          </div>
        </div>

        {/* Right Column: Diagram */}
        <div className="flex flex-col items-center justify-between bg-[#11192e] p-4 rounded-xl border border-infra-accent/20 h-full min-h-[180px]">
          <span className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Section Geometry Sketch</span>
          
          <div className="w-24 h-28 flex items-center justify-center relative">
            <svg viewBox="0 0 100 120" className="w-full h-full text-infra-highlight/80 stroke-infra-highlight fill-infra-highlight/10">
              {/* I-Beam outline sketch */}
              <polygon points="10,10 90,10 90,20 55,20 55,100 90,100 90,110 10,110 10,100 45,100 45,20 10,20" strokeWidth="2" />
              {/* Dimension indicators */}
              <line x1="5" y1="10" x2="5" y2="110" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="10" y1="115" x2="90" y2="115" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
            </svg>
            <span className="absolute -left-1 top-1/2 transform -translate-y-1/2 text-[9px] font-mono text-gray-400">{sectionData.h}mm</span>
            <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-[9px] font-mono text-gray-400">{sectionData.b}mm</span>
          </div>

          <button
            onClick={handleOptimize}
            className="w-full py-1.5 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition-colors"
          >
            OPTIMISE: FIND MINIMUM SECTION
          </button>
        </div>
      </div>
    </div>
  );
}
