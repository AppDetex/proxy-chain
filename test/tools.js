import _ from 'underscore';
import urlModule from 'url';
import BluebirdPromise from 'bluebird';
import { expect } from 'chai';
import * as utils from '../build/utils';
import Apify from '../build/index';

/* global process, describe, it */


const testUrl = (url, extras) => {
    const parsed1 = utils.parseUrl(url);
    const parsed2 = urlModule.parse(url);
    expect(parsed1).to.eql(_.extend(parsed2, extras));
};

describe('utils.parseUrl()', () => {
    it('works', () => {
        testUrl('https://username:password@www.example.com:12345/some/path', {
            scheme: 'https',
            username: 'username',
            password: 'password',
        });

        testUrl('http://us-er+na12345me:@www.example.com:12345/some/path', {
            scheme: 'http',
            username: 'us-er+na12345me',
            password: '',
        });

        testUrl('socks5://username@www.example.com:12345/some/path', {
            scheme: 'socks5',
            username: 'username',
            password: null,
        });

        testUrl('FTP://@www.example.com:12345/some/path', {
            scheme: 'ftp',
            username: null,
            password: null,
        });

        testUrl('HTTP://www.example.com:12345/some/path', {
            scheme: 'http',
            username: null,
            password: null,
        });

        testUrl('www.example.com:12345/some/path', {
            scheme: null,
            username: null,
            password: null,
        });
    });
});


describe('utils.redactUrl()', () => {
    it('works', () => {
        expect(utils.redactUrl('https://username:password@www.example.com:1234/path#hash'))
            .to.eql('https://username:<redacted>@www.example.com:1234/path#hash');

        expect(utils.redactUrl('https://username@www.example.com:1234/path#hash'))
            .to.eql('https://username@www.example.com:1234/path#hash');

        expect(utils.redactUrl('https://username:password@www.example.com:1234/path#hash', '<xxx>'))
            .to.eql('https://username:<xxx>@www.example.com:1234/path#hash');

        expect(utils.redactUrl('ftp://@www.example.com/path/path2'))
            .to.eql('ftp://www.example.com/path/path2');

        expect(utils.redactUrl('ftp://www.example.com'))
            .to.eql('ftp://www.example.com/');

        expect(utils.redactUrl('ftp://example.com/'))
            .to.eql('ftp://example.com/');
    });
});


// TODO: add unit test for parseHostHeader