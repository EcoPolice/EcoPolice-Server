'use strict';
const express = require("express");
const app = express();
const http = require("http").Server(app);
const bodyParser = require("body-parser");
const fileUpload = require('express-fileupload');
const mysql = require("mysql2");
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

    let promises = [];
    let urls = [];

    for (let key of Object.keys(req.files)) {
        let file = req.files[key];
        let newName = file.md5 + "." + file.name.split(".").pop();
        uploadPath += newName;
        promises.push(file.mv(uploadPath));
        urls.push(`http://${process.env.REAL_SERVER_IP}/images/${newName}`);
    }
    Promise.all(promises).then(values => {
        console.log(values);
        res.end(JSON.stringify(urls));
    })
})

app.post("/add", bodyParser.json(), (req, res) => {
    console.log("/add");
    console.log(req.body);
    res.writeHead(200, {'Content-Type': 'text/json; charset=utf-8'});
    let disasterName = req.body["name"].isEmpty() ? null : req.body["name"];
    let disasterDescription = req.body["description"].isEmpty() ? null : req.body["description"];
    let disasterDate = isNaN(parseInt(req.body["date"])) ? null : parseInt(req.body["date"]);
    let objectName = req.body["objectName"].isEmpty() ? null : req.body["objectName"];
    let owner = req.body["owner"].isEmpty() ? null : req.body["owner"];
    let cause = req.body["cause"].isEmpty() ? null : req.body["cause"];
    let product = req.body["product"].isEmpty() ? null : req.body["product"];
    let volume = isNaN(parseInt(req.body["volume"])) ? null : parseInt(req.body["volume"]);
    let area = isNaN(parseInt(req.body["area"])) ? null : parseInt(req.body["area"]);
    let damagedCount = isNaN(parseInt(req.body["damagedCount"])) ? null : parseInt(req.body["damagedCount"]);
    let damagedObjects = req.body["damagedObjects"].length === 0 ? null : req.body["damagedCount"].join("|");
    let lat = isNaN(parseFloat(req.body["coordinates"]?.first)) ? null : parseFloat(req.body["coordinates"]?.first);
    let long = isNaN(parseFloat(req.body["coordinates"]?.second)) ? null : parseFloat(req.body["coordinates"]?.second);
    let images = req.body["images"].length === 0 ? null : req.body["images"].join("|");

    let q = `insert into main (disasterName, disasterDate, owner, cause, product, volume, area, damageCount, damagedObjects, lat, \`long\`, disasterDescription, objectName, images) values (${sql.escape(disasterName)}, ${sql.escape(disasterDate)}, ${sql.escape(owner)}, ${sql.escape(cause)}, ${sql.escape(product)}, ${sql.escape(volume)}, ${sql.escape(area)}, ${sql.escape(damagedCount)}, ${sql.escape(damagedObjects)}, ${sql.escape(lat)}, ${sql.escape(long)}, ${sql.escape(disasterDescription)}, ${sql.escape(objectName)}, ${sql.escape(images)})`;
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