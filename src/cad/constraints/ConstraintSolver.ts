import { GeometricEntity, Constraint, SolverResult } from './ConstraintTypes';
import { DOFAnalyser } from './DOFAnalyser';
import { ConstraintGraph } from './ConstraintGraph';

export class ConstraintSolver {
  private MAX_ITERATIONS = 100;
  private TOLERANCE = 1e-10;
  private DAMPING = 0.5;

  private entityIndices = new Map<string, number[]>();

  solve(
    entities: GeometricEntity[],
    constraints: Constraint[]
  ): SolverResult {
    // Apply procedural pre-solver to resolve simple direct constraints first
    this.proceduralPreSolve(entities, constraints);

    // Build parameter vector x
    // All entity params flattened into one array
    this.entityIndices.clear();
    const x = this.buildParameterVector(entities);
    const fixedIndices = this.getFixedIndices(entities);

    let currentX = [...x];
    let iterations = 0;
    let converged = false;

    // If there are no constraints, return immediately
    if (constraints.length === 0) {
      return {
        converged: true,
        iterations: 0,
        residual: 0,
        dof_remaining: this.countDOF(entities, constraints),
        status: 'under_constrained',
        conflicts: [],
        updated_entities: entities
      };
    }

    while (iterations < this.MAX_ITERATIONS) {
      // Evaluate constraint equations F(x)
      const F = this.evaluateConstraints(currentX, constraints, entities);

      // Check convergence
      const residual = this.norm(F);
      if (residual < this.TOLERANCE) {
        converged = true;
        break;
      }

      // Build Jacobian J = ∂F/∂x (only for free variables)
      const J = this.buildJacobian(currentX, constraints, entities, fixedIndices);

      // Solve J · delta = -F
      const delta = this.solveLinearSystem(J, F);

      if (!delta) {
        // Singular matrix or calculation failure -> conflict/over-constrained
        return this.buildConflictResult(entities, constraints, iterations, currentX);
      }

      // Map delta back to the free parameters and apply update
      let deltaIdx = 0;
      currentX = currentX.map((xi, i) => {
        if (fixedIndices.includes(i)) {
          return xi;
        } else {
          const val = xi + this.DAMPING * delta[deltaIdx];
          deltaIdx++;
          return val;
        }
      });

      iterations++;
    }

    // Update entities with solved parameters
    const updated = this.updateEntities(entities, currentX);
    const finalResidual = this.evaluateResidual(currentX, constraints, entities);

    return {
      converged,
      iterations,
      residual: finalResidual,
      dof_remaining: this.countDOF(entities, constraints),
      status: this.determineStatus(converged, entities, constraints),
      conflicts: converged ? [] : this.findConflicts(constraints, currentX, entities),
      updated_entities: updated
    };
  }

  private proceduralPreSolve(entities: GeometricEntity[], constraints: Constraint[]): void {
    let changed = true;
    let iteration = 0;
    while (changed && iteration < 5) {
      changed = false;
      for (const c of constraints) {
        if (c.type === 'fixed_point') {
          const ent = entities.find(e => e.id === c.entities[0]);
          if (ent && !ent.fixed) {
            ent.fixed = true;
            if (c.params && c.params.length >= 2) {
              ent.params[0] = c.params[0];
              ent.params[1] = c.params[1];
            }
            changed = true;
          }
        } else if (c.type === 'horizontal') {
          const ent = entities.find(e => e.id === c.entities[0]);
          if (ent && ent.type === 'line' && ent.params[3] !== ent.params[1]) {
            ent.params[3] = ent.params[1];
            changed = true;
          }
        } else if (c.type === 'vertical') {
          const ent = entities.find(e => e.id === c.entities[0]);
          if (ent && ent.type === 'line' && ent.params[2] !== ent.params[0]) {
            ent.params[2] = ent.params[0];
            changed = true;
          }
        } else if (c.type === 'coincident') {
          if (c.entities.length >= 2) {
            const ent1 = entities.find(e => e.id === c.entities[0]);
            const ent2 = entities.find(e => e.id === c.entities[1]);
            if (ent1 && ent2 && ent1.type === 'point' && ent2.type === 'point') {
              if (ent2.params[0] !== ent1.params[0] || ent2.params[1] !== ent1.params[1]) {
                ent2.params[0] = ent1.params[0];
                ent2.params[1] = ent1.params[1];
                if (ent1.fixed) ent2.fixed = true;
                changed = true;
              }
            }
          }
        }
      }
      iteration++;
    }
  }

  private buildParameterVector(entities: GeometricEntity[]): number[] {
    const x: number[] = [];
    for (const ent of entities) {
      const indices: number[] = [];
      for (let i = 0; i < ent.params.length; i++) {
        indices.push(x.length);
        x.push(ent.params[i]);
      }
      this.entityIndices.set(ent.id, indices);
    }
    return x;
  }

  private getFixedIndices(entities: GeometricEntity[]): number[] {
    const fixedIndices: number[] = [];
    for (const ent of entities) {
      if (ent.fixed) {
        const idxs = this.entityIndices.get(ent.id);
        if (idxs) {
          fixedIndices.push(...idxs);
        }
      }
    }
    return fixedIndices;
  }

  private getEntityParams(
    entityIds: string[],
    x: number[]
  ): number[] {
    const params: number[] = [];
    for (const id of entityIds) {
      const idxs = this.entityIndices.get(id);
      if (idxs) {
        for (const idx of idxs) {
          params.push(x[idx]);
        }
      }
    }
    return params;
  }

  private updateEntities(
    entities: GeometricEntity[],
    x: number[]
  ): GeometricEntity[] {
    return entities.map((ent) => {
      const idxs = this.entityIndices.get(ent.id);
      if (idxs) {
        const nextParams = idxs.map((idx) => x[idx]);
        return {
          ...ent,
          params: nextParams
        };
      }
      return ent;
    });
  }

  private evaluateConstraints(
    x: number[],
    constraints: Constraint[],
    entities: GeometricEntity[]
  ): number[] {
    const F: number[] = [];

    for (const c of constraints) {
      const F_c = this.evaluateSingleConstraint(c, x, entities);
      F.push(...F_c);
    }

    return F;
  }

  private evaluateSingleConstraint(
    c: Constraint,
    x: number[],
    entities: GeometricEntity[]
  ): number[] {
    const F_c: number[] = [];
    const params = this.getEntityParams(c.entities, x);
    if (params.length === 0) return [];

    switch (c.type) {
      case 'horizontal': {
        // z2 - z1 = 0
        if (params.length >= 4) {
          const [, z1, , z2] = params;
          F_c.push(z2 - z1);
        }
        break;
      }

      case 'vertical': {
        // x2 - x1 = 0
        if (params.length >= 4) {
          const [x1, , x2] = params;
          F_c.push(x2 - x1);
        }
        break;
      }

      case 'coincident': {
        // Coincident between first point of A and first point of B
        // For any entity, first two parameters are (x, z) of its start or center
        const entA = entities.find(e => e.id === c.entities[0]);
        if (entA && c.entities.length >= 2) {
          const numParamsA = entA.params.length;
          if (params.length >= numParamsA + 2) {
            const ax = params[0];
            const az = params[1];
            const bx = params[numParamsA];
            const bz = params[numParamsA + 1];
            F_c.push(ax - bx);
            F_c.push(az - bz);
          }
        }
        break;
      }

      case 'fixed_distance': {
        // Distance constraint
        const d = c.params[0] ?? 0;
        if (c.entities.length === 1 && params.length >= 4) {
          // Fixed distance of endpoints of a line
          const [x1, z1, x2, z2] = params;
          const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          F_c.push(dist - d);
        } else if (c.entities.length >= 2) {
          // Distance between first points of entity A and B
          const entA = entities.find(e => e.id === c.entities[0]);
          if (entA) {
            const numParamsA = entA.params.length;
            if (params.length >= numParamsA + 2) {
              const ax = params[0];
              const az = params[1];
              const bx = params[numParamsA];
              const bz = params[numParamsA + 1];
              const dist = Math.sqrt((bx - ax) ** 2 + (bz - az) ** 2);
              F_c.push(dist - d);
            }
          }
        }
        break;
      }

      case 'equal_length': {
        // Length of line AB = Length of line CD
        if (params.length >= 8) {
          const [x1, z1, x2, z2, x3, z3, x4, z4] = params;
          const len1 = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
          const len2 = Math.sqrt((x4 - x3) ** 2 + (z4 - z3) ** 2);
          F_c.push(len1 - len2);
        }
        break;
      }

      case 'parallel': {
        // Cross product of direction vectors = 0
        // (x2-x1)(z4-z3) - (z2-z1)(x4-x3) = 0
        if (params.length >= 8) {
          const [x1, z1, x2, z2, x3, z3, x4, z4] = params;
          F_c.push((x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3));
        }
        break;
      }

      case 'perpendicular': {
        // Dot product of direction vectors = 0
        // (x2-x1)(x4-x3) + (z2-z1)(z4-z3) = 0
        if (params.length >= 8) {
          const [x1, z1, x2, z2, x3, z3, x4, z4] = params;
          F_c.push((x2 - x1) * (x4 - x3) + (z2 - z1) * (z4 - z3));
        }
        break;
      }

      case 'angle': {
        // Angle between lines = target angle
        const targetAngle = c.params[0] ?? 0;
        if (params.length >= 8) {
          const [x1, z1, x2, z2, x3, z3, x4, z4] = params;
          const angle = Math.atan2(
            (x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3),
            (x2 - x1) * (x4 - x3) + (z2 - z1) * (z4 - z3)
          );
          F_c.push(angle - targetAngle);
        }
        break;
      }

      case 'tangent': {
        // Circle tangent to line: distance from center to line = radius
        if (params.length >= 7) {
          const [cx, cz, r, x1, z1, x2, z2] = params;
          const dx = x2 - x1;
          const dz = z2 - z1;
          const len = Math.sqrt(dx ** 2 + dz ** 2);
          if (len > 1e-6) {
            const dist = Math.abs(dz * cx - dx * cz + x2 * z1 - z2 * x1) / len;
            F_c.push(dist - r);
          } else {
            F_c.push(0);
          }
        }
        break;
      }

      case 'symmetric': {
        // Point P and Q symmetric about line AB
        if (params.length >= 8) {
          const [px, pz, qx, qz, x1, z1, x2, z2] = params;
          const mx = (px + qx) / 2;
          const mz = (pz + qz) / 2;
          const dx = x2 - x1;
          const dz = z2 - z1;
          // Midpoint on line AB
          F_c.push(dz * (mx - x1) - dx * (mz - z1));
          // PQ perpendicular to AB
          F_c.push((qx - px) * dx + (qz - pz) * dz);
        }
        break;
      }

      case 'midpoint': {
        // Point P is midpoint of line AB
        if (params.length >= 6) {
          const [px, pz, x1, z1, x2, z2] = params;
          F_c.push(px - (x1 + x2) / 2);
          F_c.push(pz - (z1 + z2) / 2);
        }
        break;
      }

      case 'fixed_point': {
        // Point is fixed
        if (params.length >= 2) {
          const [px, pz] = params;
          const tx = c.params[0] ?? px;
          const tz = c.params[1] ?? pz;
          F_c.push(px - tx);
          F_c.push(pz - tz);
        }
        break;
      }
    }

    return F_c;
  }

  private buildJacobian(
    x: number[],
    constraints: Constraint[],
    entities: GeometricEntity[],
    fixedIndices: number[]
  ): number[][] {
    const F = this.evaluateConstraints(x, constraints, entities);
    const n = F.length; // number of equations

    const freeIndices = x.map((_, idx) => idx).filter(idx => !fixedIndices.includes(idx));
    const m_free = freeIndices.length;

    const J: number[][] = Array(n)
      .fill(null)
      .map(() => Array(m_free).fill(0));

    // Numerical differentiation
    // ∂F/∂xi ≈ (F(x+h) - F(x-h)) / 2h
    const h = 1e-7;

    for (let col = 0; col < m_free; col++) {
      const globalIdx = freeIndices[col];

      const xPlus = [...x];
      xPlus[globalIdx] += h;
      const FPlus = this.evaluateConstraints(xPlus, constraints, entities);

      const xMinus = [...x];
      xMinus[globalIdx] -= h;
      const FMinus = this.evaluateConstraints(xMinus, constraints, entities);

      for (let row = 0; row < n; row++) {
        J[row][col] = (FPlus[row] - FMinus[row]) / (2 * h);
      }
    }

    return J;
  }

  private solveLinearSystem(
    J: number[][],
    F: number[]
  ): number[] | null {
    const n = J.length; // equations
    const m = J[0]?.length ?? 0; // free variables
    if (n === 0 || m === 0) return [];

    if (n <= m) {
      // Underdetermined or square: J * delta = -F
      // Minimum-norm solution: delta = J^T * (J * J^T)^-1 * (-F)
      const A: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          let sum = 0;
          for (let k = 0; k < m; k++) {
            sum += J[i][k] * J[j][k];
          }
          A[i][j] = sum;
        }
      }
      const b = F.map(f => -f);
      const lambda = this.solveSquareSystem(A, b);
      if (!lambda) return null;

      // delta = J^T * lambda
      const delta = Array(m).fill(0);
      for (let i = 0; i < m; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += J[j][i] * lambda[j];
        }
        delta[i] = sum;
      }
      return delta;
    } else {
      // Overdetermined: J * delta = -F
      // Least-squares: J^T * J * delta = -J^T * F
      const A: number[][] = Array(m).fill(0).map(() => Array(m).fill(0));
      for (let i = 0; i < m; i++) {
        for (let j = 0; j < m; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += J[k][i] * J[k][j];
          }
          A[i][j] = sum;
        }
      }
      const b = Array(m).fill(0);
      for (let i = 0; i < m; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          sum += J[j][i] * (-F[j]);
        }
        b[i] = sum;
      }
      return this.solveSquareSystem(A, b);
    }
  }

  private solveSquareSystem(A: number[][], b: number[]): number[] | null {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) {
          maxRow = row;
        }
      }

      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;

      if (Math.abs(M[col][col]) < 1e-12) {
        return null; // Singular matrix
      }

      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = M[row][col] / M[col][col];
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }
      }
    }

    return b.map((_, i) => M[i][n] / M[i][i]);
  }

  private norm(v: number[]): number {
    return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  }

  private countDOF(entities: GeometricEntity[], constraints: Constraint[]): number {
    const analyser = new DOFAnalyser();
    return analyser.analyse(entities, constraints).totalDOF;
  }

  private determineStatus(
    converged: boolean,
    entities: GeometricEntity[],
    constraints: Constraint[]
  ): SolverResult['status'] {
    if (!converged) return 'conflict';
    const dof = this.countDOF(entities, constraints);
    if (dof === 0) return 'fully_constrained';
    if (dof > 0) return 'under_constrained';
    return 'over_constrained';
  }

  private evaluateResidualForConstraint(
    c: Constraint,
    x: number[],
    entities: GeometricEntity[]
  ): number {
    const F_single = this.evaluateSingleConstraint(c, x, entities);
    return this.norm(F_single);
  }

  private findConflicts(
    constraints: Constraint[],
    x: number[],
    entities: GeometricEntity[]
  ): Constraint[] {
    const conflicts: Constraint[] = [];
    for (const c of constraints) {
      const res = this.evaluateResidualForConstraint(c, x, entities);
      if (res > 1e-3) {
        conflicts.push({
          ...c,
          satisfied: false,
          error: res
        });
      }
    }
    return conflicts;
  }

  private evaluateResidual(
    x: number[],
    constraints: Constraint[],
    entities: GeometricEntity[]
  ): number {
    const F = this.evaluateConstraints(x, constraints, entities);
    return this.norm(F);
  }

  private buildConflictResult(
    entities: GeometricEntity[],
    constraints: Constraint[],
    iterations: number,
    currentX: number[]
  ): SolverResult {
    const conflicts = this.findConflicts(constraints, currentX, entities);
    
    // Supplement numerical conflicts with topological dependency loop isolation
    const graph = new ConstraintGraph();
    entities.forEach(e => graph.addEntity(e));
    constraints.forEach(c => graph.addConstraint(c));
    const cycles = graph.findConflictingCycles(constraints);
    
    // Merge cycle conflicts
    cycles.forEach(cc => {
      if (!conflicts.some(c => c.id === cc.id)) {
        conflicts.push({ ...cc, satisfied: false, error: 0.1 });
      }
    });

    return {
      converged: false,
      iterations,
      residual: this.evaluateResidual(currentX, constraints, entities),
      dof_remaining: this.countDOF(entities, constraints),
      status: 'conflict',
      conflicts,
      updated_entities: entities
    };
  }
}
