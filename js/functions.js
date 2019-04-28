const psList = require('ps-list/index');
const fs = require('fs');
const pt = require('path');
const moment = require('moment');
const { remote } = require('electron');
const dialog = remote.dialog;
const configName = pt.join(__dirname, '..', 'config.json');
const longDateFormat  = 'YYYY-MM-DD HH:mm:ss';
let config;
let timer;

function loadConfig() {
    if (config) return;
    try {
        config = require(configName);
        console.log("Config is loaded!")
    } catch (err) {
        if (err.code === "MODULE_NOT_FOUND") {
            config = {handlingProcesses: [], timeoutProcessHandling: 60000, trackData: []};
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
            fs.writeFileSync(configName, JSON.stringify(config));
            config = require(configName);
            console.log("config sync saved");
        } catch (err) {
            console.log(err);
        }
    } else {
        fs.writeFile(configName, JSON.stringify(config), function (err) {
            if (err) return console.log(err);
            config = require(configName);
            console.log("config async saved");
        });
    }
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

function updateChartData() {
    if (window.chart !== undefined) {
        window.chart.data = getData();
        window.chart.invalidateData();
    }
}

function clearAllStoreData() {
    config.trackData = [];
    updateChartData();
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
                if (config.handlingProcesses.includes(name)) return;
                config.handlingProcesses.push(name);
                saveConfig();
                refreshTable()
            });
        }
    );
}

function deleteProcess(button) {
    let index = parseInt($(button).attr('id').slice(4));
    config.handlingProcesses.splice(index, 1);
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

function getData() {
    if (config.trackData.length > 0) {
        showChartEmptyScreen(false);
        return setColors(config.trackData)
    } else if (config.handlingProcesses.length > 0) {
        showChartEmptyScreen(false);
        let date = moment(new Date()).format(longDateFormat);
        return setColors(config.handlingProcesses.map(item => {
            return {name: item, fromDate: date, toDate: date}
        }))
    } else {
        showChartEmptyScreen(true);
        return []
    }
}

function showChartEmptyScreen(isShow) {
    if (isShow) {
        $('div#chartdiv-empty').show();
        $('div#chartdiv').hide()
    } else {
        $('div#chartdiv-empty').hide();
        $('div#chartdiv').show()
    }
}

window.getData = getData;

document.addEventListener('DOMContentLoaded', function() {

    loadConfig();
    refreshTable();
    updateTimeoutProcessHandling(config.timeoutProcessHandling);
    initTimer();

    $('input#currentTimeoutRange').change(function() {
        let value = $(this).val();
        if (typeof value == "string") {
            value = parseInt(value)
        }
        config.timeoutProcessHandling = value * 1000;
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
    }, config.timeoutProcessHandling);
}

function checkSelectedProcesses() {
    psList().then(
        result => {
            let handlingProcesses = [];

            result.forEach(item => {
                if (config.handlingProcesses.includes(item.name)
                    && !handlingProcesses.includes(item.name)) {
                    handlingProcesses.push(item.name);
                }
            });

            handlingProcesses.forEach(item => {
                let curDate = new Date();
                let currentIndex = null;

                let data = config.trackData.find((value, index) => {
                    let lastDate = moment(value.toDate, longDateFormat).toDate();
                    let result = value.name === item && curDate - lastDate <= config.timeoutProcessHandling * 2;
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
                    config.trackData.push(data);
                } else {
                    config.trackData[currentIndex] = data;
                }

                updateChartData()
            });

            saveConfig()
        },
        error => alert(error)
    );
}