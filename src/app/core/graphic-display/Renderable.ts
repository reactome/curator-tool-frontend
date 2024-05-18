import { RenderablePropertyNames } from './RenderablePropertyNames';
import { DefaultRenderConstants } from './DefaultRenderConstants';
import { Point } from './Point';
import { Color } from './Color';
import { Graphics } from './Graphics';
import { ConnectInfo } from './ConnectInfo';
import { Rectangle } from './Rectangle';
import { ConnectWidget } from './ConnectWidget';
import { Renderer } from './Renderer';
import { RenderablePathway } from './RenderablePathway';
import { Instance } from "../models/reactome-instance.model";
import { Maybe, isUndef } from './Utils';

/**
 * The super class for all objects that can be displayed in a graph editor
 * pane.
 */
export abstract class Renderable {
    // To control bounds
    protected pad: number = 4;
    protected position: Maybe<Point>;
    protected connectInfo: Maybe<ConnectInfo>;
    protected isSelected: boolean = false;
    private isHighlighted: boolean = false;
    // Whole bounds for this Renderable
    protected bounds: Maybe<Rectangle>;
    protected needCheckBounds: boolean = false;
    protected needCheckTextBounds: boolean = false;
    // Text bounds only for display name.
    protected textBounds: Maybe<Rectangle>;
    // Another renderable contains this Renderable. This field is transient
    // so that container will not be output during DnD.
    protected container: Maybe<Renderable>;
    // Used to store all attribute values
    protected attributes: Map<string, string> = new Map();
    // For property change event
    // TODO: &&&& private propertyChangeListeners: java.util.List;
    // Color mode
    protected foregroundColor: Maybe<Color>;
    protected backgroundColor: Maybe<Color>;
    protected lineColor: Maybe<Color>;
    // The unique id
    private id: number = -1; // Default
    // Used for rendering
    protected renderer: Maybe<Renderer>;
    protected readonly SENSING_DISTANCE_SQ: number = 16;
    // A flag to control if this Renderable should be visible
    protected isVisible: boolean = true;
    // A flag to control this Renderable can be copy/pasted
    protected isTransferrable: boolean = true;
    // Move DB_ID from the shared attributes among shortcuts to here
    // So that two shortcuts in different compartments can have different
    // DB_IDs. This is a try to make it workable for the current Reactome
    // date model.
    private reactomeId: number = 0;
    // Use as the back-up model
    private instance?: Instance;
    // As with reactomeId, I have to move localization out from the attributes
    // so that two shortcuts in different compartments can have different values
    private localization: string = "";
    protected lineWidth: number = 0;
    protected isForDisease: boolean = false;

    constructor() {
        this.init();
    }

    private init() {
        // A flyweight design pattern is used here
        // TODO: Commented out temporarily as Renderer is a stub
        // this.setRenderer(RendererFactory.getFactory().getRenderer(this));
        // this.setID(RenderableRegistry.getRegistry().nextId());
        this.attributes = new Map();
    }

    public setRenderer(r: Renderer): void {
        this.renderer = r;
    }

    public getRenderer(): Maybe<Renderer> {
        return this.renderer;
    }

    public render(g: Graphics): void {
        if (!isUndef(this.renderer)) {
            this.renderer!.setRenderable(this);
            this.renderer!.render(g);
        }
    }

    public getIsTransferrable(): boolean {
        return this.isTransferrable;
    }

    public getTextBounds(): Maybe<Rectangle> {
        return this.textBounds;
    }

    public setTextBounds(rect: Rectangle): void {
        this.textBounds = rect;
    }

    public setLineColor(color: Color): void {
        this.lineColor = color;
    }

    public getLineColor(): Maybe<Color> {
        return this.lineColor;
    }

    public setContainer(renderable: Renderable): void {
        this.container = renderable;
    }

    public setInstance(instance: Instance): void {
        this.instance = instance;
    }

    public getInstance(): Maybe<Instance> {
        return this.instance;
    }

    public setReactomeId(id: number): void {
        this.reactomeId = id;
    }

    public getReactomeId(): number {
        if (!isUndef(this.instance))
            return this.instance!.dbId;
        return this.reactomeId;
    }

    public setLocalization(localization: string): void {
        this.localization = localization;
    }
    public getLocalization(): string {
        return this.localization;
    }

    public getContainer(): Maybe<Renderable> {
        return this.container;
    }

    public setPosition(p: Point): void {
        this.position = p;
    }

    public getPosition(): Maybe<Point> {
        return this.position;
    }

    /**
     * Get the bounding rectangle.
     *
     * @return Boundaries of this Renderable object
     */
    public getBounds(): Maybe<Rectangle> {
        return this.bounds;
    }

    /**
     * Check if this Renderable should be picked at the specified Point p.
     *
     * @param p the Point to check
     * @return true if the Renderable object is picked at the Point passed; false otherwise
     */
    public abstract isPicked(p: Point): boolean;

    /**
     * Check if this Renderable object can be picked. This method is different from isPicked(Point)
     * for HyperEdge. This method will not make any changes to the internal states of a Renderable object.
     * For checking if a passed point can be picked by a Renderable object, this method should be used.
     *
     * @param p the Point to check
     * @return true if the Renderable object can be picked at the Point passed; false otherwise
     */
    public canBePicked(p: Point): boolean {
        return this.isPicked(p);
    }

    /**
     * Check if this Renderable is selected.
     *
     * @return true if the Renderable object is selected; false otherwise
     */
    public getIsSelected(): boolean {
        return this.isSelected;
    }

    /**
     * Mark if this Renderable is selected.
     *
     * @param isSelected True if the Renderable object is selected; false otherwise
     */
    public setIsSelected(isSelected: boolean): void {
        this.isSelected = isSelected;
    }

    /**
     * Use a Rectangle to select this Renderable. If this Renderable
     * can be selected, its isSelected flag will be true. Otherwise,
     * its isSelected flag will be false.
     *
     * @param rect Rectangle object representing the selection area
     */
    public select(rect: Rectangle): void {
        if (!this.isVisible)
            return; // Block this option if it is not visible.
        this.isSelected = rect.contains(this.getPosition());
    }

    public getIsHighlighted(): boolean {
        return this.isHighlighted;
    }

    public setIsHighlighted(isHighlighted: boolean): void {
        this.isHighlighted = isHighlighted;
    }

    /**
     * Move this Renderable with a specified distance.
     *
     * @param dx Value to move along the x-axis
     * @param dy Value to move along the y-axis
     */
    public abstract move(dx: number, dy: number): void;

    /**
     * Add a ConnectWidget that contains connect information.
     *
     * @param widget ConnectWidget object to add
     */
    public addConnectWidget(widget: ConnectWidget): void {
        this.connectInfo?.addConnectWidget(widget);
    }

    public removeConnectWidget(widget: ConnectWidget): void {
        this.connectInfo?.removeConnectWidget(widget);
    }

    public clearConnectWidgets(): void {
        this.connectInfo?.clear();
    }

    public invalidateConnectWidgets(): void {
        this.connectInfo?.invalidate();
    }

    /**
     * Use this method to invalidate the bounds of the node so that the bounds can be validated later.
     */
    public invalidateBounds(): void {
        this.needCheckBounds = true;
        if (!isUndef(this.getContainer()) && this.getContainer() instanceof RenderablePathway) {
            this.getContainer()!.invalidateBounds();
        }
    }

    public setBounds(bounds: Rectangle): void {
        this.bounds = bounds;
    }

    public setTextPosition(x: number, y: number): void {

    }

    public setConnectInfo(connectInfo: ConnectInfo): void {
        this.connectInfo = connectInfo;
    }

    public getConnectInfo(): Maybe<ConnectInfo> {
        return this.connectInfo;
    }

    public abstract getComponents(): Maybe<Renderable[]>;

    public addComponent(renderable: Renderable): void {
    }

    public removeComponent(renderable: Renderable): Maybe<Renderable> {
        return undefined;
    }

    public toString(): string {
        return this.getDisplayName();
    }

    public setDisplayName(name: string): void {
        this.attributes.set(RenderablePropertyNames.DISPLAY_NAME, name);
    }

    public getDisplayName(): string {
        return this.attributes.get(RenderablePropertyNames.DISPLAY_NAME) as string;
    }

    public generateShortcut(): Maybe<Renderable> {
        return undefined;
    }

    public removeShortcut(shortcut: Renderable): void {
    }

    public getShortcuts(): Maybe<Renderable[]> {
        return undefined;
    }

    public setShortcuts(shortcuts: Array<Renderable>): void {

    }

    public setAttributeValue(attributeName: string, value: PrimitiveType): void {
        // Use String for these types
        if (typeof value === "number" ||
            typeof value === "boolean") {
            value = value.toString();
        }
        this.attributes.set(attributeName, value as string);
    }

    public getAttributeValue(attributeName: string): Maybe<string> {
        return this.attributes.get(attributeName);
    }

    public getAttributes(): Map<string, string> {
        return this.attributes;
    }

    public setAttributes(attributes: Map<string, string>): void {
        this.attributes = attributes;
    }

    public getComponentByName(name: string): Maybe<Renderable> {
        return undefined;
    }

    public getComponentByID(id: number): Maybe<Renderable> {
        return undefined;
    }

    public setForegroundColor(color: Color): void {
        this.foregroundColor = color;
    }

    public getForegroundColor(): Maybe<Color> {
        return this.foregroundColor;
    }

    public setBackgroundColor(color: Color): void {
        this.backgroundColor = color;
    }

    public getBackgroundColor(): Maybe<Color> {
        return this.backgroundColor;
    }

    // The following three methods for property event.

   /* TODO: Commented out due to lack of PropertyChangeListener
    public addPropertyChangeListener(l: PropertyChangeListener): void {
        if (this.propertyChangeListeners == null) {
            this.propertyChangeListeners = new Array();
        }
        if (!this.propertyChangeListeners.includes(l)) {
            this.propertyChangeListeners.push(l);
        }
    }

    public removePropertyChangeListener(l: PropertyChangeListener): void {
        if (this.propertyChangeListeners != null) {
            this.propertyChangeListeners = this.propertyChangeListeners.filter(listener => listener !== l);
        }
        if (this.propertyChangeListeners != null && this.propertyChangeListeners.length == 0) {
            this.propertyChangeListeners = null; // To save resources.
        }
    }

    protected firePropertyChange(e: PropertyChangeEvent): void {
    	if (this.propertyChangeListeners != null) {
    		let listener: PropertyChangeListener | null = null;
    		for (let it = this.propertyChangeListeners.iterator(); it.hasNext();) {
    			listener = it.next() as PropertyChangeListener;
    			listener.propertyChange(e);
    		}
    	}
    }
    */

    /**
     * Set the unique id for this Renderable. The id of a Renderable object
     * is unique in the whole process.
     *
     * @param id Unique id to set
     */
    public setID(id: number): void {
    	this.id = id;
    }

    /**
     * Get the unique id for this Renderable object.
     *
     * @return The unique id of this Renderable object
     */
    public getID(): number {
    	return this.id;
    }

    /**
     * The default implementaion always return 0. The topmost Renderable object
     * should implement this method to assign unique id to its descedants.
     *
     * @return Always return 0
     */
    public generateUniqueID(): number {
    	return 0;
    }

    /**
     * A type name. A subclass should implement this method.
     *
     * @return Type of this renderable
     */
    public abstract getType(): string;

    public setIsChanged(isChanged: boolean): void {
        this.attributes.set("isChanged", isChanged.toString());
    }

    public isChanged(): boolean {
        const value: Maybe<string> = this.attributes.get("isChanged");
        if (isUndef(value))
            return false;
        return Boolean(value).valueOf();
    }

    public setIsVisible(isVisible: boolean): void {
        this.isVisible = isVisible;
    }

    public getIsVisible(): boolean {
        return this.isVisible;
    }

    public setLineWidth(lineWidth: number): void {
        this.lineWidth = lineWidth;
    }

    public getLineWidth(): number {
        return this.lineWidth;
    }

    /**
     * If the renderable represents or contains a disease.
     * @param isForDisease
     */
    public setIsForDisease(isForDisease: boolean): void {
        this.isForDisease = isForDisease;
    }

    public getIsForDisease(): boolean {
        return this.isForDisease;
    }
}

export type PrimitiveType = number | boolean | string ;
