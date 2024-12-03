import { expect } from 'chai';
import '../Utils.js';

describe('Utils', function () {
  context('getUrl', function () {
    it('no params', function () {
      const expected = 'https://example.com?gid=123';
      expect(getUrl('https://example.com', '123')).to.equal(expected);
    });

    it('with params', function () {
      const expected = 'https://example.com?stub=0&gid=123';
      expect(getUrl('https://example.com?stub=0', '123')).to.equal(expected);
    });
  });
});
