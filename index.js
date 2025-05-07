import Spider8831 from "spider8831";
import sqlite3 from "sqlite3";
import { JSDOM } from "jsdom";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const HASH_ALG = "sha256";
const DIR_NAME = "imgs";
const db = new sqlite3.Database("data.db");
if(!existsSync(DIR_NAME))
    mkdirSync(DIR_NAME);

db.run(`CREATE TABLE IF NOT EXISTS buttons (
    id INTEGER PRIMARY KEY,
    date INTEGER,
    filename TEXT,
    img TEXT,
    url TEXT,
    hash BLOB
)`);
db.run(`CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY,
    date INTEGER,
    url TEXT
)`);

const adb = (func, query, params) => new Promise((resolve, reject) => {
    db[func](query, params ?? [], (err, res) => {
        if(err) reject(err);
        else resolve(res);
    });
});
adb.get = (query, params) => adb("get", query, params);
adb.all = (query, params) => adb("all", query, params);
adb.run = (query, params) => adb("run", query, params);

const URL_RANDOM = `https://neocities.org/browse?sort_by=random`;
export const getRandom = async () => {
    const randomText = await (await fetch(URL_RANDOM)).text();
    const dom = new JSDOM(randomText, { contentType: "text/html" });
    const { document } = dom.window;
    const websites = Array.from(document.querySelectorAll(".website-Gallery .title a")).map(el => el.href);
    return websites;
};

export const hasLink = async url => {
    return await adb.get(`SELECT * FROM links WHERE url = ?`, [url]);
};

export const addLink = async url => {
    await adb.run(`INSERT INTO links (date, url) VALUES (?, ?)`, [Date.now(), url]);
};

export const websiteCount = async () => {
    return (await adb.get(`SELECT COUNT(*) FROM links`))["COUNT(*)"];
};

export const buttonCount = async () => {
    return (await adb.get(`SELECT COUNT(*) FROM buttons`))["COUNT(*)"];
};

export const hasButton = async hash => {
    return await adb.get(`SELECT * FROM buttons WHERE hash = ?`, [hash]);
};

export const getButton = async id => {
    return await adb.get(`SELECT * FROM buttons WHERE id = ?`, [id]);
};

export const randomButtons = async () => {
    return await adb.all(`SELECT * FROM buttons ORDER BY random() LIMIT 300`);
};

export const search = async query => {
    return await adb.all(`SELECT * FROM buttons WHERE instr(lower(img), lower(?)) OR instr(lower(url), lower(?)) LIMIT 1000`, [query, query]);
};

export const paginatedButtons = async (limit, offset) => {
    return await adb.all(`SELECT * FROM buttons LIMIT ? OFFSET ?`, [limit, offset]);
};

export const hashImg = buf => createHash(HASH_ALG).update(buf).digest("binary");

export const addButton = async (buf, ext, url, link, hash) => {
    link = link || "";
    const n = await buttonCount();
    writeFileSync(join(DIR_NAME, n + ext), buf);
    await adb.run(`INSERT INTO buttons (date, filename, img, url, hash) VALUES (?, ?, ?, ?, ?)`,
        [Date.now(), n + ext, url, link, hash]);
};

export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export const iteration = async () => {
    let urls;
    try {
        urls = await getRandom();
    } catch(_) {
        console.log("Connection might be unstable!");
        await wait(1000);
        return;
    }
    const spider = new Spider8831({
        depth: 1
    });
    for(const url of urls) {
        try {
            const origin = new URL(url).origin;
            if(await hasLink(origin)) continue;
            console.log(url);
            const res = await spider.scan(url);
            for(const img of res.imgs) {
                if(!Spider8831.imgURL(img.url)) continue;
                const hash = hashImg(img.img);
                if(await hasButton(hash)) continue;
                const path = new URL(img.url).pathname;
                const ind = path.lastIndexOf(".");
                const ext = ind === -1 ? path : path.slice(ind);
                await addButton(img.img, ext, img.url, img.link, hash);
                console.log(img.url);
            }
            await addLink(origin);
        } catch(e) {
            console.error(e);
        }
    }
};