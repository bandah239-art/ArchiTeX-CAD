import React, { useState } from 'react';
import { Camera, Upload, Play, FileText, PenTool } from 'lucide-react';
import { visionAPI } from '../../services/visionAPI';

export function VisionPanel() {
  const [images, setImages] = useState<string[]>([]);
  const [hint, setHint] = useState('');
  const [country, setCountry] = useState('ZM');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [svgData, setSvgData] = useState<string>('');
  const [report, setReport] = useState<string>('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string].slice(0, 8));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyse = async () => {
    if (images.length === 0) return;
    setIsAnalysing(true);
    setAnalysis(null);
    setSvgData('');
    setReport('');

    try {
      // Step 1: Process images
      const processedImages = await Promise.all(
        images.map(img => visionAPI.processImage({
          image_base64: img,
          structure_hint: hint,
          country_code: country
        }))
      );

      // We use the first image's metadata and geo_context as representative
      const mainContext = processedImages[0];

      // Step 2: Analyse structure
      let analysisResult;
      if (processedImages.length === 1) {
        analysisResult = await visionAPI.analyseStructure({
          image_base64: mainContext.processed_image_base64,
          metadata: mainContext.metadata,
          geo_context: mainContext.geo_context
        });
      } else {
        analysisResult = await visionAPI.analyseMultiImage({
          images: processedImages.map(p => p.processed_image_base64),
          metadata: mainContext.metadata,
          geo_context: mainContext.geo_context
        });
      }

      setAnalysis(analysisResult);

      // Step 3: Generate CAD
      const cadResult = await visionAPI.generateCAD(analysisResult);
      if (cadResult && cadResult.svg) {
        setSvgData(cadResult.svg);
      }

      // Step 4: Generate Report
      const reportResult = await visionAPI.generateReport(analysisResult);
      if (reportResult && reportResult.report) {
        setReport(reportResult.report);
      }
    } catch (error) {
      console.error("Vision Analysis Error:", error);
      alert("Failed to analyse structure.");
    } finally {
      setIsAnalysing(false);
    }
  };

  return (
    <div className="flex h-full bg-infra-bg text-infra-text overflow-hidden">
      {/* Input Column */}
      <div className="w-1/3 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-infra-highlight" />
            <h2 className="font-semibold text-gray-200">Vision Engine</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-infra-highlight hover:bg-gray-800/50 transition-colors">
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden" 
              id="image-upload" 
            />
            <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-300">Drop photos or click to upload</span>
              <span className="text-xs text-gray-500 mt-1">Up to 8 images (Max 20MB)</span>
            </label>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-700">
                  <img src={img} alt={`Upload ${i}`} className="object-cover w-full h-full" />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Structure Hint (Optional)</label>
              <input 
                type="text" 
                value={hint}
                onChange={e => setHint(e.target.value)}
                placeholder="e.g. Culvert on Kafue Road"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-infra-highlight"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Country</label>
                <select 
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-infra-highlight"
                >
                  <option value="ZM">🇿🇲 Zambia</option>
                  <option value="KE">🇰🇪 Kenya</option>
                  <option value="GH">🇬🇭 Ghana</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            onClick={handleAnalyse}
            disabled={images.length === 0 || isAnalysing}
            className="w-full py-3 bg-infra-highlight hover:bg-infra-highlight/90 text-white rounded font-medium flex justify-center items-center space-x-2 disabled:opacity-50"
          >
            {isAnalysing ? (
              <span className="animate-pulse">Analysing...</span>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Analyse Structure</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Output Column */}
      <div className="w-2/3 flex flex-col bg-gray-950">
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex space-x-4">
          <div className="flex items-center space-x-2 text-infra-highlight">
            <PenTool className="w-4 h-4" />
            <span className="font-medium text-sm">CAD Drawing</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <FileText className="w-4 h-4" />
            <span className="font-medium text-sm">Report</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 relative flex flex-col">
          {isAnalysing && (
            <div className="absolute inset-0 bg-gray-950/80 flex flex-col items-center justify-center z-10">
              <div className="w-16 h-16 border-4 border-infra-highlight border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-infra-highlight font-medium">Vision Engine is analysing...</p>
            </div>
          )}

          {!analysis && !isAnalysing && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <Camera className="w-16 h-16 mb-4 opacity-20" />
              <p>Upload an image to generate CAD and analysis report</p>
            </div>
          )}

          {svgData && (
            <div className="mb-8 border border-gray-800 rounded-lg overflow-hidden bg-white/5 p-4 flex justify-center">
              <div 
                className="max-w-full max-h-[500px]"
                dangerouslySetInnerHTML={{ __html: svgData }} 
              />
            </div>
          )}

          {report && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed">
                {report}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
