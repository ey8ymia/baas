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

var dup_verbosity = " -v8 ";

function backup(restore) {
    $("#loader").show();
    if($("#error-alert")) $("#error-alert").hide();
    if(!restore) {
        save_backup_set(false);
        disable_form(true);
        disable_actions(true);
        disable_buttons(true);
    }
    run_duplicity(restore, false);
}

function get_env_values() {
    var sel_pass = $('#passphrase').val() ? $('#passphrase') : $("#res-passphrase");
    var passphrase = sel_pass.val();

    var sel_cloud = $("#cloud").val() ? $("#cloud") : $("#res-cloud");
    var cloud_name = sel_cloud.val().replace(/^\s+|\s+$/gm,'');
    var cloud = clouds[cloud_name];

    return [passphrase, cloud.pithos_public + '/' + cloud.uuid, cloud.token];
}

function set_envs() {
    var env_values = get_env_values();
    process.env['PASSPHRASE'] = env_values[0];
    process.env['SWIFT_PREAUTHURL'] = env_values[1];
    process.env['SWIFT_PREAUTHTOKEN'] = env_values[2];
}

function build_win_commands() {
    var env_values = get_env_values();

    return "export PATH=/usr/bin/:$PATH;" +
        "ulimit -n 1024;" +
        "export PASSPHRASE=" + env_values[0] + ";" +
        "export SWIFT_PREAUTHURL=" + env_values[1] + ";" +
        "export SWIFT_PREAUTHTOKEN=" + env_values[2] + ";";
}
function parse_cloud_error(restore, stderr, backup) {
    var cloud_error =
        new RegExp("AttributeError 'NoneType' object has no attribute 'find'")
        .exec(stderr);
    if(cloud_error) {
        toggle_error(false, "");
        show_alert_box("A problem occured.<br>" +
                       "Please check your <a href='#'" +
                       " onclick=$('#cloud-settings-link').trigger('click')>cloud settings</a>",
                       "error", false);
        if(!restore && backup) {
            backups[backup].last_status = "Failed";
            write_conf_file(BACKUP_CONF_FILE, backups);
            disable_buttons(false);
        }
        return true;
    }
    return false;
}

function run_duplicity(restore, force) {

    var container_name = "";
    if(restore) {
        container_name = $("#res-backup-name").val();
    } else {
        container_name = $("#backup-name").val();
    }

    var cloud = "";
    if(restore) {
        cloud = $("#res-cloud").val();
    } else {
        cloud = $("#cloud").val();
    }

    if(!restore) {
        backups[cloud + "/" + container_name].last_status = "Running";
    }

    var file_arg = "";
    if(restore) {
        var file_to_restore = $("#res-file").val();
        if(file_to_restore) {
            file_arg = " --file-to-restore '" + file_to_restore + "' ";
        }
    }

    var time_arg = "";
    if(restore) {
        var timestamp = $("#timestamp").val();
        if(timestamp) {
            time_arg = " --time " + timestamp;
        }
    }

    var type_arg = "";
    if(!restore) {
        var backup_type = $("input[name=backup-type]:checked").val();
        type_arg = " " + backup_type + " ";
    }

    var exclude_arg = "";
    if(!restore) {
        var exclude = $("#exclude").val();
        if(exclude) {
            var args = exclude.split(",");
            $.each(args, function(i, value) {
                if(process.platform == 'win32') {
                    exec(CYGWIN_BASH + " -c \"/usr/bin/cygpath '" + value + "' \"",
                        function(error, stdout, stderr) {
                            toggle_error(error, stderr);
                            var win_value = String(stdout).replace(/(\r\n|\n|\r)/gm, "");
                            exclude_arg += " --exclude '" + win_value + "' ";
                        });
                } else {
                    exclude_arg += " --exclude '" + value + "' ";
                }
            });
        }
    }

    var include_arg = "";
    if(!restore) {
        var include = $("#include").val();
        if(include) {
            var args = include.split(",");
            $.each(args, function(i, value) {
                if(process.platform == 'win32') {
                    exec(CYGWIN_BASH + " -c \"/usr/bin/cygpath '" + value + "' \"",
                        function(error, stdout, stderr) {
                            toggle_error(error, stderr);
                            var win_value = String(stdout).replace(/(\r\n|\n|\r)/gm, "");
                            include_arg += " --include '" + win_value + "' ";
                        });
                } else {
                    include_arg += " --include '" + value + "' ";
                }
            });
        }
    }

    var directory = "";
    if(restore) {
        if(file_to_restore) {
            directory = path.join($("#res-directory").html(), file_to_restore);
            fs.stat(directory, function (err, stats) {
                if(err) {
                    try {
                        mkdirp.sync(directory);
                    } catch(e) {
                        toggle_error(e, e);
                    }
                }
            });
        } else {
            directory = $("#res-directory").html();
        }
    } else {
        directory = $("#directory").html();
    }

    var log_file = path.join(BAAS_LOG_DIR, "dup_" + new Date().toISOString() + ".log");
    var log_arg = " --log-file '" + log_file + "' ";

    var force_arg = (force) ? " --force " : "";
    var exclude_device_files_arg = (restore) ? " " : " --exclude-device-files ";

    function dup_output(error, stdout, stderr) {
        toggle_error(error, stderr);
        if(error) {
            $("#loader").hide();
            if(parse_cloud_error(restore, stderr, cloud + "/" + container_name)) {
                return;
            } else {
                if(!restore) {
                    show_alert_box("There was a problem uploading backup set", "error", false);
                    disable_form(false);
                    disable_actions(true);
                    backups[cloud + "/" + container_name].last_status = "Failed";
                } else {
                    var exist_error =
                        new RegExp("Restore destination directory.* already exists.\nWill not overwrite.")
                        .exec(stderr);
                    var gpg_error = new RegExp("GPGError: GPG Failed").exec(stderr);
                    if(exist_error) {
                        toggle_error(false, "");
                        $("#modal-confirm").foundation("reveal", "open");
                        var i = 0;
                        $("#modal-confirm").on('close.fndtn.reveal', function(e) {
                            if(e.namespace !== "fndtn.reveal") return;
                            i++;
                            $(this).click(function(event) {
                                // event is fired more than once so have to check
                                if(event.target.id == "modal-accept" && i == 1) {
                                    $("#loader").show();
                                    run_duplicity(true, true);
                                }
                            });
                        });
                    } else if(gpg_error) {
                        toggle_error(false, "");
                        $('#res-passphrase-error small').text(errors.passphrase_wrong);
                        $('#res-passphrase-error small').show();
                    } else {
                        $('#res-passphrase-error small').hide();
                        show_alert_box("A problem occured during restoring", "error", false);
                        toggle_error(true, stderr);
                    }
                }
            }
        } else {
            $("#loader").hide();
            show_alert_box("Successfully completed", "success", true);
            if(!restore) {
                backups[cloud + "/" + container_name].last_status = "Completed";
                backups[cloud + "/" + container_name].last_backup = new Date();
                if(typeof backups[cloud + "/" + container_name].first_backup == 'undefined') {
                    backups[cloud + "/" + container_name].first_backup = new Date();
                }
                disable_actions(false);
                $("#inc").prop("disabled", false);
                $("#inc").prop("checked", true);
            }
        }
        if(!restore) {
            disable_buttons(false);
            write_conf_file(BACKUP_CONF_FILE, backups);
        }
    }

    if(process.platform == 'win32') {
        directory = directory.replace(/\\/g, "\\\\");
        var args = ["-c", "/usr/bin/cygpath " + escape_quote_str(directory)];
        execFile(CYGWIN_BASH, args,
            function(error, stdout, stderr) {
                directory = String(stdout).replace(/(\r\n|\n|\r)/gm, "");
                toggle_error(error, stderr);

                var dirs = "'" + directory + "' swift://" + container_name;
                if(restore) {
                    dirs = " swift://" + container_name + " '" + directory + "'";
                }
                var cmd = build_win_commands();
                var dup_cmd = DUPLICITY_PATH + " " + type_arg + force_arg + exclude_device_files_arg
                    + include_arg + exclude_arg + file_arg + time_arg + dirs + ";";

                var args = ["-c", cmd + dup_cmd];
                execFile(CYGWIN_BASH, args, dup_output);
        });
    } else {
        set_envs();

        var dirs = "'" + directory + "' swift://" + container_name;
        if(restore) {
            dirs = " swift://" + container_name + " '" + directory + "'";
        }
        var dup_cmd = DUPLICITY_PATH + " " + type_arg + force_arg + exclude_device_files_arg +
            dup_verbosity + log_arg + include_arg + exclude_arg + file_arg + time_arg + dirs + ";";
        exec(dup_cmd , dup_output);
    }
}

function load_status() {
    $('#backup_details').hide();
    $("#loader").show();
    $("#status_contents").html("");

    function puts(error, stdout, stderr) {
        toggle_error(error, stderr);
        if(!error) {
            $("#status_contents").html(stdout);
        } else {
             parse_cloud_error(false, stderr, false);
        }
        $("#loader").hide();
    }
    var dup_cmd = DUPLICITY_PATH + " collection-status swift://" + container;
    if(process.platform == 'win32') {
        var cmd = build_win_commands();
        var args = ["-c", cmd + dup_cmd];
        execFile(CYGWIN_BASH, args, puts);
    } else {
        set_envs();
        exec(dup_cmd, {maxBuffer: 1000*1024} , puts);
    }
}

function remove_all(time, force) {
    $("#loader").show();

    function puts(error, stdout, stderr) {
        toggle_error(false, "");
        if(error) {
            if(!parse_cloud_error(false, stderr, false)) {
                $("#cleanup-msg").html(stderr);
                $("#cleanup-msg").addClass("panel");
                $("#force-delete").hide();
            }
        } else {
            $("#cleanup-msg").addClass("panel");
            $("#cleanup-msg").html(stdout);
            if(!force) {
                $("#force-delete").show();
            } else {
                $("#force-delete").hide();
            }
            var nothing_to_del = new RegExp("No old backup sets found, nothing deleted").exec(stdout);
            if(nothing_to_del) {
                $("#force-delete").hide();
                $("#remove-all-button").show();
            }
        }
        $("#loader").hide();
    }

    var force_arg = "";
    if(force) {
        force_arg = " --force ";
    }

    var dup_cmd = DUPLICITY_PATH + " remove-older-than " +
        time + force_arg + " swift://" + container;
    if(process.platform == 'win32') {
        var cmd = build_win_commands();
        var args = ["-c", cmd + dup_cmd];
        execFile(CYGWIN_BASH, args, puts);
    } else {
        set_envs();
        exec(dup_cmd, {maxBuffer: 1000*1024} , puts);
    }
}
