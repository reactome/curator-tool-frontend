import { NodeAttachment } from './NodeAttachment';
import { Maybe, isUndef } from './Utils';
/**
 * This class is used to describe sequence features for a Node (e.g. protein). This is implemented
 * as a NodeAttachment.
 *
 */
export class RenderableFeature extends NodeAttachment {
    // feature type
    private type: FeatureType | undefined;
    // name of residue bearing the feature type
    private residue: string | undefined;
    // description of this RenderableFeature
    private description: string | undefined;
    // label
    private label: string | undefined;

    constructor() {
      super();
    }

    setFeatureType(type: FeatureType): void {
        this.type = type;
    }

    getFeatureType(): FeatureType | undefined {
        return this.type;
    }

    getLabel(): string {
        if (this.type != null)
            return FeatureType.getLabel(this.type);
        return this.label == null ? "" : this.label;
    }

    setResidue(residue: string): void {
        this.residue = residue;
    }

    getResidue(): string | undefined {
        return this.residue;
    }

    public override getDescription(): string {
        if (isUndef(this.description) && !isUndef(this.residue))
            return this.residue!;
        return this.description!;
    }

    public override setDescription(description: string): void {
        this.description = description;
    }

    public override setLabel(label: string): void {
        if (!isUndef(this.type))
            this.type = FeatureType.valueOf(label) as FeatureType;
        else
            this.label = label;
    }

    public override duplicate(): RenderableFeature {
        let feature = new RenderableFeature();
        if (!isUndef(this.type)) {
            feature.setFeatureType(this.type!);
        }
        feature.setDescription(this.getDescription());
        if (isUndef(this.residue)) {
            feature.setResidue(this.residue!);
        }
        if (!isUndef(this.relativeX!) && !isUndef(this.relativeY!)) {
            feature.setRelativePosition(this.relativeX!, this.relativeY!);
        }
        if (!isUndef(this.trackId)) {
          feature.setTrackId(this.trackId!);
        }
        return feature;
    }

    public getOriginalName(): string {
        const desc: string = this.getDescription();
        const name: string = desc.toUpperCase();
        return name.replaceAll(" ", "_");
    }
}

/**
 * A list of feature types
 */
enum FeatureType {
    ACETYLATED ,
    AMIDATED,
    FORMYLATED,
    HYDROXYLATED,
    LIPID_MODIFIED,
    METHYLATED,
    PHOSPHORYLATED,
    ADP_RIBOSYLATED,
    GLYCOSYLATED,
    UBIQUITINATED,
    ALKYLATED,
    OTHER,
    UNKNOWN
}

namespace FeatureType {
  export function valueOf(str: string) {
    return FeatureType[str as keyof typeof FeatureType];
  }
  export function getLabel(f: FeatureType): string {
    switch(f) {
      case FeatureType.ACETYLATED: {
        return "AC";
        break;
      }
      case FeatureType.AMIDATED: {
        return "AM";
        break;
      }
      case FeatureType.FORMYLATED: {
        return "F";
        break;
      }
      case FeatureType.HYDROXYLATED: {
        return "HO";
        break;
      }
      case FeatureType.LIPID_MODIFIED: {
        return "L";
        break;
      }
      case FeatureType.METHYLATED: {
        return "M";
        break;
      }
      case FeatureType.PHOSPHORYLATED: {
        return "P";
        break;
      }
      case FeatureType.ADP_RIBOSYLATED: {
        return "R";
        break;
      }
      case FeatureType.GLYCOSYLATED: {
        return "G";
        break;
      }
      case FeatureType.UBIQUITINATED: {
        return "U";
        break;
      }
      case FeatureType.ALKYLATED: {
        return "AK";
        break;
      }
      case FeatureType.OTHER: {
        return " ";
        break;
      }
      case FeatureType.UNKNOWN: {
        return "?";
        break;
      }
    }
  }

  export function getDescription(f: FeatureType): string {
    switch(f) {
      case FeatureType.ACETYLATED: {
        return "acetylated";
        break;
      }
      case FeatureType.AMIDATED: {
        return "amidated";
        break;
      }
      case FeatureType.FORMYLATED: {
        return "formylated";
        break;
      }
      case FeatureType.HYDROXYLATED: {
        return "hydroxylated";
        break;
      }
      case FeatureType.LIPID_MODIFIED: {
        return "lipid modified";
        break;
      }
      case FeatureType.METHYLATED: {
        return "methylated";
        break;
      }
      case FeatureType.PHOSPHORYLATED: {
        return "phosphorylated";
        break;
      }
      case FeatureType.ADP_RIBOSYLATED: {
        return "adp ribosylated";
        break;
      }
      case FeatureType.GLYCOSYLATED: {
        return "glycoslated";
        break;
      }
      case FeatureType.UBIQUITINATED: {
        return "ubiquitinated";
        break;
      }
      case FeatureType.ALKYLATED: {
        return "alkylated";
        break;
      }
      case FeatureType.OTHER: {
        return "other";
        break;
      }
      case FeatureType.UNKNOWN: {
        return "unknown";
        break;
      }
    }
  }
}
