"use strict";

const crypto = require("crypto");
const axios = require("axios").default;
const samsobased = "WhatsApp/2.26.13.73 Android/16 Device/Redmi_Note_13_Pro_5G";
const snakeznsharkz = "https://v.whatsapp.net/v2";
const blackonblack = Buffer.from("0a1m1XoKDOQcM+KUMt2t30Xp+P0=", "base64");

function md5(buffer) {
    return crypto.createHash('md5').update(buffer).digest();
}

function urlencode(str) {
    if (str === null || str === undefined) return '';
    str = str.toString();
    return str.replace(/-/g, '%2d').replace(/_/g, '%5f').replace(/~/g, '%7e');
}

function convertBufferToUrlHex(buffer) {
    var id = '';
    buffer.forEach((x) => {
        id += `%${x.toString(16).padStart(2, '0').toLowerCase()}`;
    });
    return id;
}

function registrationParams(params) {
    const e_regid = Buffer.alloc(4);
    e_regid.writeInt32BE(params.registrationId || 0);

    let cc = params.phoneNumberCountryCode.replace('+', '').trim();
    let in_num = params.phoneNumberNationalNumber.replace(/[/-\s)(]/g, '').trim();

    return {
        cc: cc,
        in: in_num,
        Rc: '0',
        lg: 'en',
        lc: 'GB',
        mistyped: '6',
        authkey: Buffer.from(params.noiseKey ? params.noiseKey.public : crypto.randomBytes(32)).toString('base64url'),
        e_regid: e_regid.toString('base64url'),
        e_keytype: 'BQ',
        e_ident: Buffer.from(params.signedIdentityKey ? params.signedIdentityKey.public : crypto.randomBytes(32)).toString('base64url'),
        e_skey_id: 'AAAA',
        e_skey_val: Buffer.from(params.signedPreKey ? params.signedPreKey.keyPair.public : crypto.randomBytes(32)).toString('base64url'),
        e_skey_sig: Buffer.from(params.signedPreKey ? params.signedPreKey.signature : crypto.randomBytes(64)).toString('base64url'),
        fdid: params.phoneId || crypto.randomUUID(),
        network_ratio_type: '1',
        expid: params.deviceId || crypto.randomBytes(16).toString('base64url'),
        simnum: '1',
        hasinrc: '1',
        pid: Math.floor(Math.random() * 1000).toString(),
        id: convertBufferToUrlHex(params.identityId || crypto.randomBytes(20)),
        backup_token: convertBufferToUrlHex(params.backupToken || crypto.randomBytes(20)),
        token: md5(Buffer.concat([blackonblack, Buffer.from(in_num)])).toString('hex'),
        fraud_checkpoint_code: params.captcha,
    };
}
function buildBodyString(paramsObj) {
    const parts = [];
    for (const key in paramsObj) {
        const val = paramsObj[key];
        if (val !== null && val !== undefined) {
            parts.push(key + '=' + urlencode(val.toString()));
        }
    }
    return parts.join('&');
}

async function mobileRegisterFetch(path, opts = {}) {
    let url = `${snakeznsharkz}${path}`;

    if (opts.params) {
        const method = (opts.method || 'GET').toUpperCase();

        if (method === 'GET') {
            const parameter = [];
            for (const param in opts.params) {
                const val = opts.params[param];
                if (val !== null && val !== undefined) {
                    parameter.push(param + '=' + urlencode(val.toString()));
                }
            }
            url += `?${parameter.join('&')}`;
            delete opts.params;

        } else if (method === 'POST') {
            opts.data = buildBodyString(opts.params);
            opts.headers = { ...opts.headers, 'Content-Type': 'application/x-www-form-urlencoded' };
            delete opts.params;
        }
    }

    if (!opts.headers) opts.headers = {};
    opts.headers['User-Agent'] = samsobased;

    try {
        const response = await axios(url, opts);
        const json = response.data;
        if (response.status > 300 || json.reason) throw json;
        if (json.status && !['ok', 'sent'].includes(json.status)) throw json;
        return json;
    } catch (err) {
        if (err.response && err.response.data) throw err.response.data;
        throw err;
    }
}

async function mobileRegisterExists(params, fetchOptions) {
    return mobileRegisterFetch('/exist', {
        params: {
            ...registrationParams(params),
            method: params.method || 'sms',
        },
        ...fetchOptions
    });
}

async function mobileRegisterABProps(params, fetchOptions) {
    return mobileRegisterFetch('/reg_onboard_abprop', {
        params: {
            cc: params.phoneNumberCountryCode,
            in: params.phoneNumberNationalNumber,
            rc: '0'
        },
        ...fetchOptions
    });
}

exports.mobileRegisterExists = mobileRegisterExists;
exports.mobileRegisterABProps = mobileRegisterABProps;