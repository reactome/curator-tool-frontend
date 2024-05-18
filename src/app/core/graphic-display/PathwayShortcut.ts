import { Renderable, PrimitiveType } from './Renderable';
import { RenderablePathway } from './RenderablePathway';

export class PathwayShortcut extends RenderablePathway {

	private target: Renderable;

	constructor(pathway: Renderable) {
	  super("");
		this.target = pathway;
	}

	public getTarget(): Renderable {
		return this.target;
	}

	public override getDisplayName(): string {
		return this.target.getDisplayName();
	}

	public override setDisplayName(name: string): void {
		this.target.setDisplayName(name);
	}

	public override addComponent(comp: Renderable): void {
		this.target.addComponent(comp);
	}

	public override getComponents(): Renderable[] | undefined {
		return this.target.getComponents();
	}

	public override setAttributeValue(attributeName: string, value: PrimitiveType) {
		this.target.setAttributeValue(attributeName, value);
	}

  public override isChanged(): boolean {
      return this.target.isChanged();
  }

	public override getAttributeValue(attributeName: string): string | undefined {
		return this.target.getAttributeValue(attributeName);
	}
}
