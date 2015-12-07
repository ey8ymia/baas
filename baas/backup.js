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

var container = "";

var errors = {
    backup_name_empty: 'Provide a Backup Name',
    backup_name_illegal: 'Invalid Entry. Name must start with '
        + '\'Backup\' and followed by characters [A-Za-z0-9-_]',
    cloud_empty: 'Select cloud configuration',
    dir_not_chosen : 'Provide a local directory',
    res_file_illegal: 'Invalid Entry. Provide a valid file name',
    path_empty: 'Provide a path',
    passphrase_empty: 'Provide a Passphrase',
    passphrase_wrong: 'Wrong Passphrase',
    remove_all_time_empty: 'Provide a valid timestamp'
};

function toggle_error(error, msg) {
    if(error) {
        $("#msg").html(msg);
        $("#msg").addClass("panel");
        $("html,body").animate({scrollTop: $("#msg").offset().top}, "slow");
    } else {
        $("#msg").html("");
        $("#msg").removeClass("panel");
    }
}

function populate_clouds(cloud_field, data) {
    if(typeof clouds === 'undefined') {
        if(data != "") {
            clouds = JSON.parse(data);
        } else {
            clouds = new Object();
        }
    }
    var cloud_sel = $("#" + cloud_field);
    $.each(clouds, function(i, cloud) {
        cloud_sel.append($("<option></option>")
            .attr("value", cloud.name)
            .text(cloud.name));
    });
}

function check_directory(dir_id) {
    if(!$('#' + dir_id).html()) {
        $('#' + dir_id + '-error small').text(errors.dir_not_chosen);
        $('#' + dir_id + '-error small').show();
        return false;
    } else $('#' + dir_id + '-error small').hide();
    return true;
}


function hide_error_divs() {
    $('#backup-name-error small').hide();
    $('#res-backup-name-error small').hide();
    $('#directory-error small').hide();
    $('#res-directory-error small').hide();
    $('#cloud-error small').hide();
    $('#res-cloud-error small').hide();
    $('#passphrase-error small').hide();
    $('#res-passphrase-error small').hide();
    $('#exclude-error small').hide();
    $('#include-error small').hide();
    $('#res-file-error small').hide();
    $('#timestamp-error small').hide();
    $('#time-head-error small').hide();
    $('#remove-all-error small').hide();
    $('#remove-inc-error small').hide();
}

function load_backup(backup) {
    $(".tabs").show();
    $(".tabs-content").show();
    $('#backup_details_tab').addClass('active');
    $("#time-dates").html("");
    $("#time-contents").html("");
    $("#time-path").val("/");
    toggle_error(false, "");

    hide_error_divs();

    if(backup) {
        container = backup.container;
        $("#backup-name").val(backup.name);
        $("#directory").html(backup.local_dir);
        $("#cloud").val(backup.cloud);
        $("#passphrase").val(backup.passphrase);
        if(backup.passphrase != "") {
            $("#save_passphrase").prop("checked", true);
        }
        if(backup.first_backup) {
            disable_form(true);
            disable_actions(false);
        } else {
            disable_actions(true);
            disable_form(false);
        }
        $("#exclude").val(backup.exclude);
        $("#include").val(backup.include);
    } else {
        container = "";
        selected_backup = "";
        $("#selected-bar").hide();
        $("#backup-name").val('Backup');
        $("#directory").html('');
        $("#res-directory").html('');
        $("#cloud").val('');
        $("#passphrase").val('');
        $("#exclude").val('');
        $("#include").val('');
        $("#full").prop("checked", true);
        $("#inc").prop("disabled", true);
        disable_form(false);
        disable_actions(true);
    }
    $("#backup_details").show();
}

function show_alert_box(msg, alert_type, hide) {
    $("#" + alert_type + "-alert").show();
    $("#" + alert_type + "-msg").html(msg + "<a href='#' class='close'>&times;</a>");
    if(hide) {
        $("#" + alert_type + "-alert").delay(800).fadeOut(400);
    }
    $("html,body").animate({
        scrollTop: $("#msg").offset().top},
        "slow"
    );
}

function save_backup_set(is_template) {
    var backup_name = $("#backup-name").val().replace(/^\s+|\s+$/gm,'');
    var directory = $("#directory").html();
    var cloud = $("#cloud").val();
    var save_pass = $("#save_passphrase").is(":checked");
    var passphrase = (save_pass) ? $("#passphrase").val() : "";
    var exclude = $("#exclude").val();
    var include = $("#include").val();

    var backup_set = {};
    backup_set.name = backup_name;
    backup_set.local_dir = directory;
    backup_set.cloud = cloud;
    backup_set.passphrase = passphrase;
    backup_set.container = backup_name;
    container = backup_set.container;
    backup_set.exclude = exclude;
    backup_set.include = include;
    if(!is_template) {
        if(typeof backups[cloud + "/" + backup_name] != 'undefined') {
            if(typeof backups[cloud + "/" + backup_name].first_backup != 'undefined') {
                backup_set.first_backup = backups[cloud + "/" + backup_name].first_backup;
            }
            if(typeof backups[cloud + "/" + backup_name].last_backup != 'undefined') {
                backup_set.last_backup = backups[cloud + "/" + backup_name].last_backup;
            }
            if(typeof backups[cloud + "/" + backup_name].last_status != 'undefined') {
                backup_set.last_status = backups[cloud + "/" + backup_name].last_status;
            }
        }
        backups[cloud + "/" + backup_name] =  backup_set;
        selected_backup = cloud + "/" + backup_name;
        render_backup_sets("");

        show_alert_box("Successfully saved backup set", "success", true);
        write_conf_file(BACKUP_CONF_FILE, backups);
    } else {
         var template = {};
         template.name = backup_name;
         template.local_dir = directory;
         template.cloud = cloud;
         template.container = container;
         template.exclude = exclude;
         template.include = include;

         templates[cloud + "/" + backup_name] = template;
         populate_template_list("");

         show_alert_box("Successfully saved template", "success", true);
         write_conf_file(TEMPLATES_FILE, templates);
    }
}

function delete_backup(backup) {
    delete backups[backup.cloud + "/" + backup.name];
    render_backup_sets("");
    write_conf_file(BACKUP_CONF_FILE, backups);
    $(".tabs").hide();
    $(".tabs-content").hide();
}
