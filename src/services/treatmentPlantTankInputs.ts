/** Map WASH treatment-plant sizing summary → tank pressure API inputs. */
export function buildTankPressureInputsFromTreatment(
  inputs: Record<string, unknown>,
  summary: Record<string, unknown>
): Record<string, unknown> {
  const sedArea = Math.max(Number(summary.sed_area_m2 ?? 10), 1);
  const sedVol = Math.max(Number(summary.sed_volume_m3 ?? 20), 1);
  const flow = Number(inputs.flow_rate_m3h ?? 100);
  const rawH = Number(inputs.tank_height_m);
  const rawR = Number(inputs.tank_radius_m);
  const rawW = Number(inputs.tank_weight_kn);
  const height = rawH > 0 ? rawH : sedVol / sedArea;
  const radius = rawR > 0 ? rawR : Math.sqrt(sedArea / Math.PI);

  return {
    height: Math.max(height, 2),
    radius: Math.max(radius, 1),
    gamma_w: Number(inputs.gamma_w ?? 9.81),
    wind_force: Number(inputs.tank_wind_force_kn ?? 80),
    mu: Number(inputs.tank_friction_mu ?? 0.5),
    tank_weight: rawW > 0 ? rawW : sedVol * 10 + flow * 5,
  };
}
