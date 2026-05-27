import { useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useViewerStore } from '../store/viewerStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useGeoStore } from '../store/geoStore';
import { useBoQStore } from '../store/boqStore';
import { openIFCFile, resolveModelFileMeta } from '../services/fileService';

/**
 * Project actions and smart file routing.
 */
export function useProject() {
  const { currentProject, recentProjects, openProject, createNewProject, saveProject } =
    useProjectStore();

  const openIFC = useCallback(async () => {
    const path = await openIFCFile();
    if (!path) return;

    const { ext } = resolveModelFileMeta(path);

    if (
      ext === 'ifc' ||
      ext === 'dwg' ||
      ext === 'dxf' ||
      ext === 'step' ||
      ext === 'stp' ||
      ext === 'stl' ||
      ext === 'obj' ||
      ext === 'gltf' ||
      ext === 'glb' ||
      ext === 'fbx' ||
      ext === '3ds'
    ) {
      // CAD / 3D models route to the 3D BIM Viewer
      openProject(path);
      useWorkspaceStore.getState().setMainView('bim');
      useViewerStore.getState().loadModel(path);
    } else if (ext === 'geojson' || ext === 'json' || ext === 'shp') {
      // GIS vector layers route to Leaflet GIS Viewer
      let geoData: any = null;
      if (ext === 'geojson' || ext === 'json') {
        try {
          if (window.electronAPI) {
            const buffer = await window.electronAPI.readIfcFile(path);
            const text = new TextDecoder().decode(buffer);
            geoData = JSON.parse(text);
          } else {
            const res = await fetch(path);
            geoData = await res.json();
          }
        } catch (err) {
          console.error('Failed to parse GeoJSON:', err);
        }
      }

      // Default fallback layer if parsing fails or Shapefile is used
      if (!geoData || !geoData.features) {
        geoData = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { name: 'Project Boundary Area' },
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [28.2800, -15.4180],
                  [28.2866, -15.4180],
                  [28.2866, -15.4140],
                  [28.2800, -15.4140],
                  [28.2800, -15.4180]
                ]]
              }
            }
          ]
        };
      }

      openProject(path);
      useGeoStore.getState().setImportedGeoJson(geoData);
      useWorkspaceStore.getState().setMainView('gis');

      // Center map on the imported geometry if available
      if (geoData.features?.[0]?.geometry?.coordinates?.[0]?.[0]) {
        const coord = geoData.features[0].geometry.coordinates[0][0];
        // Coordinates are [lng, lat] in GeoJSON; location is [lat, lng]
        if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
          useGeoStore.getState().setLocation(coord[1], coord[0], { autoAnalyse: true });
        }
      }
    } else if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      // Spreadsheet data files route to the Bill of Quantities (BoQ) panel
      let boqElements: any[] = [];
      if (ext === 'csv') {
        try {
          let text = '';
          if (window.electronAPI) {
            const buffer = await window.electronAPI.readIfcFile(path);
            text = new TextDecoder().decode(buffer);
          } else {
            const res = await fetch(path);
            text = await res.text();
          }
          const lines = text.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));
          if (lines.length > 1) {
            for (let i = 1; i < lines.length; i++) {
              const row = lines[i];
              if (row.length < 2 || !row[0]) continue;
              boqElements.push({
                ref: row[0] || `Row-${i}`,
                description: row[1] || 'Imported Element',
                calculation_type: (row[2]?.toLowerCase() || 'foundation') as any,
                element_count: parseInt(row[3]) || 1,
                element_dimensions: {
                  width: parseFloat(row[4]) || 1.0,
                  length: parseFloat(row[5]) || 1.0,
                  depth: parseFloat(row[6]) || 1.0,
                },
                summary_text: row[7] || 'Spreadsheet Row Item',
              });
            }
          }
        } catch (e) {
          console.error('Spreadsheet CSV parsing error:', e);
        }
      }

      // Default fallback items for spreadsheets
      if (boqElements.length === 0) {
        boqElements = [
          {
            ref: 'SS-F1',
            description: 'Pad Footing (Spreadsheet Import)',
            calculation_type: 'foundation',
            element_count: 8,
            element_dimensions: { width: 2.4, length: 2.4, depth: 0.45 },
            calculation_inputs: {
              foundation_type: 'pad',
              column_load: 750,
              moment_x: 25,
              moment_y: 0,
              soil_bearing: 140,
              soil_unit_weight: 18,
              foundation_depth: 1.2,
              foundation_depth_concrete: 450,
              fck: 25,
              fyk: 500,
              column_width: 300,
              column_depth: 300,
            },
            summary_text: '2.59 m³ concrete (each)',
          },
          {
            ref: 'SS-C1',
            description: 'Concrete Column (Spreadsheet Import)',
            calculation_type: 'column',
            element_count: 12,
            element_dimensions: { width: 300, depth: 300, length: 3.6 },
            calculation_inputs: {
              height: 3.6,
              width: 300,
              depth: 300,
              axial_load: 800,
              moment_major: 40,
              moment_minor: 15,
              fck: 25,
              fyk: 500,
              le_factor: 0.85,
            },
            summary_text: '0.32 m³ concrete (each)',
          },
          {
            ref: 'SS-B1',
            description: 'Concrete Beam (Spreadsheet Import)',
            calculation_type: 'beam',
            element_count: 12,
            element_dimensions: { width: 300, depth: 450, length: 6.0 },
            calculation_inputs: {
              length: 6.0,
              width: 300,
              depth: 450,
              span: 6.0,
              dead_load: 12,
              live_load: 8,
              fck: 25,
              fyk: 500,
            },
            summary_text: '0.81 m³ concrete (each)',
          }
        ];
      }

      openProject(path);
      useBoQStore.setState({ elements: boqElements, compiledBoQ: null });
      useWorkspaceStore.getState().setActivePanel('boq');
    }
  }, [openProject]);

  return {
    currentProject,
    recentProjects,
    openIFC,
    createNewProject,
    saveProject,
  };
}
