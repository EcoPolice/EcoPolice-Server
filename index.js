'use strict';
const express = require("express");
const app = express();
const http = require("http").Server(app);
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const mysql = require("mysql2");
const fetch = require('node-fetch');
const exif = require('exif-parser');
const validation = {
    neuro: true,
    coordinates: true,
    coordinatesRadius:  0.8
}


require("dotenv").config();

app.use(fileUpload());

const sql = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD
})

app.use(express.static(__dirname + "/public", {
    maxAge: "1h"
}));

app.get("/", (req, res) => {
    console.log("Hello, log!");
    res.end("Hello!");
})

app.get("/all", (req, res) => {
    console.log("/all");
    res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
    sql.query(`select * from main`, (err, data) => {
        if (err) {
            console.error(err);
            res.end(JSON.stringify({
                status: "DB_ERROR",
                description: err.name + "\n" + err.message
            }, null, 4))
        } else {
            for (let i = 0; i < data.length; ++i) {
                data[i].damagedObjects = data[i].damagedObjects?.split("|");
                data[i].images = data[i].images?.split("|");
            }
            res.end(JSON.stringify(data, null, 4));
        }
    })
})


app.get("/one/:id", (req, res) => {
    console.log("/one/",req.params.id);
    res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
    let id = parseInt(req.params.id);
    sql.query(`select * from main where id = ${sql.escape(id)}`, (err, data) =>{
        if (err) {
            console.error(err);
            res.end(JSON.stringify({
                status: "DB_ERROR",
                description: err.name + "\n" + err.message
            }, null, 4))
        } else if (data === null || data.length === 0) {
            console.log("No such row with id : ", id);
            res.end(JSON.stringify({
                status: "DB_ERROR",
                description: `No such row with id : ${id}`
            }, null, 4));
        } else {
            res.end(JSON.stringify(data, null, 4));
        }
    })
})

app.post("/upload", (req, res) =>{
    console.log(req.files);
    console.log("/upload");
    res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
    let uploadPath = __dirname + '/public/images/';

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.end(JSON.stringify({
            status: "ERROR",
            description: "No files"
        }));
    }

    let promisesForMove = [];
    let promisesForNeuro = [];
    let urls = [];
    let paths = [];

    for (let key of Object.keys(req.files)) {
        let file = req.files[key];
        let newName = file.md5;
        let curUploadPath = uploadPath + newName;
        promisesForMove.push(file.mv(curUploadPath));
        urls.push(`http://${process.env.REAL_SERVER_IP}/images/${newName}`);
        paths.push(curUploadPath);
    }
    Promise.all(promisesForMove).then(() => {

        if (validation.neuro) {
            paths.forEach(p => {
                let u = `http://${process.env.PYTHON_SERVER_IP}:${process.env.PYTHON_SERVER_PORT}`;
                console.log(u);
                promisesForNeuro.push(
                    fetch(u, {
                        method: 'post',
                        body:    JSON.stringify({
                            filepath: p
                        }, null, 4),
                        headers: { 'Content-Type': 'application/json' },
                    })
                        .then(res => res.json())
                );
            })
        }

        Promise.all(promisesForNeuro).then((values) => {
            let flag = 1;
            values?.forEach(v => {
                console.log(v);
                if (v.error || !v.is_oil) {
                    flag = 0;
                     res.end(JSON.stringify({
                        status: "ERROR",
                        description: "Neuro validation failed" +
                            (v.error ? (" (Error)" + (v.message === undefined ? "" : ": " + v.message)) : "")
                    }, null, 4));
                }
            })
            if (flag) res.end(JSON.stringify(urls, null, 4));
        })
    })
})

app.post("/add", bodyParser.json(), (req, res) => {
    console.log("/add");
    console.log(req.body);
    res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
    let disasterName = req.body["disasterName"] ? req.body["disasterName"] : null;
    let disasterDescription = req.body["disasterDescription"] ?  req.body["disasterDescription"] : null;
    let disasterDate = isNaN(parseInt(req.body["disasterDate"])) ? null : parseInt(req.body["disasterDate"]);
    let objectName = req.body["objectName"] ? req.body["objectName"] : null;
    let owner = req.body["owner"] ? req.body["owner"] : null;
    let cause = req.body["cause"] ? req.body["cause"] : null;
    let product = req.body["product"] ? req.body["product"] : null;
    let volume = isNaN(parseInt(req.body["volume"])) ? null : parseInt(req.body["volume"]);
    let area = isNaN(parseInt(req.body["area"])) ? null : parseInt(req.body["area"]);
    let damageCount = isNaN(parseInt(req.body["damageCount"])) ? null : parseInt(req.body["damageCount"]);
    let damagedObjects = !req.body["damagedObjects"] || req.body["damagedObjects"]?.length === 0 ? null : req.body["damagedCount"]?.join("|");
    let lat = isNaN(parseFloat(req.body["lat"])) ? null : parseFloat(req.body["lat"]);
    let long = isNaN(parseFloat(req.body["long"])) ? null : parseFloat(req.body["long"]);
    let images = !req.body["images"] || req.body["images"]?.length === 0 ? null : req.body["images"]?.join("|");

    if (validation.coordinates && images !== null && images.length !== 0 && lat !== null && long !== null) {
        for (let i = 0; i < images.length; ++i) {
            let imgUrl = images[i];
            let imgPath = __dirname + "/public/images/" + imgUrl.split("/").pop();
            let buffer = fs.readFileSync(imgPath);
            let parser = exif.create(buffer);
            try {
                let result = parser.parse();
                let imgLat = result?.tags?.GPSLatitude;
                let imgLong = result?.tags?.GPSLongitude;

                if (imgLat !== null && imgLong !== null) {
                    if (Math.sqrt((imgLat - lat)**2 + (imgLong - long)**2) >= validation.coordinatesRadius) {
                        res.end(JSON.stringify({
                            status: "ERROR",
                            description: "Coordinates validation failed"
                        }, null, 4));
                        return;
                    }
                }
            } catch (e) {}
        }
    }

    let q = `insert into main (disasterName, disasterDate, owner, cause, product, volume, area, damageCount, damagedObjects, lat, \`long\`, disasterDescription, objectName, images) values (${sql.escape(disasterName)}, ${sql.escape(disasterDate)}, ${sql.escape(owner)}, ${sql.escape(cause)}, ${sql.escape(product)}, ${sql.escape(volume)}, ${sql.escape(area)}, ${sql.escape(damageCount)}, ${sql.escape(damagedObjects)}, ${sql.escape(lat)}, ${sql.escape(long)}, ${sql.escape(disasterDescription)}, ${sql.escape(objectName)}, ${sql.escape(images)})`;
    console.log(q);

    sql.query(q, (err) => {
        if (err) {
            console.error(err);
            res.end(JSON.stringify({
                status: "DB_ERROR",
                description: err.name + "\n" + err.message
            }, null, 4))
        } else {
            res.end(JSON.stringify({
                status: "OK"
            }, null, 4));
        }
    })
})

http.listen(process.env.SERVER_PORT, process.env.SERVER_IP , (err) => {
    if (err) throw err;
    console.log(`Started on ${process.env.SERVER_IP}:${process.env.SERVER_PORT}`);
});