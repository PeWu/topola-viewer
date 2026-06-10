import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import * as H from 'history';
import {ChartType} from '../chart';
import {DataSourceEnum} from '../datasource/data_source';
import {ChartColors, Ids, PlaceDisplay, Sex} from '../sidepanel/config/config';
import {
  getArguments,
  getParamFromSearch,
  getStaticUrl,
  getUrlForArgs,
} from './url_args';

describe('url_args', () => {
  const originalEnv = process.env;
  let documentMock: {
    querySelector: jest.Mock;
  };

  beforeEach(() => {
    process.env = {...originalEnv};
    // Mock document globally
    documentMock = {
      querySelector: jest.fn().mockReturnValue(null),
    };
    Object.defineProperty(global, 'document', {
      value: documentMock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    // Clean up document mock
    Object.defineProperty(global, 'document', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  describe('getStaticUrl', () => {
    it('returns VITE_STATIC_URL if set', () => {
      process.env.VITE_STATIC_URL = 'http://example.com/static.ged';
      expect(getStaticUrl()).toBe('http://example.com/static.ged');
    });

    it('returns meta tag url if meta tag is present and valid', () => {
      const mockMeta = {
        getAttribute: jest.fn().mockReturnValue('http://example.com/meta.ged'),
      };
      documentMock.querySelector.mockReturnValue(mockMeta);

      expect(getStaticUrl()).toBe('http://example.com/meta.ged');
      expect(documentMock.querySelector).toHaveBeenCalledWith(
        'meta[name="topola-static-url"]',
      );
      expect(mockMeta.getAttribute).toHaveBeenCalledWith('content');
    });

    it('ignores template placeholder in meta tag', () => {
      const mockMeta = {
        getAttribute: jest.fn().mockReturnValue('{{ env "STATIC_URL" }}'),
      };
      documentMock.querySelector.mockReturnValue(mockMeta);

      expect(getStaticUrl()).toBeUndefined();
    });

    it('ignores __ placeholder in meta tag', () => {
      const mockMeta = {
        getAttribute: jest.fn().mockReturnValue('__STATIC_URL_PLACEHOLDER__'),
      };
      documentMock.querySelector.mockReturnValue(mockMeta);

      expect(getStaticUrl()).toBeUndefined();
    });

    it('returns undefined if neither VITE_STATIC_URL nor meta tag is present', () => {
      expect(getStaticUrl()).toBeUndefined();
    });
  });

  describe('getParamFromSearch', () => {
    it('extracts query param value', () => {
      expect(getParamFromSearch('test', {test: 'val'})).toBe('val');
    });

    it('returns undefined if param is array or missing', () => {
      expect(
        getParamFromSearch('test', {test: ['val1', 'val2']}),
      ).toBeUndefined();
      expect(getParamFromSearch('missing', {test: 'val'})).toBeUndefined();
    });
  });

  describe('getArguments', () => {
    const createLocation = (search: string): H.Location => ({
      pathname: '/view',
      search,
      hash: '',
      state: null,
      key: '',
    });

    it('returns defaults for empty search', () => {
      const args = getArguments(createLocation(''));
      expect(args.sourceSpec).toBeUndefined();
      expect(args.selection).toBeUndefined();
      expect(args.detail).toBeUndefined();
      expect(args.chartType).toBe(ChartType.Hourglass);
      expect(args.standalone).toBe(true);
      expect(args.showWikiTreeMenus).toBe(true);
      expect(args.freezeAnimation).toBe(false);
      expect(args.showSidePanel).toBe(true); // default on desktop
      expect(args.config).toEqual({
        color: ChartColors.COLOR_BY_GENERATION,
        id: Ids.SHOW,
        sex: Sex.SHOW,
        place: PlaceDisplay.FULL,
        placeCount: 2,
      });
    });

    it('parses chart view types correctly', () => {
      expect(getArguments(createLocation('?view=relatives')).chartType).toBe(
        ChartType.Relatives,
      );
      expect(getArguments(createLocation('?view=fancy')).chartType).toBe(
        ChartType.Fancy,
      );
      expect(getArguments(createLocation('?view=donatso')).chartType).toBe(
        ChartType.Donatso,
      );
      expect(getArguments(createLocation('?view=unknown')).chartType).toBe(
        ChartType.Hourglass,
      );
    });

    it('parses WikiTree source spec', () => {
      const args = getArguments(
        createLocation('?source=wikitree&authcode=123'),
      );
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.WIKITREE,
        authcode: '123',
      });
    });

    it('parses Google Drive source spec', () => {
      const args = getArguments(
        createLocation('?source=google-drive&fileId=abc'),
      );
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.GOOGLE_DRIVE,
        fileId: 'abc',
      });
    });

    it('parses Uploaded source spec', () => {
      const args = getArguments(createLocation('?file=hash123'));
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.UPLOADED,
        hash: 'hash123',
      });
    });

    it('parses GEDCOM URL source spec', () => {
      const args = getArguments(
        createLocation('?url=http://example.com/tree.ged'),
      );
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.GEDCOM_URL,
        url: 'http://example.com/tree.ged',
        handleCors: true,
      });
    });

    it('parses GEDCOM URL source spec with handleCors false', () => {
      const args = getArguments(
        createLocation('?url=http://example.com/tree.ged&handleCors=false'),
      );
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.GEDCOM_URL,
        url: 'http://example.com/tree.ged',
        handleCors: false,
      });
    });

    it('parses Embedded source spec', () => {
      const args = getArguments(createLocation('?embedded=true'));
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.EMBEDDED,
      });
    });

    it('prefers staticUrl over other source specs', () => {
      process.env.VITE_STATIC_URL = 'http://example.com/static.ged';
      const args = getArguments(
        createLocation('?embedded=true&url=http://other.com'),
      );
      expect(args.sourceSpec).toEqual({
        source: DataSourceEnum.GEDCOM_URL,
        url: 'http://example.com/static.ged',
        handleCors: false,
      });
      expect(args.standalone).toBe(false);
    });

    it('parses selection correctly', () => {
      const args = getArguments(createLocation('?indi=I123&gen=4'));
      expect(args.selection).toEqual({
        id: 'I123',
        generation: 4,
      });
    });

    it('defaults selection generation to 0 if missing or invalid', () => {
      const args1 = getArguments(createLocation('?indi=I123'));
      expect(args1.selection).toEqual({
        id: 'I123',
        generation: 0,
      });

      const args2 = getArguments(createLocation('?indi=I123&gen=abc'));
      expect(args2.selection).toEqual({
        id: 'I123',
        generation: 0,
      });
    });

    it('parses detail parameter', () => {
      const args = getArguments(createLocation('?detail=I456'));
      expect(args.detail).toBe('I456');
    });

    it('parses showSidePanel setting', () => {
      // Mock window.matchMedia for desktop
      Object.defineProperty(global, 'window', {
        value: {
          matchMedia: jest.fn().mockReturnValue({matches: false}),
        },
        writable: true,
        configurable: true,
      });
      expect(getArguments(createLocation('')).showSidePanel).toBe(true);
      expect(
        getArguments(createLocation('?sidePanel=false')).showSidePanel,
      ).toBe(false);

      // Mock window.matchMedia for mobile
      Object.defineProperty(global, 'window', {
        value: {
          matchMedia: jest.fn().mockReturnValue({matches: true}),
        },
        writable: true,
        configurable: true,
      });
      expect(getArguments(createLocation('')).showSidePanel).toBe(false);
      expect(
        getArguments(createLocation('?sidePanel=true')).showSidePanel,
      ).toBe(true);
    });

    it('parses boolean settings (standalone, showWikiTreeMenus, freeze)', () => {
      const args = getArguments(
        createLocation('?standalone=false&showWikiTreeMenus=false&freeze=true'),
      );
      expect(args.standalone).toBe(false);
      expect(args.showWikiTreeMenus).toBe(false);
      expect(args.freezeAnimation).toBe(true);
    });

    it('parses config object from query parameters', () => {
      const args = getArguments(createLocation('?c=s&i=h&s=h&p=s&pn=5'));
      expect(args.config).toEqual({
        color: ChartColors.COLOR_BY_SEX,
        id: Ids.HIDE,
        sex: Sex.HIDE,
        place: PlaceDisplay.SHORT,
        placeCount: 5,
      });
    });
  });

  describe('getUrlForArgs', () => {
    const createLocation = (search: string): H.Location => ({
      pathname: '/view',
      search,
      hash: '#hash-val',
      state: null,
      key: '',
    });

    it('updates query parameter value and preserves pathname/hash', () => {
      const loc = createLocation('?param1=old&param2=keep');
      const updated = getUrlForArgs(loc, {param1: 'new', param3: 'added'});
      expect(updated).toEqual({
        pathname: '/view',
        search: '?param1=new&param2=keep&param3=added',
        hash: '#hash-val',
      });
    });

    it('deletes query parameters set to null or undefined', () => {
      const loc = createLocation('?param1=val1&param2=val2');
      const updated = getUrlForArgs(loc, {param1: null, param2: undefined});
      expect(updated).toEqual({
        pathname: '/view',
        search: '',
        hash: '#hash-val',
      });
    });
  });
});
