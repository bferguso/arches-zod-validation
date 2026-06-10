import arches from 'arches';

export const createRequest = (urlName: string) => {
    const url = arches.urls[urlName];
    return async () => {
        const response = await fetch(url);
        try {
            const responseJson = await response.json();
            if (response.ok) {
                return responseJson;
            }
            throw new Error(responseJson.message);
        } catch (error) {
            throw new Error((error as Error).message || response.statusText);
        }
    };
};

export const fetchMapData = createRequest('api-map-data');
