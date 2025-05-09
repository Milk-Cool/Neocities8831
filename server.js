import { buttonCount, getButton, iteration, paginatedButtons, randomButtons, search, websiteCount } from "./index.js";
import { readFileSync } from "fs";
import express from "express";
import { resolve, join } from "path";
import ejs from "ejs";

const app = express();

const renderEjs = (filename, data) => {
    filename = join("templates", filename);
    filename = resolve(filename);
    const template = readFileSync(filename, "utf-8");
    return ejs.render(template, data, {
        filename: filename
    });
}

app.get("/", async (req, res) => {
    const perPage = parseInt(req.query.per_page ?? 300);
    if(perPage > 1000) return res.status(400).send("too many per page!");
    res.send(renderEjs("index.ejs", {
        buttons: req.query.q
            ? await search(req.query.q)
            : req.query.page
            ? await paginatedButtons(perPage, parseInt(req.query.page) * perPage)
            : await randomButtons(),
        page: req.query.page ? parseInt(req.query.page) : 0,
        perPage,
        count: await buttonCount(),
        websiteCount: await websiteCount(),
        query: req.query.q ?? ""
    }));
});
app.get("/info/:id", async (req, res) => {
    const button = await getButton(req.params.id);
    if(!button) return res.status(404).send("Not found");
    res.send(renderEjs("info.ejs", { button }));
});
app.use("/imgs", express.static("imgs", {
    setHeaders: res => res.set("cache-control", "immutable,max-age=86400")
}));
app.use(express.static("static"));

app.listen(8831);

(async () => {
    while(true) await iteration(!!process.env.USE_LATEST, parseInt(process.env.DEPTH ?? 1));
})();