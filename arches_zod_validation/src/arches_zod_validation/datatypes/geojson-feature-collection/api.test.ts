import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the `arches` module used by api.ts
vi.mock('arches', () => {
    return {
        default: {
            urls: {
                'api-map-data': '/fake/api/map-data',
                'some-url': '/fake/some-url',
            },
        },
    };
});

describe('api.ts', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
        fetchMock.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('createRequest: returns JSON when response.ok is true', async () => {
        const { createRequest } = await import('./api');

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({ hello: 'world' }),
            statusText: 'OK',
        });

        const req = createRequest('some-url');
        await expect(req()).resolves.toEqual({ hello: 'world' });

        expect(fetchMock).toHaveBeenCalledWith('/fake/some-url');
    });

    it('createRequest: throws Error(responseJson.message) when response.ok is false', async () => {
        const { createRequest } = await import('./api');

        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: vi
                .fn()
                .mockResolvedValueOnce({ message: 'Bad things happened' }),
            statusText: 'Bad Request',
        });

        const req = createRequest('some-url');
        await expect(req()).rejects.toThrow('Bad things happened');
    });

    it('createRequest: if parsing json fails, throws the parse error message', async () => {
        const { createRequest } = await import('./api');

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockRejectedValueOnce(new Error('Invalid JSON')),
            statusText: 'OK',
        });

        const req = createRequest('some-url');
        await expect(req()).rejects.toThrow('Invalid JSON');
    });

    it('createRequest: if json fails without message, falls back to response.statusText', async () => {
        const { createRequest } = await import('./api');

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockRejectedValueOnce({}), // not an Error, no .message
            statusText: 'Some Status Text',
        });

        const req = createRequest('some-url');
        await expect(req()).rejects.toThrow('Some Status Text');
    });

    it('fetchMapData calls the api-map-data url', async () => {
        const { fetchMapData } = await import('./api');

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce({
                overlays: [],
                basemaps: [],
                default_bounds: {},
            }),
            statusText: 'OK',
        });

        await fetchMapData();

        expect(fetchMock).toHaveBeenCalledWith('/fake/api/map-data');
    });
});
