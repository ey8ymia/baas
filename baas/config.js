// Copyright (C) 2015 GRNET S.A.

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var fs = require('fs');
var path = require('path');
var mkdirp = require("mkdirp");
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var execFile = require('child_process').execFile;

var BAAS_HOME_DIR = '.baas';
var CLOUDS_CONF_FILE = 'clouds.rc';
var BACKUP_CONF_FILE = 'backups.rc';
var TEMPLATES_FILE = 'templates.rc';
var BAAS_LOG_DIR = path.join(get_user_home(), BAAS_HOME_DIR, 'log');
var BAAS_CACHE_DIR = path.join(get_user_home(), BAAS_HOME_DIR, 'cache');
var RESTORE_DEFAULT_DIR = path.join(get_user_home(), "Downloads");

var exec_path = path.dirname(process.execPath);
if(process.platform == 'darwin') {
    exec_path = path.join(
	path.dirname(path.dirname(path.dirname(path.dirname(exec_path)))),
	"Resources");
    process.env['PATH'] = process.env['PATH'] + ':/usr/local/bin';
}

var CYGWIN_BASH = path.join(exec_path, "cygwin", "bin", "bash.exe");

function get_user_home() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

var templates_data = {
  "BackupHome": {
    "name": "BackupHome",
    "local_dir": get_user_home(),
    "cloud": "",
    "passphrase": "",
    "container": "BackupHome",
    "exclude": "",
    "include": ""
  },
  "BackupEtc": {
    "name": "BackupEtc",
    "local_dir": "/etc",
    "cloud": "",
    "passphrase": "",
    "container": "BackupEtc",
    "exclude": "",
    "include": ""
  }
}

function get_unix_path(target) {
    if(process.platform == 'win32') {
        var out = execSync(CYGWIN_BASH +
            " -c \"/usr/bin/cygpath '" + exec_path + "' \"");
        var win_value = String(out).replace(/(\r\n|\n|\r)/gm, "");
        return win_value + "/" + target;
    }
    return path.join(exec_path, target);
}

var DUPLICITY_PATH = get_unix_path("duplicity");
var TIMEVIEW_PATH = get_unix_path("timeview.py");

function create_conf_files() {
    create_conf_file(CLOUDS_CONF_FILE);
    create_conf_file(BACKUP_CONF_FILE);
    write_file_if_empty(TEMPLATES_FILE, templates_data);
    mkdirp(BAAS_LOG_DIR, function(err) {
        if(err) console.error(err);
    });
    mkdirp(BAAS_CACHE_DIR, function(err) {
        if(err) console.error(err);
    });
}

function create_baas_dir() {
    var dir = path.join(get_user_home(), BAAS_HOME_DIR);
    fs.stat(dir, function (err, stats) {
        if(err) {
            fs.mkdir(dir, function(error) {
                if(error) return console.error(error);
                console.log("Successfully created " + dir);
                // Create conf files under new directory
                create_conf_files();
            });
            return;
        } else {
            if(stats.isFile()) {
                return console.error("Failed to create " + dir + ", File exists.");
            } else {
                // Directory found, check for conf files
                create_conf_files();
            }
        }
    });
}

function create_conf_file(filename) {
    var conf_file = path.join(get_user_home(), BAAS_HOME_DIR, filename);
    fs.stat(conf_file, function (err, stats) {
        if(err) {
            fs.writeFile(conf_file, "", function(error) {
                if (error) return console.error(error);
                return console.log("Successfully created " + conf_file);
            });
            return;
        }
        if(!stats.isFile()) {
            return console.error("Failed to create " + conf_file + ", Directory exists.");
        }
    });

}

function write_conf_file(filename, data) {
    var conf_file = path.join(get_user_home(), BAAS_HOME_DIR, filename);
    fs.writeFile(conf_file, JSON.stringify(data, null, 2), function(error) {
        if(error) return console.error(error);
        console.log("Successfully updated " + conf_file);
    });

}

function write_file_if_empty(filename, data) {
    var file = path.join(get_user_home(), BAAS_HOME_DIR, filename);
    fs.stat(file, function(err, stats) {
        if(err || (stats && stats.size == 0)) {
            fs.writeFile(file, JSON.stringify(data, null, 2), function(error) {
                if(error) return console.error(error);
                console.log("Successfully initialized " + file);
            });
        }
    });
}

function load_data_from_file(filename, callback) {
    var conf_file = path.join(get_user_home(), BAAS_HOME_DIR, filename);
    fs.stat(conf_file, function (err, stats) {
        if(err) return console.error(err);
        fs.readFile(conf_file, function(error, data) {
            if(error) return console.error(error);
            callback(data);
        });
    });
}

function escape_quote_str(str) {
    if(!str) return "";
    var escaped_quoted = str.replace(/'/g, "'\\''");
    return "'" + escaped_quoted + "'";
}
