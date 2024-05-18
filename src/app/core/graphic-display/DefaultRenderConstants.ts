import { Color } from './Color';

export class DefaultRenderConstants {
    public readonly DRUG_SYMBOL: string = "Rx";

    // For drawing selection widgets
    public static readonly SELECTION_WIDGET_WIDTH: number = 4;

    public static readonly EDGE_SELECTION_WIDGET_WIDTH: number = 8;

    public static readonly EDGE_TYPE_WIDGET_WIDTH: number = 12;

    public static readonly EDGE_MODULATION_WIDGET_WIDTH: number = 8;

    public static readonly EDGE_INHIBITION_WIDGET_WIDTH: number = 8;

    public static readonly SELECTION_WIDGET_COLOR: Color = new Color(30,144,255, undefined); // blue

    public static readonly SELECTION_WIDGET_BG_COLOR: Color = new Color(0, 0, 255, 50);

    public static readonly HIGHLIGHTED_COLOR: Color = new Color(0,128,0, undefined); // green;

    public static readonly DEFAULT_BACKGROUND: Color = new Color(204, 255, 204, undefined);

    public static readonly DEFAULT_DISEASE_LINE_COLOR: Color = new Color(255,0,0, undefined); // red

    public static readonly DEFAULT_DRUG_BACKGROUND: Color = new Color(184, 154, 230, undefined);

    public static readonly DEFAULT_DRUG_FOREGROUND: Color = new Color(161, 1, 2, undefined);

    public static readonly DEFAULT_COMPLEX_BACKGROUND: Color = new Color(204, 255, 255, undefined);

    public static readonly COMPARTMENT_COLOR: Color = new Color(250, 240, 240, undefined);

    public static readonly COMPARTMENT_OUTLINE_COLOR: Color = new Color(255, 153, 102, undefined);

    public static readonly PANEL_BACKGROUND: Color = new Color(255,255,255, undefined);

    public static readonly DEFAULT_FOREGROUND: Color = new Color(0,0,0, undefined); // black

    /**
     * Use a transparent color to draw the background of a container pathway
     */
    public static readonly DEFAULT_PATHWAY_SELECTION_BACKGROUND: Color = new Color(204 / 255.0,
                                                                               204 / 255.0,
                                                                               255 / 255.0,
                                                                               0.5);

    public static readonly DEFAULT_OUTLINE_COLOR: Color = new Color(0,0,0, undefined); // black

    // TODO: Commented out due to lack of Stroke and BasicStroke
    // public static readonly DEFAULT_STROKE: Stroke = new BasicStroke(1.0);

    // public static readonly DEFAULT_LINE_SELECTION_STROKE: Stroke = new BasicStroke(1.5);

    // public static readonly DEFAULT_THICK_STROKE: Stroke = new BasicStroke(2.0);

    public static readonly RECTANGLE_DIST: number = 10;

    public static readonly MULTIMER_RECT_DIST: number = 3;

    // TODO: Commented out due to lack of Stroke and BasicStroke
    // public static readonly SELECTION_STROKE: Stroke = new BasicStroke(2.0);

//     public static readonly BROKEN_LINE_STROKE: Stroke = new BasicStroke(1, BasicStroke.CAP_BUTT,
//                                                                     BasicStroke.JOIN_BEVEL, 0,
//                                                                     [12, 12], 0);

//     public static readonly THICK_BROKEN_LINE_STROKE: Stroke = new BasicStroke(2,
//                                                                           BasicStroke.CAP_BUTT,
//                                                                           BasicStroke.JOIN_BEVEL,
//                                                                           0,
//                                                                           [6, 6],
//                                                                           0);

    public static readonly LINK_WIDGET_WIDTH: number = 16;

    public static readonly LINK_WIDGET_COLOR: Color = new Color(211,211,211, undefined);

    public static readonly ROUND_RECT_ARC_WIDTH: number = 12;

    public static readonly COMPLEX_RECT_ARC_WIDTH: number = this.ROUND_RECT_ARC_WIDTH / 2;

//     public static readonly GENE_SYMBOL_STROKE: Stroke = new BasicStroke(2.0);

    // TODO: Commented out due to lack of Font
    // public static readonly WIDGET_FONT: Font = new Font("Monospaced", Font.BOLD, 10);

    public static readonly DEFAULT_NODE_WIDTH: number = 130;

    public static readonly DEFAULT_RED_CROSS_WIDTH: number = 3;

    // For cell rendering
    public static readonly CELL_INTERNAL_RECT_OFFSET_RATIO: number = 30.0;
    public static readonly CELL_INTERNAL_RECT_HEIGHT_RATIO: number = 2.0;
    public static readonly DEFAULT_CELL_BACKGROUND: Color = new Color(248, 203, 173, undefined);
    public static readonly DEFAULT_CELL_INTERNAL_BACKGROUND: Color = new Color(244, 177, 131, undefined);

    constructor() {
    }
}
