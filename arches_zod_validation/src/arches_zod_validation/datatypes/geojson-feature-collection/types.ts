import type {
    AliasedNodeData,
    CardXNodeXWidgetData,
} from '@/arches_component_lab/types.ts';
import type {
    Feature,
    FeatureCollection,
    GeometryCollection,
    Geometry,
    GeoJSON,
} from 'geojson';

export type AliasedGeojsonFeatureCollectionNode = Omit<
    AliasedNodeData,
    'node_value'
> & {
    node_value: FeatureCollection;
};
// @todo Remove this when it gets incorporated into arches-component-lab
export interface GeoJSONFeatureCollectionValue extends AliasedNodeData {
    display_value: string;
    node_value: FeatureCollection | null;
    details: any[];
}

export type MapData = {
    overlays: MapLayer[];
    basemaps: MapLayer[];
    default_bounds: FeatureCollection | GeometryCollection;
};

export type { FeatureCollection, Feature, Geometry, GeoJSON };

export interface Basemap {
    id: string;
    name: string;
    value: string;
    active: boolean;
    url: string;
    source?: MapSource;
}
export interface MapLayer {
    activated?: boolean;
    addtomap: boolean;
    centerx?: number | null;
    centery?: number | null;
    icon: string;
    id: number;
    isoverlay: boolean;
    ispublic?: boolean;
    layer_json?: string;
    layerdefinitions: LayerDefinition[];
    legend?: string | null;
    maplayerid?: string;
    name: string;
    title: string;
    url: string;
    searchonly?: boolean;
    sortorder?: number;
    visible: boolean;
    zoom?: number | null;
    nodeid?: string;
    source?: MapSource;
}

export interface LayerDefinition {
    id: string;
    type: string;
    source?: string;
    'source-layer'?: string;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
    // filter?: FilterSpecification;
    minzoom?: number;
    maxzoom?: number;
}

export interface MapSource {
    id: number;
    name: string;
    source: {
        type: string;
        url: string;
        data?: GeoJSON;
        tileSize?: number;
        coordinates?: [number, number];
    };
    source_json: string;
}

export type GeometryType =
    | { id: 'Point'; text: 'Point' }
    | { id: 'Line'; text: 'Line' }
    | { id: 'Polygon'; text: 'Polygon' };

export interface GeoJSONFeatureCollectionCardXNodeXWidgetData extends CardXNodeXWidgetData {
    config: CardXNodeXWidgetData['config'] & {
        basemap: string;
        bearing: number;
        centerX: number;
        centerY: number;
        defaultValueType: string;
        featureColor: string;
        featureLineWidth: 1;
        featurePointSize: 3;
        geocodePlaceholder: string;
        geocodeProvider: string;
        geocoderVisible: true;
        geometryTypes: GeometryType[];
        label: string;
        maxZoom: number;
        minZoom: number;
        overlayConfigs: MapLayer[];
        overlayOpacity: number;
        pitch: number;
        rerender: boolean;
        zoom: number;
    };
}
