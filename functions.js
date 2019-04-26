const psList = require('ps-list');
const fs = require('fs');
const configName = './config.json';
let config;

function loadConfig() {
    if (config) return;
    try {
        config = require(configName);
        console.log("Config is loaded!")
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            config = {};
            saveConfig()
        }
        else {
            alert(err);
            throw err;
        }
    }
}

function saveConfig() {
    fs.writeFile(configName, JSON.stringify(config), function (err) {
        if (err) return console.log(err);
        console.log(JSON.stringify(config));
        console.log('writing to ' + configName);
        config = require(configName);
    });
}

document.addEventListener('DOMContentLoaded', function() {

    loadConfig();

    $('#exampleModalLong').on('show.bs.modal', function () {
        psList().then(
            result => {
                document.getElementById("p1").textContent = result.map(item => {
                    return `${item.pid} - ${item.name}`
                }).join(" | ")
            },
            error => alert(error)
        );
    })
}, false);