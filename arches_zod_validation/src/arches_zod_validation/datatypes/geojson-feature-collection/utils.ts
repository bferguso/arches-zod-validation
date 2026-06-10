import type { GeoJSONFeatureCollectionValue } from '@/bcgov_arches_common/datatypes/geojson-feature-collection/types.ts';

export const blankGeoJSONValue = function (): GeoJSONFeatureCollectionValue {
    return {
        display_value: '',
        node_value: null,
        details: [] as never[],
    } satisfies GeoJSONFeatureCollectionValue;
};
