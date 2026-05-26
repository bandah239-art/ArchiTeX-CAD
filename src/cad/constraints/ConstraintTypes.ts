export interface GeometricEntity {
  id:         string;
  type:       'point' | 'line' | 'circle' | 'arc';
  params:     number[];     // [x,z] | [x1,z1,x2,z2] | [cx,cz,r] | [cx,cz,r,a1,a2]
  dof:        number;        // remaining degrees of freedom
  fixed:      boolean;       // fully constrained
  name:       string;        // semantic reference name
}

export interface Constraint {
  id:         string;
  type:       ConstraintType;
  entities:   string[];      // entity IDs
  params:     number[];      // e.g. distance value
  satisfied:  boolean;
  error:      number;        // residual after solving
}

export type ConstraintType =
  | 'horizontal'
  | 'vertical'
  | 'coincident'
  | 'fixed_distance'
  | 'equal_length'
  | 'parallel'
  | 'perpendicular'
  | 'fixed_point'
  | 'tangent'
  | 'symmetric'
  | 'angle'
  | 'midpoint';

export interface SolverResult {
  converged:       boolean;
  iterations:      number;
  residual:        number;
  dof_remaining:   number;
  status:          'fully_constrained'
                 | 'under_constrained'
                 | 'over_constrained'
                 | 'conflict';
  conflicts:       Constraint[];
  updated_entities: GeometricEntity[];
}

export interface DOFAnalysis {
  totalDOF: number;
  perEntity: Map<string, number>;
  status: 'fully_constrained' | 'under_constrained' | 'over_constrained';
  underConstrainedEntities: string[];
  overConstrainedEntities: string[];
}
