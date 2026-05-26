import { GeometricEntity, Constraint, ConstraintType, DOFAnalysis } from './ConstraintTypes';

export class DOFAnalyser {
  analyse(
    entities: GeometricEntity[],
    constraints: Constraint[]
  ): DOFAnalysis {
    const entityDOF = new Map<string, number>();

    // Initial DOF per entity type
    for (const e of entities) {
      entityDOF.set(e.id, this.initialDOF(e.type));
    }

    // Subtract DOF removed by each constraint
    for (const c of constraints) {
      const removed = this.dofRemoved(c.type);
      // Distribute evenly among involved entities
      if (c.entities.length > 0) {
        const perEntity = removed / c.entities.length;
        for (const id of c.entities) {
          const current = entityDOF.get(id) || 0;
          entityDOF.set(id, current - perEntity);
        }
      }
    }

    const totalDOF = Array.from(entityDOF.values()).reduce((sum, d) => sum + d, 0);

    const underConstrainedEntities: string[] = [];
    const overConstrainedEntities: string[] = [];

    for (const [id, d] of entityDOF.entries()) {
      if (d > 0) {
        underConstrainedEntities.push(id);
      } else if (d < 0) {
        overConstrainedEntities.push(id);
      }
    }

    let status: DOFAnalysis['status'] = 'under_constrained';
    if (totalDOF === 0) {
      status = 'fully_constrained';
    } else if (totalDOF < 0) {
      status = 'over_constrained';
    }

    return {
      totalDOF,
      perEntity: entityDOF,
      status,
      underConstrainedEntities,
      overConstrainedEntities
    };
  }

  private initialDOF(type: GeometricEntity['type']): number {
    const dofs: Record<GeometricEntity['type'], number> = {
      point: 2,
      line: 4,
      circle: 3,
      arc: 5
    };
    return dofs[type] ?? 2;
  }

  private dofRemoved(type: ConstraintType): number {
    const counts: Record<ConstraintType, number> = {
      horizontal:     1,
      vertical:       1,
      coincident:     2,
      fixed_distance: 1,
      equal_length:   1,
      parallel:       1,
      perpendicular:  1,
      angle:          1,
      tangent:        1,
      symmetric:      2,
      midpoint:       2,
      fixed_point:    2
    };
    return counts[type] ?? 1;
  }
}
