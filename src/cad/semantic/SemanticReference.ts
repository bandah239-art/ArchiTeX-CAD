import { GeometricEntity } from '../constraints/ConstraintTypes';

export class SemanticReference {
  private registry: Map<string, string> = new Map(); // name -> entity ID
  private idToName: Map<string, string> = new Map(); // entity ID -> name

  private autoNames = {
    point:  0,
    line:   0,
    circle: 0,
    arc:    0
  };

  register(entity: GeometricEntity): string {
    // Check if already registered
    const existingName = this.idToName.get(entity.id);
    if (existingName) {
      entity.name = existingName;
      return existingName;
    }

    // Auto-generate semantic name
    const name = this.generateName(entity);
    entity.name = name;
    this.registry.set(name, entity.id);
    this.idToName.set(entity.id, name);
    return name;
  }

  resolve(name: string): string | null {
    return this.registry.get(name) || null;
  }

  resolveIdToName(id: string): string | null {
    return this.idToName.get(id) || null;
  }

  private generateName(entity: GeometricEntity): string {
    switch (entity.type) {
      case 'point':
        return `P${++this.autoNames.point}`;
      case 'line':
        return `L${++this.autoNames.line}`;
      case 'circle':
        return `C${++this.autoNames.circle}`;
      case 'arc':
        return `A${++this.autoNames.arc}`;
      default:
        return `E${++this.autoNames.point}`;
    }
  }

  // Renaming
  rename(oldName: string, newName: string): boolean {
    const id = this.registry.get(oldName);
    if (!id) return false;
    
    // Check if new name is already taken
    if (this.registry.has(newName)) return false;

    this.registry.delete(oldName);
    this.registry.set(newName, id);
    this.idToName.set(id, newName);
    return true;
  }

  // Reference by engineering meaning (e.g., tags like "foundation_base")
  setSemanticTag(name: string, tag: string): void {
    const id = this.registry.get(name);
    if (id) {
      this.registry.set(tag, id);
      this.idToName.set(id, tag);
    }
  }

  clear(): void {
    this.registry.clear();
    this.idToName.clear();
    this.autoNames.point = 0;
    this.autoNames.line = 0;
    this.autoNames.circle = 0;
    this.autoNames.arc = 0;
  }
}

export const semanticRef = new SemanticReference();
