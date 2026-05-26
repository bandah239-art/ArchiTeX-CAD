import { GeometricEntity, Constraint, ConstraintType } from './ConstraintTypes';

export interface GraphNode {
  entity: GeometricEntity;
  constraints: Constraint[];
  dof: number;
}

export interface GraphEdge {
  to: string;
  constraint: Constraint;
}

export class ConstraintGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();

  addEntity(entity: GeometricEntity): void {
    this.nodes.set(entity.id, {
      entity,
      constraints: [],
      dof: entity.dof
    });
    this.edges.set(entity.id, []);
  }

  addConstraint(constraint: Constraint): void {
    for (const id of constraint.entities) {
      const node = this.nodes.get(id);
      if (node) {
        node.constraints.push(constraint);
      }

      for (const otherId of constraint.entities) {
        if (otherId !== id) {
          const list = this.edges.get(id);
          if (list) {
            list.push({
              to: otherId,
              constraint
            });
          }
        }
      }
    }
  }

  getDOF(): number {
    const totalEntityDOF = Array.from(this.nodes.values()).reduce(
      (sum, n) => sum + n.entity.dof,
      0
    );

    const seenConstraints = new Set<string>();
    let totalConstraintEqs = 0;

    for (const node of this.nodes.values()) {
      for (const c of node.constraints) {
        if (!seenConstraints.has(c.id)) {
          seenConstraints.add(c.id);
          totalConstraintEqs += this.equationCount(c.type);
        }
      }
    }

    return totalEntityDOF - totalConstraintEqs;
  }

  /**
   * Performs bipartite dependency analysis to isolate over-constrained constraint loops.
   */
  findConflictingCycles(constraints: Constraint[]): Constraint[] {
    const conflicts: Constraint[] = [];
    
    // We build a bipartite graph: nodes are entity IDs and constraint IDs.
    // We search for simple cycles in this bipartite representation.
    const adj = new Map<string, string[]>(); // node -> list of adjacent nodes
    
    const addEdge = (u: string, v: string) => {
      if (!adj.has(u)) adj.set(u, []);
      if (!adj.has(v)) adj.set(v, []);
      adj.get(u)!.push(v);
      adj.get(v)!.push(u);
    };

    constraints.forEach(c => {
      c.entities?.forEach(entId => {
        addEdge(`C:${c.id}`, `E:${entId}`);
      });
    });

    // Run cycle detection (DFS path tracing) to find cyclic dependencies
    const visited = new Set<string>();
    const parent = new Map<string, string>();
    const cycleConstraints = new Set<string>();

    const dfs = (u: string) => {
      visited.add(u);
      const neighbors = adj.get(u) || [];
      for (const v of neighbors) {
        if (v === parent.get(u)) continue;
        if (visited.has(v)) {
          // Cycle detected! Trace back from u to v
          let curr = u;
          while (curr && curr !== v) {
            if (curr.startsWith('C:')) {
              cycleConstraints.add(curr.substring(2));
            }
            curr = parent.get(curr) || '';
          }
          if (v.startsWith('C:')) {
            cycleConstraints.add(v.substring(2));
          }
        } else {
          parent.set(v, u);
          dfs(v);
        }
      }
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    // Map cycle constraint IDs back to actual constraint objects
    cycleConstraints.forEach(cid => {
      const match = constraints.find(c => c.id === cid);
      if (match) conflicts.push(match);
    });

    return conflicts;
  }

  detectCycles(): boolean {
    // Return true if any cyclic dependency loops exist in the constraints
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      stack.add(nodeId);

      const list = this.edges.get(nodeId) || [];
      for (const edge of list) {
        if (!visited.has(edge.to)) {
          if (dfs(edge.to)) return true;
        } else if (stack.has(edge.to)) {
          return true;
        }
      }

      stack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  getPropagationOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      for (const edge of this.edges.get(nodeId) || []) {
        visit(edge.to);
      }
      order.unshift(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  private equationCount(type: ConstraintType): number {
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
