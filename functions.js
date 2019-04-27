const psList = require('ps-list');
const fs = require('fs');
const pt = require('path');
const { remote } = require('electron');
const dialog = remote.dialog;
const configName = './config.json';
let config;

function loadConfig() {
    if (config) return;
    try {
        config = require(configName);
        console.log("Config is loaded!")
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            config = {handlingProcesses: []};
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

function refreshTable() {
    let table = $("tbody#process-table");
    table.empty();

    config.handlingProcesses.forEach((value, index) => {
        let row = `<tr>
                <th scope=\"row\">${index + 1}</th>
                <td>${value}</td>
                <td>
                    <button type="button" class="btn btn-danger btn-action float-right" id="row-${index}" onclick="window.deleteProcess(this)">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </td>
            </tr>`;
        table.append(row)
    })
}

function addProcess(path) {
    let name = pt.basename(path, ".app");
    if (config.handlingProcesses.includes(name)) return;
    config.handlingProcesses.push(name);
    saveConfig();
    refreshTable()
}

window.deleteProcess = function (button) {
    let index = parseInt($(button).attr('id').slice(4));
    config.handlingProcesses.splice(index, 1);
    saveConfig();
    refreshTable()
};

document.addEventListener('DOMContentLoaded', function() {

    loadConfig();
    refreshTable();

    $('button#add-processes').click(function () {
        dialog.showOpenDialog (
            remote.getCurrentWindow (),
            {
                properties: ["openFile"],
                filters: [
                    { name: 'Apps', extensions: ['app', 'exe'] }
                ]
            },
            filePaths => {
                filePaths.forEach(file => {
                    addProcess(file)
                });
            }
        );
    });

    $('#exampleModalLong').on('show.bs.modal', function () {
        psList().then(
            result => {
                $("p#p1").empty();
                result.filter(item => {
                        return config.handlingProcesses.includes(item.name)
                    }).map(item => {
                        return `${item.pid} - ${item.name}`
                    }).forEach(item => {
                        $("p#p1").append(`<p>${item}</p>`)
                    })
            },
            error => alert(error)
        );
    })

}, false);