const psList = require('ps-list/index');
const fs = require('fs');
const pt = require('path');
const moment = require('moment');
const { remote } = require('electron');
const dialog = remote.dialog;
const configName = '../config.json';
let timer;

function loadConfig() {
    if (window.config) return;
    try {
        window.config = require(configName);
        console.log("Config is loaded!")
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            window.config = {handlingProcesses: [], timeoutProcessHandling: 60000, trackData: []};
            saveConfig(true);
        }
        else {
            alert(err);
            throw err;
        }
    }
}

function saveConfig(isSync = false) {
    if (isSync) {
        try {
            fs.writeFileSync(configName, JSON.stringify(window.config));
            window.config = require(configName);
        } catch (err) {
            console.log(err);
        }
    } else {
        fs.writeFile(configName, JSON.stringify(window.config), function (err) {
            if (err) return console.log(err);
            window.config = require(configName);
        });
    }
}

function refreshTable() {
    let table = $("tbody#process-table");
    table.empty();

    window.config.handlingProcesses.forEach((value, index) => {
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

function clearAllStoreData() {
    window.config.trackData = [];
    console.log(window.config.trackData);
    if (window.chart !== undefined) {
        window.chart.data = [];
        console.log(window.chart.data);
        window.chart.invalidateData();
    }
    saveConfig()
}

function showAddProcessesDialog() {
    let extensions = ['app', 'exe'];
    if (process.platform === 'linux') extensions.push("*");
    dialog.showOpenDialog (
        remote.getCurrentWindow (),
        {
            properties: ["openFile"],
            filters: [
                { name: 'Apps', extensions: extensions }
            ]
        },
        filePaths => {
            if (!filePaths) return;
            filePaths.forEach(file => {
                let name = pt.basename(file, ".app");
                if (window.config.handlingProcesses.includes(name)) return;
                window.config.handlingProcesses.push(name);
                saveConfig();
                refreshTable()
            });
        }
    );
}

function deleteProcess(button) {
    let index = parseInt($(button).attr('id').slice(4));
    window.config.handlingProcesses.splice(index, 1);
    saveConfig();
    refreshTable()
}

window.deleteProcess = deleteProcess;

function updateTimeoutProcessHandling(value) {
    if (typeof value == "string") {
        value = parseInt(value)
    }
    if (value > 1000) {
        value = value / 1000;
    }
    $('input#currentTimeoutRange').val(value);
    $('span#currentTimeout').text(value)
}

document.addEventListener('DOMContentLoaded', function() {

    loadConfig();
    refreshTable();
    updateTimeoutProcessHandling(window.config.timeoutProcessHandling);
    initTimer();

    $('input#currentTimeoutRange').change(function() {
        let value = $(this).val();
        if (typeof value == "string") {
            value = parseInt(value)
        }
        window.config.timeoutProcessHandling = value * 1000;
        initTimer();
        updateTimeoutProcessHandling(value);
        saveConfig()
    });

    $('button#add-processes').click(function () {
        showAddProcessesDialog()
    });

    $('button#clear-all').click(function () {
        clearAllStoreData()
    });

}, false);

function initTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(function() {
        checkSelectedProcesses()
    }, window.config.timeoutProcessHandling);
}

function checkSelectedProcesses() {
    psList().then(
        result => {
            let handlingProcesses = [];

            result.forEach(item => {
                if (window.config.handlingProcesses.includes(item.name)
                    && !handlingProcesses.includes(item.name)) {
                    handlingProcesses.push(item.name);
                }
            });

            handlingProcesses.forEach(item => {
                let longDateFormat  = 'YYYY-MM-DD HH:mm:ss';
                let curDate = new Date();
                let currentIndex = null;

                let data = window.config.trackData.find((value, index) => {
                    let lastDate = moment(value.toDate, longDateFormat).toDate();
                    let result = value.name === item && curDate - lastDate <= window.config.timeoutProcessHandling * 2;
                    if (result) currentIndex = index;
                    return result
                });

                if (data === undefined) {
                    data = {
                        name: item,
                        fromDate: moment(curDate).format(longDateFormat),
                        toDate: moment(curDate).add(1, 's').format(longDateFormat)
                    }
                } else {
                    data.toDate = moment(curDate).format(longDateFormat)
                }

                if (currentIndex === null) {
                    window.config.trackData.push(data);
                } else {
                    window.config.trackData[currentIndex] = data;
                }

                if (window.chart !== undefined) {
                    window.chart.data = setColors(window.config.trackData);
                    window.chart.invalidateData();
                }
            });

            saveConfig()
        },
        error => alert(error)
    );
}